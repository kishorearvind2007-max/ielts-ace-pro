
# IELTS Ace Pro - AI Agents Documentation

This document describes all AI agent integrations and their roles in the IELTS Ace Pro application.

## Overview

IELTS Ace Pro uses multiple AI service providers to deliver dynamic content generation and automated evaluation:

- **NVIDIA AI** - Question generation for Writing and Reading modules
- **Anthropic Claude** - Response evaluation for Writing and Speaking modules

Both integrations run through secure server-side API routes to protect API keys and enable proper validation.

---

## 1. NVIDIA API Agent

**Location:** `src/lib/nvidia-api.ts`

**Purpose:** Generates IELTS Academic Writing tasks and Reading passages on demand.

### Configuration

```typescript
NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? 'minimaxai/minimax-m2.1'
NVIDIA_READING_MODEL = process.env.NVIDIA_READING_MODEL ?? 'z-ai/glm4.7'
```

Required environment variable: `NVIDIA_API_KEY`

### Functions

#### `generateWritingQuestions(difficulty?: string)`

Generates IELTS Academic Writing Task 1 and Task 2.

**Parameters:**
- `difficulty` (optional): Target band level (e.g., "Band 6", "Band 7+"). Default: "Band 6"

**Returns:**
```typescript
{
  task1: WritingTask, // Chart/graph description task
  task2: WritingTask  // Essay task
}
```

**Prompt Structure:**
- Requests JSON-only response with specific schema
- Task 1: Includes chart type (bar/line/pie/table/process/map) and data
- Task 2: Essay prompts covering opinion, discussion, problem-solution, etc.
- Topics from: Education, Technology, Environment, Health, Economy, Transportation, Society, Government, Culture

#### `generateReadingPassages(difficulty?: string)`

Generates complete IELTS Academic Reading test with 3 passages and 40 questions.

**Parameters:**
- `difficulty` (optional): Target band level. Default: "Band 6"

**Returns:**
```typescript
{
  passages: ReadingPassage[] // Array of 3 passages
}
```

**Constraints:**
- Exactly 3 passages (IDs 1, 2, 3)
- Total 40 questions across all passages
- Passage 1: 13 questions (Q1-13)
- Passage 2: 13 questions (Q14-26)
- Passage 3: 14 questions (Q27-40)
- Each passage: 650-850 words
- Domains: science, environment, education, health, technology, history, society
- Question types: MCQ, True-False-Not Given, Short Answer
- MCQ options: exactly 4 choices
- True-False-Not Given options: ["True", "False", "Not Given"]

**Data Normalization:**
- `normalizeTask1()` - Validates and structures Task 1 data
- `normalizeReadingPassage()` - Standardizes passage/question formats
- `validateGeneratedReading()` - Ensures compliance with IELTS structure

---

## 2. Anthropic Claude API Agent

**Purpose:** Evaluates user responses for Writing and Speaking modules using official IELTS band descriptors.

**Configuration:**
- API endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-haiku-4-5-20251001` (configurable via `ANTHROPIC_MODEL`)
- Required env var: `ANTHROPIC_API_KEY`

### 2.1 Writing Evaluation Agent

**Route:** `src/app/api/evaluate-writing/route.ts`

**Endpoint:** `POST /api/evaluate-writing`

**Request Body:**
```typescript
{
  "taskText": string,    // User's written response
  "taskType": string     // "Task 1" or "Task 2"
}
```

**Evaluation Criteria:**

The agent evaluates across four official IELTS Writing dimensions:

1. **Task Achievement** - Task completion, position, development
2. **Coherence & Cohesion** - Organization, linking, paragraphing
3. **Lexical Resource** - Vocabulary range, collocations, spelling
4. **Grammatical Range & Accuracy** - Sentence structures, tenses, errors

**Response Format:**
```typescript
{
  task_achievement: { band: number, feedback: string, examples: string[] },
  coherence_cohesion: { band: number, feedback: string, examples: string[] },
  lexical_resource: { band: number, feedback: string, examples: string[] },
  grammatical_range: { band: number, feedback: string, examples: string[] },
  overall_band: number,
  word_count: number,
  strengths: string[],
  improvements: string[],
  examiner_comment: string,
  evaluation_mode: "ai" | "fallback"
}
```

**Fallback Mode:**

If `ANTHROPIC_API_KEY` is missing or the API fails, the system uses a heuristic fallback:

- Estimates band based on word count
  - Task 1: 150+ = 6.0, 230+ = 7.0, <105 = 4.0
  - Task 2: 250+ = 6.0, 330+ = 7.0, <175 = 4.0
- Provides generic feedback encouraging development
- Safe for demo/development without API key

### 2.2 Speaking Evaluation Agent

**Route:** `src/app/api/evaluate-speaking/route.ts`

**Endpoint:** `POST /api/evaluate-speaking`

**Request Body:**
```typescript
{
  "fullTranscript": string // Combined speaking test transcript
}
```

**Evaluation Criteria:**

Assesses across four IELTS Speaking dimensions:

1. **Fluency & Coherence** - Speaking rate, linking, logical flow
2. **Lexical Resource** - Vocabulary range, idiomatic language
3. **Grammatical Range** - Sentence structures, tenses, accuracy
4. **Pronunciation** - Clarity, intonation, stress (inferred from transcript)

**Response Format:**
```typescript
{
  fluency_coherence: { band: number, feedback: string, examples: string[] },
  lexical_resource: { band: number, feedback: string, examples: string[] },
  grammatical_range: { band: number, feedback: string, examples: string[] },
  pronunciation: { band: number, feedback: string, inferred_from: string },
  overall_band: number,
  strengths: string[],
  improvements: string[],
  examiner_comment: string
}
```

**Note:** Speaking evaluation relies on transcript analysis, which has inherent limitations compared to audio analysis.

---

## 3. System Prompts

### Writing Prompt

```
You are a certified IELTS examiner with 10+ years of experience.
Evaluate the following [Task Type] response strictly according to official IELTS Writing Band Descriptors.

