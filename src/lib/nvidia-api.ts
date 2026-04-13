import { ListeningSection, ReadingPassage, WritingTask } from '@/lib/ielts-types';

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

type NvidiaListeningSection = {
  id: number;
  title: string;
  script: string;
  questions: Array<{
    id: number;
    type: 'mcq' | 'short-answer' | 'true-false-ng';
    text: string;
    options?: string[];
  }>;
  answerKey: Record<string, string>;
  metadata?: {
    contentType?: 'conversation' | 'monologue' | 'academic' | 'lecture';
    estimatedDurationSeconds?: number;
    speakers?: string[];
  };
};

type NvidiaListeningResponse = {
  section?: NvidiaListeningSection;
} & Partial<NvidiaListeningSection>;

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? 'minimaxai/minimax-m2.1';
const NVIDIA_READING_MODEL = process.env.NVIDIA_READING_MODEL ?? 'moonshotai/kimi-k2-instruct-0905';
const NVIDIA_LISTENING_MODEL = process.env.NVIDIA_LISTENING_MODEL ?? NVIDIA_READING_MODEL;
const NVIDIA_FALLBACK_MODEL = process.env.NVIDIA_FALLBACK_MODEL ?? 'microsoft/phi-4-mini-flash-reasoning';
const NVIDIA_WRITING_GEMMA_ENABLED = process.env.NVIDIA_WRITING_GEMMA_ENABLED === 'true';
const NVIDIA_WRITING_GEMMA_MODEL = process.env.NVIDIA_WRITING_GEMMA_MODEL ?? 'google/gemma-4-31b-it';

const LISTENING_SECTION_CONFIG: Record<number, {
  contentType: 'conversation' | 'monologue' | 'academic' | 'lecture';
  titleHint: string;
  questionStart: number;
  questionEnd: number;
}> = {
  1: {
    contentType: 'conversation',
    titleHint: 'Everyday social conversation',
    questionStart: 1,
    questionEnd: 10,
  },
  2: {
    contentType: 'monologue',
    titleHint: 'Public information monologue',
    questionStart: 11,
    questionEnd: 20,
  },
  3: {
    contentType: 'academic',
    titleHint: 'Academic discussion',
    questionStart: 21,
    questionEnd: 30,
  },
  4: {
    contentType: 'lecture',
    titleHint: 'Academic lecture',
    questionStart: 31,
    questionEnd: 40,
  },
};
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

function getListeningSectionConfig(sectionNumber: number) {
  const config = LISTENING_SECTION_CONFIG[sectionNumber];
  if (!config) {
    throw new Error('Listening sectionNumber must be between 1 and 4');
  }
  return config;
}

function buildListeningPrompt(sectionNumber: number, difficulty: string) {
  const config = getListeningSectionConfig(sectionNumber);

  return `Generate IELTS Academic Listening content in JSON only.

Return JSON with this exact shape:
{
  "section": {
    "id": ${sectionNumber},
    "title": "...",
    "script": "...",
    "questions": [
      {
        "id": ${config.questionStart},
        "type": "mcq" | "short-answer" | "true-false-ng",
        "text": "...",
        "options": ["..."]
      }
    ],
    "answerKey": {
      "${config.questionStart}": "..."
    },
    "metadata": {
      "contentType": "${config.contentType}",
      "estimatedDurationSeconds": 240,
      "speakers": ["..."]
    }
  }
}

Strict constraints:
- Generate exactly one section for section ${sectionNumber}.
- Section style: ${config.contentType} (${config.titleHint}).
- Script must be realistic IELTS Listening style and around 180 to 260 words.
- Generate exactly 10 questions with ids ${config.questionStart} to ${config.questionEnd}.
- Use only these types: mcq, short-answer, true-false-ng.
- Include a mix of question types.
- For mcq, provide exactly 4 options.
- For true-false-ng, options must be exactly ["True", "False", "Not Given"].
- answerKey must contain all question ids from ${config.questionStart} to ${config.questionEnd}.
- Answers must be concise and must match the script.
- Difficulty level: ${difficulty}.

Return JSON only. No markdown, no extra text.`;
}

