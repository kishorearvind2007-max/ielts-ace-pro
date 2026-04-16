# IELTS Ace Pro

Practice platform for IELTS modules (Listening, Reading, Writing, Speaking) with AI-based evaluation flows.

## Environment

Create `.env.local` with:

```dotenv
NVIDIA_API_KEY="your-key"
NVIDIA_MODEL="mistralai/mistral-small-3.1-24b-instruct-2503"
NVIDIA_FALLBACK_MODEL="microsoft/phi-4-mini-flash-reasoning"
MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME="ielts_ace_pro"
JWT_SECRET="replace-with-a-long-random-secret"
GOOGLE_OAUTH_CLIENT_ID="google-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="google-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```

## Student Authentication

- Account creation requires `register number`, `email`, and `password`.
- Login supports:
	- Register number + password
	- Continue with Google OAuth (only for already-created accounts)
- Sessions are managed with secure httpOnly JWT cookies.
- Middleware protects app routes and redirects unauthenticated users to `/auth/login`.

## Writing Evaluation Flow

1. User completes Task 1 and Task 2 essays.
2. On `Submit Writing`, the app evaluates both essays via `/api/evaluate-writing`.
3. Model order:
	- Primary: `mistralai/mistral-small-3.1-24b-instruct-2503`
	- Fallback: `microsoft/phi-4-mini-flash-reasoning`
4. If both model attempts fail, a final word-count fallback score is returned.
5. Results screen shows detailed marking for both writing tasks.
