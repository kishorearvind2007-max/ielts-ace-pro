import { ReadingPassage, WritingTask } from '@/lib/ielts-types';

type NvidiaChatResponseEnvelope = {
  choices?: Array<{ message?: { content?: string } }>;
};

type NvidiaChatResponse = {
  task1: {
    prompt: string;
    chartType: WritingTask['chartType'];
    chartData: WritingTask['chartData'];
  };
  task2: {
    prompt: string;
  };
};

type NvidiaReadingResponse = {
  passages: Array<{
    id: number;
    title: string;
    text: string;
    questions: Array<{
      id: number;
      type: 'mcq' | 'short-answer' | 'true-false-ng';
      text: string;
      options?: string[];
    }>;
    answerKey: Record<string, string>;
  }>;
};

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? 'minimaxai/minimax-m2.1';
const NVIDIA_READING_MODEL = process.env.NVIDIA_READING_MODEL ?? 'moonshotai/kimi-k2-instruct-0905';
function buildPrompt(difficulty: string) {
  return `Generate IELTS Academic Writing questions in JSON only.

Return JSON with this shape:
{
  "task1": {
    "prompt": "Task 1: ...",
    "chartType": "bar" | "line" | "pie" | "table" | "process" | "map",
    "chartData": {
      "labels": ["..."],
      "datasets": [
        { "label": "...", "data": [number, ...] }
      ]
    }
  },
  "task2": {
    "prompt": "Task 2: ..."
  }
}

Task 1 requirements:
- Use one of: Bar chart, Line graph, Pie chart, Table, Process diagram, Map comparison.
- Provide a realistic data description in the prompt (no actual image).
- Include 5 to 8 data points in chartData.
- Ensure the data allows comparison and trend analysis.
- Topic domain: Education, Technology, Environment, Health, Economy, Transportation.
- Difficulty: ${difficulty}.
- Output format: "Task 1: The chart below shows ... Summarise the information by selecting and reporting the main features, and make comparisons where relevant."

Task 2 requirements:
- Use one of: Opinion, Discussion, Problem-Solution, Advantage-Disadvantage, Direct Questions.
- Topic domain: Education, Technology, Environment, Society, Health, Government, Economy, Culture.
- Difficulty: ${difficulty}.
- Avoid overly abstract topics.
- Output format: "Task 2: Write about the following topic: ... Give reasons for your answer and include any relevant examples from your own knowledge or experience."

Return JSON only. No markdown, no extra text.`;
}

function buildReadingPrompt(difficulty: string) {
  return `Generate IELTS Academic Reading test content in JSON only.

Return JSON with this exact shape:
{
  "passages": [
    {
      "id": 1,
      "title": "...",
      "text": "...",
      "questions": [
        {
          "id": 1,
          "type": "mcq" | "short-answer" | "true-false-ng",
          "text": "...",
          "options": ["..."]
        }
      ],
      "answerKey": {
        "1": "..."
      }
    }
  ]
}

Strict constraints:
- Generate exactly 3 passages (id: 1, 2, 3).
- Generate exactly 40 questions total across all passages.
- Question ids must be unique and sequential from 1 to 40.
- Passage 1: 13 questions (1-13), Passage 2: 13 questions (14-26), Passage 3: 14 questions (27-40).
- Each passage must be IELTS Academic Reading style only.
- The passage text must be original, realistic, and around 650-850 words.
- Use only IELTS-appropriate domains: science, environment, education, health, technology, history, society.
- Do not output stories, fiction, personal blogs, dialogues, poems, or non-IELTS formats.
- Include a mix of question types: mcq, true-false-ng, and short-answer.
- For type mcq, provide exactly 4 options.
- For type true-false-ng, options must be exactly ["True", "False", "Not Given"].
- Every question id must have an answer in answerKey.
- Answers must be concise strings and match the generated passage content.
- Difficulty level: ${difficulty}.

Return JSON only. No markdown, no extra text.`;
}

