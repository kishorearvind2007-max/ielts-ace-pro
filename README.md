# IELTS Ace Pro

Practice platform for IELTS modules (Listening, Reading, Writing, Speaking) with AI-based evaluation flows.

## Environment

Create `.env.local` with:

```dotenv
NVIDIA_API_KEY="your-key"
NVIDIA_MODEL="stepfun-ai/step-3.5-flash"
NVIDIA_FALLBACK_MODEL="microsoft/phi-4-mini-flash-reasoning"
```

## Writing Evaluation Flow

1. User completes Task 1 and Task 2 essays.
2. On `Submit Writing`, the app evaluates both essays via `/api/evaluate-writing`.
3. Model order:
	- Primary: `stepfun-ai/step-3.5-flash`
	- Fallback: `microsoft/phi-4-mini-flash-reasoning`
4. If both model attempts fail, a final word-count fallback score is returned.
5. Results screen shows detailed marking for both writing tasks.
