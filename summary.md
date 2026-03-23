# IELTS Ace Pro - Project Summary

An AI-powered IELTS Academic test preparation platform built with Next.js 15 and TypeScript. The application delivers a complete mock test experience across all four IELTS modules with dynamic question generation and automated AI evaluation.

---

## 🎯 Project Overview

**Name:** IELTS Ace Pro
**Type:** Web Application (Next.js)
**Purpose:** IELTS Academic test practice with automated scoring
**Target Users:** Students preparing for IELTS Academic exam
**License:** Private

---

## 🏗 Technical Architecture

### Framework & Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript 5.8 |
| **Styling** | Tailwind CSS 3.4 + shadcn/ui |
| **State Management** | React Context + useReducer |
| **Data Fetching** | React Query 5.8 |
| **Animations** | Framer Motion 12 |
| **Package Manager** | Bun (primary), npm compatible |
| **Testing** | Jest + Playwright |

### AI Integrations

| Service | Use Case | Model |
|---------|----------|-------|
| **NVIDIA** | Question generation | minimax-m2.1, glm4.7 |
| **Anthropic** | Response evaluation | Claude Haiku 4.5 |

---

## 📁 Project Structure

```
ielts-ace-pro/
├── src/
│   ├── app/
│   │   ├── api/                    # Serverless API routes
│   │   │   ├── evaluate-speaking/  # Claude-powered speaking eval
│   │   │   ├── evaluate-writing/   # Claude-powered writing eval
│   │   │   ├── generate-reading-questions/  # NVIDIA reading gen
│   │   │   └── generate-writing-questions/  # NVIDIA writing gen
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Main app container
│   │   └── test/[module]/page.tsx # Module test pages
│   ├── components/
│   │   ├── ielts/                 # Core IELTS modules
│   │   │   ├── HomeScreen.tsx     # Module selection dashboard
│   │   │   ├── ListeningModule.tsx
│   │   │   ├── ReadingModule.tsx
│   │   │   ├── WritingModule.tsx
│   │   │   ├── SpeakingModule.tsx
│   │   │   ├── ResultsScreen.tsx  # Overall results display
│   │   │   ├── TestProvider.tsx   # Global state management
│   │   │   └── TopBar.tsx         # Navigation & timer
│   │   ├── ui/                     # shadcn/ui components (40+)
│   │   └── AppProviders.tsx
│   ├── hooks/
│   │   ├── use-anti-cheat.ts      # Tab switching detection
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── nvidia-api.ts          # NVIDIA integration + AI prompts
│   │   ├── ielts-types.ts         # TypeScript definitions
│   │   ├── scoring.ts             # Band score calculations
│   │   └── utils.ts               # Helper utilities
│   ├── data/
│   │   └── ielts-content.ts       # Static content samples
│   └── test/
│       ├── setup.ts
│       └── example.test.ts
├── public/                         # Static assets
├── .env.local                      # Local secrets (gitignored)
├── .env.example                    # Template for required env vars
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
├── jest.config.cjs
├── playwright.config.ts
└── README.md

Total: ~6500 lines of TypeScript/TSX code
```

---

## ✨ Key Features

### 1. Four IELTS Modules

| Module | Format | Questions | Time | AI Evaluation |
|--------|--------|-----------|------|---------------|
| **Listening** | Audio + script | 40 | 40 min | Auto-scored |
| **Reading** | 3 passages | 40 | 60 min | Auto-scored |
| **Writing** | 2 tasks | 2 | 60 min | Claude AI + fallback |
| **Speaking** | 3 parts | ~15 | 11-14 min | Claude AI |

### 2. Dynamic Content Generation

- **Writing Tasks:** AI generates unique Task 1 (charts/data) and Task 2 (essay prompts) on demand
- **Reading Tests:** AI creates full 3-passage tests with 40 questions (13/13/14 distribution)
- Content adapts to difficulty level (Band 6, 7, 8, etc.)
- Topics span standard IELTS domains: education, technology, environment, health, society

### 3. AI-Powered Evaluation

#### Writing Evaluation
- Claude Haiku assesses responses against official IELTS band descriptors
- Four criteria scored separately: Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range
- Returns band scores (0-9 in 0.5 increments), feedback, strengths, improvements
- Includes fallback heuristic scoring when API unavailable

#### Speaking Evaluation
- Claude analyzes full speaking transcript
- Evaluates Fluency & Coherence, Lexical Resource, Grammar, Pronunciation
- Provides holistic band score and detailed feedback

### 4. Authentic Test Experience

