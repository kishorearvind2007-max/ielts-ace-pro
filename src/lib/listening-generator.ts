// NVIDIA Qwen LLM Integration for IELTS Listening Content Generation
// API: https://build.nvidia.com/ - Qwen 3.5 122B model
// Uses streaming API for efficient token consumption

import axios from 'axios';
import { ListeningSection, Question, QuestionType } from './ielts-types';

export type ContentType = 'conversation' | 'monologue' | 'academic' | 'lecture';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface GenerationRequest {
  contentType: ContentType;
  topic?: string;
  difficulty: DifficultyLevel;
  sectionNumber: number;
}

interface GenerationResponse {
  script: string;
  questions: Question[];
  answerKey: Record<number, string>;
  metadata: {
    speakers: number;
    duration: string;
    context: string;
    generatedAt: string;
  };
}

// Prompt templates for each section type
const PROMPT_TEMPLATES = {
  conversation: `Generate a realistic IELTS Listening Section 1 conversation (~5 minutes of audio).

Format: Dialogue between TWO people (e.g., customer & service representative).
Difficulty: DIFFCULTY_LEVEL
Topic: TOPIC

Requirements:
1. Create a natural, everyday conversation (booking, inquiry, service)
2. Include specific details: names, phone numbers, dates, prices, addresses
3. Generate exactly 10 IELTS-style questions based on the conversation
4. Questions should test ability to hear specific details (numbers, names, places)
5. Include 2-3 question types: form completion, note completion, short answer

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "script": "full conversation dialogue here",
  "questions": [
    {"id": 1, "type": "short-answer", "text": "What is...?"},
    {"id": 2, "type": "short-answer", "text": "How much...?"}
  ],
  "answerKey": {
    "1": "answer1|alternative1",
    "2": "answer2"
  }
}

Ensure all question answers appear clearly in the conversation.`,

  monologue: `Generate a realistic IELTS Listening Section 2 monologue (~6 minutes of audio).

Format: ONE speaker giving information (tour guide, announcement, presentation).
Difficulty: DIFFCULTY_LEVEL
Topic: TOPIC

Requirements:
1. Create a natural monologue with descriptive information
2. Include directions, locations, descriptions of places/services
3. Generate exactly 10 IELTS-style questions
4. Mix question types: multiple choice, note completion, map labelling description
5. Questions should test comprehension of descriptions and directions

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "script": "full monologue here",
  "questions": [
    {"id": 1, "type": "mcq", "text": "Where is...?", "options": ["A", "B", "C"]},
    {"id": 2, "type": "short-answer", "text": "The library has..."}
  ],
  "answerKey": {
    "1": "B",
    "2": "answer"
  }
}`,

  academic: `Generate a realistic IELTS Listening Section 3 academic discussion (~6-7 minutes of audio).

Format: Conversation between 2-4 people (students + professor discussing project/assignment).
Difficulty: DIFFCULTY_LEVEL
Topic: TOPIC

Requirements:
1. Create academic discussion with opinions, arguments, ideas
2. Include decision-making, disagreements, conclusions
3. Generate exactly 10 IELTS-style questions
4. Include paraphrasing challenges (answers not direct quotes)
5. Mix types: multiple choice, matching opinions, sentence completion

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "script": "full academic discussion here",
  "questions": [
    {"id": 1, "type": "mcq", "text": "Why do they decide...?", "options": ["A", "B", "C"]},
    {"id": 2, "type": "sentence-completion", "text": "The group agrees to..."}
  ],
  "answerKey": {
    "1": "A",
    "2": "answer phrase"
  }
}`,

  lecture: `Generate a realistic IELTS Listening Section 4 academic lecture (~7 minutes of audio).

Format: University lecture by ONE speaker on academic topic.
Difficulty: DIFFCULTY_LEVEL
Topic: TOPIC

Requirements:
1. Create structured lecture with introduction, main points, conclusion
2. Include technical/academic vocabulary
3. Generate exactly 10 IELTS-style questions (note completion, flowchart, sentence completion)
4. Test ability to follow complex ideas and terminology
5. No pauses - continuous listening required

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "script": "full lecture here",
  "questions": [
    {"id": 1, "type": "note-completion", "text": "The study focused on..."},
    {"id": 2, "type": "sentence-completion", "text": "The main advantage is..."}
  ],
  "answerKey": {
    "1": "answer1",
    "2": "answer2"
  }
}`,
};