function buildModelChain(models: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  models.forEach(model => {
    const cleaned = model.trim();
    if (!cleaned || seen.has(cleaned)) {
      return;
    }
    seen.add(cleaned);
    output.push(cleaned);
  });
  return output;
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

async function callNvidiaWithFallback(content: string, models: string[]): Promise<{ content: string; model: string }> {
  const modelChain = buildModelChain(models);
  let lastError = 'Nvidia call failed';

  for (const model of modelChain) {
    try {
      const generated = await callNvidia(content, model);
      return { content: generated, model };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Nvidia call failed';
    }
  }

  throw new Error(lastError);
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

function normalizeListeningSection(rawSection: NvidiaListeningSection, sectionNumber: number): ListeningSection {
  const config = getListeningSectionConfig(sectionNumber);
  const sectionQuestions = Array.isArray(rawSection?.questions)
    ? rawSection.questions.map((q, questionIndex) => {
      const questionType = normalizeQuestionType(String(q?.type ?? 'short-answer'));
      const options = questionType === 'mcq'
        ? (Array.isArray(q?.options) ? q.options.slice(0, 4).map(opt => String(opt)) : []).filter(Boolean)
        : questionType === 'true-false-ng'
          ? ['True', 'False', 'Not Given']
          : undefined;

      return {
        id: Number(q?.id) || config.questionStart + questionIndex,
        type: questionType,
        text: String(q?.text ?? '').trim(),
        options,
        section: sectionNumber,
      };
    }).filter(q => q.text)
    : [];

  const answerKeyEntries = Object.entries(rawSection?.answerKey ?? {})
    .map(([key, value]) => [Number(key), String(value).trim()] as const)
    .filter(([key, value]) => Number.isFinite(key) && value.length > 0);

  const metadata = rawSection?.metadata ?? {};

  return {
    id: sectionNumber,
    title: String(rawSection?.title ?? '').trim() || `Section ${sectionNumber}`,
    script: String(rawSection?.script ?? '').trim(),
    questions: sectionQuestions,
    answerKey: Object.fromEntries(answerKeyEntries),
    source: 'nvidia',
    metadata: {
      contentType: config.contentType,
      estimatedDurationSeconds: Number(metadata.estimatedDurationSeconds) || undefined,
      speakers: Array.isArray(metadata.speakers)
        ? metadata.speakers.map(name => String(name).trim()).filter(Boolean)
        : undefined,
    },
  };
}

function validateGeneratedListening(section: ListeningSection, sectionNumber: number): ListeningSection {
  const config = getListeningSectionConfig(sectionNumber);

  if (!section.script || section.script.length < 120) {
    throw new Error('Generated listening script is too short');
  }

  const questionIds = section.questions.map(question => question.id).sort((a, b) => a - b);
  if (questionIds.length !== 10) {
    throw new Error('Generated listening section must contain exactly 10 questions');
  }

  const expectedIds = Array.from({ length: 10 }, (_, index) => config.questionStart + index);
  const isValidDistribution = questionIds.every((id, index) => id === expectedIds[index]);
  if (!isValidDistribution) {
    throw new Error('Generated listening question ids are invalid');
  }

  section.questions.forEach(question => {
    if (question.type === 'mcq' && (question.options?.length ?? 0) !== 4) {
      throw new Error('Generated listening mcq questions must contain exactly 4 options');
    }
    if (question.type === 'true-false-ng') {
      const expected = ['True', 'False', 'Not Given'];
      const current = question.options ?? [];
      const isValid = current.length === expected.length && current.every((option, index) => option === expected[index]);
      if (!isValid) {
        throw new Error('Generated listening true-false-ng options are invalid');
      }
    }
  });

  const missingAnswers = expectedIds.filter(id => !section.answerKey[id]);
  if (missingAnswers.length > 0) {
    throw new Error('Generated listening answer key is incomplete');
  }

  return section;
}

export async function generateWritingQuestions(
  difficulty = 'Band 6',
): Promise<{ task1: WritingTask; task2: WritingTask; modelUsed: string }> {
  const { content, model } = await callNvidiaWithFallback(buildPrompt(difficulty), [
    NVIDIA_WRITING_GEMMA_ENABLED ? NVIDIA_WRITING_GEMMA_MODEL : '',
    NVIDIA_MODEL,
    NVIDIA_FALLBACK_MODEL,
  ]);
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

  return { task1, task2, modelUsed: model };
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

export async function generateListeningSection(
  sectionNumber: number,
  difficulty = 'Band 6',
): Promise<{ section: ListeningSection; modelUsed: string }> {
  getListeningSectionConfig(sectionNumber);
  const prompt = buildListeningPrompt(sectionNumber, difficulty);

  const { content, model } = await callNvidiaWithFallback(prompt, [
    NVIDIA_LISTENING_MODEL,
    NVIDIA_FALLBACK_MODEL,
  ]);

  let parsed: NvidiaListeningResponse;
  try {
    const json = extractFirstJsonObject(content);
    parsed = JSON.parse(json) as NvidiaListeningResponse;
  } catch {
    throw new Error('Failed to parse Nvidia listening response as JSON');
  }

  const rawSection = (parsed.section ?? parsed) as NvidiaListeningSection;
  const normalized = normalizeListeningSection(rawSection, sectionNumber);
  const section = validateGeneratedListening(normalized, sectionNumber);

  return { section, modelUsed: model };
}