- **Timed Modules:** Built-in timer with start/pause functionality
- **Progressive Difficulty:** Questions typically increase in complexity
- **Realistic Interface:** Clean, distraction-free test UI
- **Navigation:** Question skipping, section jumping, answer review
- **Anti-Cheat:** Tab switching detection warns users

### 5. Comprehensive Results

- Individual module band scores
- Overall band score (average of 4 modules)
- CEFR level mapping (A1-C2)
- Band descriptor labels (e.g., "Competent User" for Band 6)
- Detailed examiner-style feedback per module
- Option to retake individual modules

---

## 🔄 Data Flow

### Question Generation Flow

```
User clicks "Start Writing"
    ↓
TestProvider → SET_MODULE('writing')
    ↓
WritingModule → useEffect()
    ↓
Calls src/lib/nvidia-api.ts → generateWritingQuestions(difficulty)
    ↓
POST to NVIDIA API with prompt specifying IELTS format
    ↓
Receives JSON response with task1 & task2
    ↓
Normalizes & validates data (task1: chart data, task2: essay topic)
    ↓
Displays tasks to user with timers and word counts
```

### Response Evaluation Flow

```
User submits writing/speaking response
    ↓
Client sends response to /api/evaluate-{type}
    ↓
API route validates input, calls Anthropic Claude
    ↓
System prompt instructs examiner behavior + JSON schema
    ↓
Claude returns evaluation in expected JSON format
    ↓
Route validates, parses, and returns to client
    ↓
Module displays band score and feedback
    ↓
Result stored in TestProvider state → available in ResultsScreen
```

### State Management

```typescript
TestState {
  phase: 'home' | 'instructions' | 'test' | 'results'
  currentModule: 'listening' | 'reading' | 'writing' | 'speaking' | null
  currentQuestion: number
  currentSection: number
  answers: Record<module, Record<questionId, answer>>
  writingResponses: { task1: string, task2: string }
  speakingTranscripts: { part1, part2, part3 }
  results: ModuleResult[] // Stores AI evaluations
  timerSeconds: number
  isTimerRunning: boolean
  apiKey: string // User-entered fallback key option
}
```

Actions: `SET_PHASE`, `SET_MODULE`, `SET_ANSWER`, `SET_WRITING`, `SET_SPEAKING_TRANSCRIPT`, `ADD_RESULT`, etc.

---

## 🎨 UI/UX Design

### Design System

- **Base:** Tailwind CSS utility classes
- **Components:** shadcn/ui (Radix UI primitives)
- **Theme:** Light/dark mode support via `next-themes`
- **Typography:** Custom heading font with gradient effects
- **Color Palette:**
  - Primary: Gold/amber gradient for IELTS branding
  - Success: Green for completion states
  - Cards: Subtle shadows with hover effects
  - Background: Neutral (dark mode capable)

### Responsive Layout

- Mobile-first breakpoints
- Grid layouts for module cards (1 col mobile, 2 col tablet+)
- Scrollable question panels
- Fixed navigation bars

### Accessibility

- Keyboard navigation support (Radix UI)
- ARIA labels on interactive elements
- Focus management between questions
- Screen reader friendly form inputs

---

## 🔐 Environment Variables

```bash
# Required for question generation
NVIDIA_API_KEY=your_nvidia_key_here
NVIDIA_MODEL=minimaxai/minimax-m2.1  # optional
NVIDIA_READING_MODEL=z-ai/glm4.7    # optional

# Required for response evaluation
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_MODEL=claude-haiku-4-5-20251001  # optional
```

**Security Note:** Never commit `.env.local`. Use `.env.example` as template.

---

## 🧪 Testing

### Unit Tests (Jest)

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

**Coverage:**
- `scoring.ts` - Band conversion algorithms
- `nvidia-api.ts` - Prompt building, JSON extraction, normalization
- Type definitions validation

### E2E Tests (Playwright)

```bash
npx playwright test
```

**Scenarios:**
- Complete full test flow across all modules
- API route mocking for AI responses
- UI behavior under test conditions
|-timer functionality

---

## 📦 Dependencies

### Production (26 packages)
- **Next.js 15.4** - React framework with App Router
- **React 18.3** - UI library
- **Tailwind 3.4** - CSS framework
- **Framer Motion 12** - Animations
- **React Query 5.8** - Server state
- **Zod 3.25** - Schema validation (in prompts)
- **shadcn/ui** - Component library (Radix-based)

### Development (15 packages)
- **TypeScript 5.8** - Type safety
- **ESLint 9** - Linting
- **Jest 29** - Unit tests
- **Playwright 1.57** - E2E tests
- **Husky** - Git hooks (if configured)

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
bun install
# or npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 3. Run Development Server