function readNonStreamingContent(payload: NvidiaChatResponseEnvelope): string {
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

function extractFirstJsonObject(content: string): string {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? content.trim();
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return candidate;
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function normalizeTask1(task1: NvidiaChatResponse['task1']) {
  const chartType = task1?.chartType ?? 'line';
  const labels = Array.isArray(task1?.chartData?.labels)
    ? task1.chartData.labels.map(label => String(label))
    : [];
  const datasets = Array.isArray(task1?.chartData?.datasets)
    ? task1.chartData.datasets.map((set, index) => ({
      label: typeof set?.label === 'string' && set.label.trim() ? set.label : `Series ${index + 1}`,
      data: Array.isArray(set?.data)
        ? set.data.map(value => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0))
        : [],
    }))
    : [];

  return {
    prompt: task1?.prompt,
    chartType,
    chartData: {
      labels,
      datasets,
    },
  };
}

function ensureValidTask(prompt: string, type: 'task1' | 'task2', chartType?: WritingTask['chartType'], chartData?: WritingTask['chartData']): WritingTask {
  if (!prompt) {
    throw new Error(`Missing prompt for ${type}`);
  }

  return {
    id: type === 'task1' ? 1 : 2,
    type,
    prompt,
    minWords: type === 'task1' ? 150 : 250,
    recommendedMinutes: type === 'task1' ? 20 : 40,
    chartType: type === 'task1' ? chartType ?? 'line' : undefined,
    chartData: type === 'task1' ? chartData : undefined,
  };
}

async function callNvidia(content: string, model: string) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('Missing NVIDIA_API_KEY');
  }

  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nvidia API error: ${errorText}`);
  }

  const data = (await response.json()) as NvidiaChatResponseEnvelope;
  const text = readNonStreamingContent(data);
  if (!text) {
    throw new Error('Empty Nvidia response');
  }

  return text;
}

function normalizeQuestionType(type: string): 'mcq' | 'short-answer' | 'true-false-ng' {
  if (type === 'mcq' || type === 'short-answer' || type === 'true-false-ng') {
    return type;
  }
  return 'short-answer';
}

function normalizeReadingPassage(rawPassage: NvidiaReadingResponse['passages'][number], index: number): ReadingPassage {
  const questions = Array.isArray(rawPassage?.questions)
    ? rawPassage.questions.map((q, questionIndex) => {
      const questionType = normalizeQuestionType(String(q?.type ?? 'short-answer'));
      const options = questionType === 'mcq'
        ? (Array.isArray(q?.options) ? q.options.slice(0, 4).map(opt => String(opt)) : []).filter(Boolean)
        : questionType === 'true-false-ng'
          ? ['True', 'False', 'Not Given']
          : undefined;

      return {
        id: Number(q?.id) || questionIndex + 1,
        type: questionType,
        text: String(q?.text ?? '').trim(),
        options,
      };
    }).filter(q => q.text)
    : [];

  const answerKeyEntries = Object.entries(rawPassage?.answerKey ?? {}).map(([key, value]) => [Number(key), String(value)] as const)
    .filter(([key, value]) => Number.isFinite(key) && value.trim().length > 0);

  return {
    id: Number(rawPassage?.id) || index + 1,
    title: String(rawPassage?.title ?? '').trim() || `Reading Passage ${index + 1}`,
    text: String(rawPassage?.text ?? '').trim(),
    questions,
    answerKey: Object.fromEntries(answerKeyEntries),
  };
}

function validateGeneratedReading(passages: ReadingPassage[]): ReadingPassage[] {
  if (passages.length !== 3) {
    throw new Error('Generated reading content must contain exactly 3 passages');
  }

  const questionIds = passages.flatMap(p => p.questions.map(q => q.id)).sort((a, b) => a - b);
  if (questionIds.length !== 40) {
    throw new Error('Generated reading content must contain exactly 40 questions');
  }

  for (let i = 1; i <= 40; i += 1) {
    if (questionIds[i - 1] !== i) {
      throw new Error('Generated reading question ids must be sequential from 1 to 40');
    }
  }

  const requiredRanges = [
    { passageIndex: 0, start: 1, end: 13 },
    { passageIndex: 1, start: 14, end: 26 },
    { passageIndex: 2, start: 27, end: 40 },
  ];

  requiredRanges.forEach(({ passageIndex, start, end }) => {
    const ids = passages[passageIndex].questions.map(q => q.id).sort((a, b) => a - b);
    const expected = Array.from({ length: end - start + 1 }, (_, i) => i + start);
    const isValid = ids.length === expected.length && ids.every((id, i) => id === expected[i]);
    if (!isValid) {
      throw new Error('Generated reading passage question distribution is invalid');
    }

    const missingAnswers = expected.filter(id => !passages[passageIndex].answerKey[id]);
    if (missingAnswers.length > 0) {
      throw new Error('Generated reading answer key is incomplete');
    }
  });

  if (passages.some(p => !p.text || p.text.length < 500)) {
    throw new Error('Generated reading passage text is too short');
  }

  return passages;
}

export async function generateWritingQuestions(difficulty = 'Band 6'): Promise<{ task1: WritingTask; task2: WritingTask }> {
  const content = await callNvidia(buildPrompt(difficulty), NVIDIA_MODEL);
  if (!content) {
    throw new Error('Empty Nvidia response');
  }

  let parsed: NvidiaChatResponse;
  try {
    const json = extractFirstJsonObject(content);
    parsed = JSON.parse(json) as NvidiaChatResponse;
  } catch {
    throw new Error('Failed to parse Nvidia response as JSON');
  }

  const normalizedTask1 = normalizeTask1(parsed.task1);
  const task1 = ensureValidTask(
    normalizedTask1.prompt,
    'task1',
    normalizedTask1.chartType,
    normalizedTask1.chartData,
  );
  const task2 = ensureValidTask(parsed.task2?.prompt, 'task2');

  return { task1, task2 };
}

export async function generateReadingPassages(difficulty = 'Band 6'): Promise<{ passages: ReadingPassage[] }> {
  const content = await callNvidia(buildReadingPrompt(difficulty), NVIDIA_READING_MODEL);

  let parsed: NvidiaReadingResponse;
  try {
    const json = extractFirstJsonObject(content);
    parsed = JSON.parse(json) as NvidiaReadingResponse;
  } catch {
    throw new Error('Failed to parse Nvidia reading response as JSON');
  }

  const normalized = Array.isArray(parsed?.passages)
    ? parsed.passages.map((passage, index) => normalizeReadingPassage(passage, index))
    : [];

  const passages = validateGeneratedReading(normalized);
  return { passages };
}