const TOPIC_EXAMPLES = {
  conversation: [
    'Hotel booking',
    'Apartment rental',
    'Car rental inquiry',
    'Course registration',
    'Doctor appointment',
  ],
  monologue: [
    'Museum tour',
    'Library facilities',
    'Campus tour',
    'Event announcement',
    'Business introduction',
  ],
  academic: [
    'Research project discussion',
    'Assignment planning',
    'Study group meeting',
    'Thesis discussion with professor',
    'Internship opportunity discussion',
  ],
  lecture: [
    'Environmental science',
    'Business economics',
    'Psychology research',
    'Climate change',
    'Technology and society',
  ],
};

/**
 * Call NVIDIA Qwen API with streaming to generate IELTS listening content
 * Uses qwen/qwen3.5-122b-a10b model via NVIDIA's integrate API
 */
async function callNvidiaQwen(prompt: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY environment variable not set');
  }

  const invokeUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
  const stream = true;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: stream ? 'text/event-stream' : 'application/json',
  };

  const payload = {
    model: 'qwen/qwen3.5-122b-a10b',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 16384,
    temperature: 0.6,
    top_p: 0.95,
    stream: stream,
    chat_template_kwargs: { enable_thinking: true },
  };

  try {
    const response = await axios.post(invokeUrl, payload, {
      headers: headers,
      responseType: stream ? 'stream' : 'json',
      timeout: 60000, // 60 second timeout
    });

    if (stream) {
      // Handle streaming response
      return new Promise((resolve, reject) => {
        let fullContent = '';

        response.data.on('data', (chunk: Buffer) => {
          const chunkStr = chunk.toString('utf-8');
          const lines = chunkStr.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6);
                if (jsonStr === '[DONE]') continue;

                const data = JSON.parse(jsonStr);
                if (data.choices?.[0]?.delta?.content) {
                  fullContent += data.choices[0].delta.content;
                }
              } catch (e) {
                // Skip malformed JSON lines
              }
            }
          }
        });

        response.data.on('end', () => {
          if (!fullContent) {
            reject(new Error('No content received from API'));
          } else {
            resolve(fullContent);
          }
        });

        response.data.on('error', (error: Error) => {
          reject(error);
        });
      });
    } else {
      // Handle non-streaming response
      const data = response.data as any;
      return data.choices[0]?.message?.content || '';
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.status
        ? `NVIDIA API Error: HTTP ${error.response.status} - ${error.response.data?.message || error.message}`
        : `NVIDIA API Error: ${error.message}`;
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Parse JSON response from LLM, handling potential markdown formatting
 */
function parseJsonResponse(content: string): {
  script: string;
  questions: Question[];
  answerKey: Record<number, string>;
} {
  // Remove markdown code blocks if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }

  const parsed = JSON.parse(cleaned.trim());

  // Validate structure
  if (!parsed.script || !parsed.questions || !parsed.answerKey) {
    throw new Error('Invalid response structure from LLM');
  }

  if (parsed.questions.length !== 10) {
    throw new Error(`Expected 10 questions, got ${parsed.questions.length}`);
  }

  // Ensure all questions have required fields
  const questions = parsed.questions.map((q: any, idx: number) => ({
    id: idx + 1,
    type: q.type as QuestionType,
    text: q.text,
    options: q.options || undefined,
    section: undefined,
  }));

  // Normalize answerKey keys to numbers
  const answerKey: Record<number, string> = {};
  Object.entries(parsed.answerKey).forEach(([key, value]) => {
    answerKey[Number(key)] = String(value);
  });

  return { script: parsed.script, questions, answerKey };
}

/**
 * Generate IELTS Listening content via Qwen LLM
 */
export async function generateListeningContent(
  request: GenerationRequest
): Promise<GenerationResponse> {
  const { contentType, topic, difficulty, sectionNumber } = request;

  // Select example topic if not provided
  const selectedTopic = topic || TOPIC_EXAMPLES[contentType][0];

  // Build prompt from template
  let prompt = PROMPT_TEMPLATES[contentType];
  prompt = prompt.replace('DIFFCULTY_LEVEL', difficulty);
  prompt = prompt.replace('TOPIC', selectedTopic);

  // Call NVIDIA Qwen API
  const responseText = await callNvidiaQwen(prompt);

  // Parse response
  const { script, questions, answerKey } = parseJsonResponse(responseText);

  // Determine speaker count based on content type
  const speakerCounts = {
    conversation: 2,
    monologue: 1,
    academic: 3,
    lecture: 1,
  };

  return {
    script,
    questions,
    answerKey,
    metadata: {
      speakers: speakerCounts[contentType],
      duration: `${5 + (sectionNumber - 1)}–${6 + (sectionNumber - 1)} minutes`,
      context: selectedTopic,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Cache key for generated content
 */
export function getCacheKey(request: GenerationRequest): string {
  return `listening-${request.contentType}-${request.difficulty}-${request.topic || 'default'}`;
}