```bash
npm run dev
# → http://localhost:3000
```

### 4. Run Tests

```bash
npm test                    # Unit tests
npx playwright test         # E2E tests
npm run lint               # Lint check
```

### 5. Build for Production

```bash
npm run build
npm start
```

---

## 📊 Scoring Algorithms

### Listening & Reading

**Raw Score → Band Score:**

```typescript
raw >= 39 → 9.0
raw >= 37 → 8.5
raw >= 35 → 8.0
raw >= 33 → 7.5
raw >= 30 → 7.0
raw >= 27 → 6.5
raw >= 23 → 6.0
raw >= 19 → 5.5
raw >= 15 → 5.0
... (down to 2.0)
```

### Overall Band

```typescript
overall = roundIELTS( average(band_listening, band_reading, band_writing, band_speaking) )
rounding: <0.25 → floor, <0.75 → floor+0.5, else ceil
```

### CEFR Mapping

- C2: ≥8.5
- C1: ≥7.0
- B2: ≥5.5
- B1: ≥4.0
- A2: ≥2.5
- A1: <2.5

---

## 🎯 IELTS Band Descriptors (Reference)

### Expert User (9)
- Full operational command
- Accurate, fluent, appropriate

### Very Good User (8-8.5)
- Near-native fluency
- Minor occasional inaccuracies

### Good User (7-7.5)
- Handles complex language
- Occasional misunderstandings

### Competent User (6-6.5)
- Effective communication
- Some errors but meaning clear

### Modest User (5-5.5)
- Partial proficiency
- Frequent errors, limited range

### Limited User (4-4.5)
- Basic competence
- Frequent breakdowns

### Extremely Limited (3-3.5)
- Conveys only basic meaning

### Non User (1-2.5)
- Minimal ability

---

## ⚠️ Current Limitations

1. **Speaking Evaluation:** Audio-only; transcript-based AI scoring may miss pronunciation nuances
2. **Listening Questions:** No audio playback (text script only in current implementation)
3. **Reading Generation:** Requires validation; occasional format deviations from AI
4. **Offline Mode:** None; requires API calls for generation/evaluation
5. **Test Persistence:** No user accounts; progress lost on session reset
6. **Multiple Attempts:** No limitation; can retake modules infinitely (by design for practice)

---

## 🔮 Roadmap & Ideas

### Short-term
- [ ] Audio playback for Listening module (Web Speech API or audio files)
- [ ] Offline mode with cached sample tests
- [ ] Progress tracking dashboard
- [ ] Print/PDF export of results
- [ ] Word count warnings during writing

### Medium-term
- [ ] User authentication + profiles
- [ ] Test history and score trends
- [ ] Timed mode enforcement (no pause)
- [ ] Vocabulary builder from incorrect answers
- [ ] Band predictor before full test

### Long-term
- [ ] Mobile app (React Native)
- [ ] Speaking voice recording & upload
- [ ] Group comparison / percentile ranking
- [ ] Integration with official IELTS prep publishers
- [ ] Teacher/instructor dashboard for student tracking

---

## 📝 Development Notes

### Design Decisions

1. **Why NVIDIA for generation?** Cost-effective, fast inference; good for structured JSON output
2. **Why Claude for evaluation?** Strong instruction-following, reliable JSON, nuanced language assessment
3. **Why shadcn/ui?** Unlimited customization, Radix accessibility, low bundle size
4. **Why client-side state only?** Simplicity, no backend needed for single-user practice
5. **Why fallback scoring?** Ensures app works without expensive API; demo-friendly

### Known Issues

- Reading validation may reject valid AI generations if question distribution off by 1
- Speaking feedback less accurate without audio (inherent to transcript-only)
- No rate limiting on API routes (could lead to high costs)
- Timer not persisted on page refresh

---

## 📚 Documentation Files

- `README.md` - Project intro (minimal)
- `agents.md` - **AI agent specifications** (this doc's companion)
- `summary.md` - This file: overall project overview
- Code comments - Inline documentation in complex functions

---

## 🤝 Contributing

This is a private project. For modifications:

1. Follow TypeScript strict mode
2. Use existing component patterns from `src/components/ui/`
3. Keep state in TestProvider; avoid local state duplication
4. Always validate JSON schemas before using AI responses
5. Add tests for scoring logic changes
6. Keep prompts in sync with official IELTS band descriptors

---

**Created:** 2025-03-23
**Next.js Version:** 15.4.0
**TypeScript:** 5.8.3
**Status:** Active Development
