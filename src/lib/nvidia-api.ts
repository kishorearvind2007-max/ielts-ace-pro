import { WritingTask } from '@/lib/ielts-types';

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

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? 'minimaxai/minimax-m2.1';
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

export async function generateWritingQuestions(difficulty = 'Band 6'): Promise<{ task1: WritingTask; task2: WritingTask }> {
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
      model: NVIDIA_MODEL,
      messages: [{ role: 'user', content: buildPrompt(difficulty) }],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nvidia API error: ${errorText}`);
  }

  const data = (await response.json()) as NvidiaChatResponseEnvelope;
  const content = readNonStreamingContent(data);
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
