# Test Craft

Practice platform for IELTS modules (Listening, Reading, Writing, Speaking) with AI-based evaluation flows.

## Environment

Create `.env.local` with:

```dotenv
NVIDIA_API_KEY="your-key"
NVIDIA_MODEL="mistralai/mistral-small-3.1-24b-instruct-2503"
NVIDIA_READING_MODEL="moonshotai/kimi-k2-instruct-0905"
NVIDIA_SPEAKING_MODEL="moonshotai/kimi-k2-instruct-0905"
NVIDIA_FALLBACK_MODEL="microsoft/phi-4-mini-flash-reasoning"
NVIDIA_WRITING_GEMMA_ENABLED="false"
NVIDIA_WRITING_GEMMA_MODEL="google/gemma-4-31b-it"
MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME="ielts_ace_pro"
JWT_SECRET="replace-with-a-long-random-secret"
GOOGLE_OAUTH_CLIENT_ID="google-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="google-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```

Set `NVIDIA_WRITING_GEMMA_ENABLED="true"` to try Gemma first for both Writing question generation and Writing evaluation.

## Student Authentication

- Account creation requires `register number`, `email`, and `password`.
- Login supports:
	- Register number + password
	- Continue with Google OAuth (only for already-created accounts)
- Sessions are managed with secure httpOnly JWT cookies.
- Middleware protects app routes and redirects unauthenticated users to `/auth/login`.

## Certificate Preview and Download

- Certificate preview (`/api/certificates/preview/:certificateId`) is generated from a shared HTML renderer.
- Certificate download (`/api/certificates/download/:certificateId`) now uses Playwright (headless Chromium) to export that same HTML as PDF, ensuring download format and font styling match preview as closely as possible.
- If Chromium cannot be launched in the runtime environment, the backend falls back to the existing pdf-lib generator so downloads still succeed.

## Writing Evaluation Flow

1. User completes Task 1 and Task 2 essays.
2. On `Submit Writing`, the app evaluates both essays via `/api/evaluate-writing`.
3. Model order:
	- Gemma first when enabled: `google/gemma-4-31b-it`
	- Primary: `mistralai/mistral-small-3.1-24b-instruct-2503`
	- Fallback: `microsoft/phi-4-mini-flash-reasoning`
4. If both model attempts fail, a final word-count fallback score is returned.
5. Results screen shows detailed marking for both writing tasks.

## Writing Question Generation Flow

1. The writing module requests `/api/generate-writing-questions`.
2. Model order follows the same chain as writing evaluation.
3. If all model attempts fail, the route returns static fallback questions from local content.

## Speaking Flow

1. The speaking module requests `/api/generate-speaking-questions` at module start.
2. NVIDIA generates Part 1, Part 2 cue card, and Part 3 prompts with static fallback on failure.
3. Submission sends full transcript to `/api/evaluate-speaking`.
4. Speaking evaluation returns normalized criterion scores with deterministic fallback when AI is unavailable.
5. The app stores `speakingResult` in localStorage and opens the dedicated speaking report page.
