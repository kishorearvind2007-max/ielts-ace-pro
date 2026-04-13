# IELTS Ace Pro

Practice platform for IELTS modules (Listening, Reading, Writing, Speaking) with AI-based evaluation flows.

## Environment

Create `.env.local` with:

```dotenv
NVIDIA_API_KEY="your-key"
NVIDIA_MODEL="stepfun-ai/step-3.5-flash"
NVIDIA_FALLBACK_MODEL="microsoft/phi-4-mini-flash-reasoning"
NVIDIA_WRITING_GEMMA_ENABLED="false"
NVIDIA_WRITING_GEMMA_MODEL="google/gemma-4-31b-it"
```

Set `NVIDIA_WRITING_GEMMA_ENABLED="true"` to try Gemma first for both Writing question generation and Writing evaluation.

## Writing Evaluation Flow

1. User completes Task 1 and Task 2 essays.
2. On `Submit Writing`, the app evaluates both essays via `/api/evaluate-writing`.
3. Model order:
	- Gemma first when enabled: `google/gemma-4-31b-it`
	- Primary: `stepfun-ai/step-3.5-flash`
	- Fallback: `microsoft/phi-4-mini-flash-reasoning`
4. If both model attempts fail, a final word-count fallback score is returned.
5. Results screen shows detailed marking for both writing tasks.

## Writing Question Generation Flow

1. The writing module requests `/api/generate-writing-questions`.
2. Model order follows the same chain as writing evaluation.
3. If all model attempts fail, the route returns static fallback questions from local content.