Return JSON with exact schema including:
- Four criterion bands (0.0-9.0 in 0.5 increments)
- Overall band
- Word count
- Specific feedback with examples from the text
- Identified strengths
- Targeted improvement suggestions
- Examiner-style summary comment
```

### Speaking Prompt

```
You are a certified IELTS Speaking examiner.
Evaluate the transcript according to official IELTS Speaking Band Descriptors.

Return JSON with:
- Four criterion bands (Fluency, Lexical, Grammar, Pronunciation)
- Overall band
- Strengths and improvements
- Examiner comment
```

---

## 4. Security & Architecture

### API Key Protection

- All AI calls happen server-side in Next.js API routes
- Environment variables never exposed to client
- Client only communicates with application's own API endpoints

### Error Handling

- **Writing Fallback:** Provides reasonable heuristic scoring if Claude API unavailable
- **Speaking No Fallback:** Returns error (transcript-only evaluation needs AI)
- **Input Validation:** Enforces schema validation on all requests
- **Response Parsing:** Extracts JSON from markdown code blocks if needed

### Rate Limits & Monitoring

Currently no explicit rate limiting. Consider adding:
- Per-user quotas
- Request deduplication
- Response caching for repeated prompts

---

## 5. Testing Strategy

### Unit Tests (Jest)

- `scoring.ts` - Band conversion functions
- `nvidia-api.ts` - Prompt builders, response parsers, normalizers
- `ielts-types.ts` - Type definitions

### Integration Tests (Playwright)

- Full test flow through API routes with mocked AI responses
- End-to-end user journeys across all four modules

### Manual Testing

- Use `.env.local` with real API keys
- Test each endpoint with Postman or curl
- Validate JSON response schemas

---

## 6. Future Improvements

### Potential Agents

1. **Listening Answer Evaluation** - Currently auto-scored only
2. **Reading Auto-Evaluation** - Explain incorrect answers with AI tutoring
3. **Grammar Checker** - Pre-submission writing analysis
4. **Speaking Pronunciation Coach** - Audio-based pronunciation feedback
5. **Personalized Study Plan Generator** - Weakness analysis → study recommendations

### Enhancements

- Streaming responses for faster perceived performance
- Multi-model fallback chains (Claude → GPT → fallback)
- Response caching for similar prompts
- Async evaluation with notifications (avoid blocking)
- A/B testing different prompt engineering

---

## 7. Related Files

| Agent | Route | Library | Tests |
|-------|-------|---------|-------|
| Writing Evaluator | `/api/evaluate-writing` | Anthropic Claude | - |
| Speaking Evaluator | `/api/evaluate-speaking` | Anthropic Claude | - |
| Writing Generator | `/api/generate-writing-questions` | NVIDIA | - |
| Reading Generator | `/api/generate-reading-questions` | NVIDIA | - |
| Core Library | `src/lib/nvidia-api.ts` | NVIDIA | - |
| Scoring Utils | `src/lib/scoring.ts` | - | `src/test/example.test.ts` |

---

**Last Updated:** 2025-03-23
