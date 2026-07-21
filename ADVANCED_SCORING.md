# Advanced Reading Evaluation Engine

## Overview

The Reading module now features an **advanced evaluation engine** that goes beyond simple exact matching. It provides intelligent scoring with fuzzy matching, pattern recognition, detailed analytics, and personalized feedback.

## Features Implemented

### 1. **Fuzzy Matching (Spelling Tolerance)**
- Uses Levenshtein distance to detect misspellings
- Configurable similarity threshold (default: 85%)
- Automatically accepts answers with minor spelling errors
- Example: "accomodation" → "accommodation" (92% match) ✓

### 2. **Pattern-Based Matching**

#### Phone Numbers
Normalizes different formats:
- `07845-629-310` ≈ `07845 629 310` ≈ `07845629310` ✓

#### Numbers & Dates
Handles various numeric formats:
- `1,000` ≈ `1000` ✓
- `1st September` ≈ `1st of September` ✓
- `Sept 1` ≈ `September 1` ✓
- Supports ordinal suffixes (st, nd, rd, th)
- Supports month names (full & abbreviated)

### 3. **Time Tracking & Analytics**
- Tracks time spent on each question
- Calculates average time per question
- Identifies fastest/slowest questions
- Helps diagnose time management issues

### 4. **Question-Type Performance**
- Categorizes performance by question type (mcq, short-answer, true-false-ng, etc.)
- Shows accuracy percentage for each type
- Helps identify薄弱点 (weak spots)

### 5. **Detailed Results Display**
ResultsScreen now shows for Reading:
- **Accuracy percentage**
- **Average time per question**
- **Fastest & slowest questions**
- **Performance by question type** (bar chart with color coding)
- **Question-by-question breakdown** (expandable)
  - Shows user answer vs correct answer
  - Match method used (exact, fuzzy, date-normalized, etc.)
  - Time spent
  - Fuzzy similarity score (if applicable)

## Technical Implementation

### New Files
- `src/lib/advanced-scoring.ts` - Core advanced scoring engine
  - `answersMatch()` - Multi-strategy matching
  - `evaluateAnswersAdvanced()` - Full analytics pipeline
  - `analyzeWeaknesses()` - Pattern recognition & recommendations
  - `levenshteinDistance()` - Edit distance algorithm
  - `stringSimilarity()` - Normalized similarity score
  - Various normalizers (phone, number, date)

### Modified Files
- `src/components/ielts/ReadingModule.tsx`
  - Added time tracking with `useRef`
  - Tracks when each question is first viewed
  - Records time when answer changes
  - Uses `evaluateAnswersAdvanced()` instead of simple `scoreAnswers()`
  - Stores detailed results in `ModuleResult.detailedResults`

- `src/lib/ielts-types.ts`
  - Extended `ModuleResult` with:
    - `percentage?: number`
    - `detailedResults?: {...}`

- `src/components/ielts/ResultsScreen.tsx`
  - Added detailed analytics panel for Reading module
  - Shows performance metrics, time stats, question types
  - Expandable question-by-question breakdown
  - Color-coded accuracy indicators

## Usage

The advanced engine is **automatically enabled** for the Reading module. No configuration needed.

### For Developers

#### Using the Advanced Scorer Directly

```typescript
import {
  evaluateAnswersAdvanced,
  buildQuestionTypeMap,
} from '@/lib/advanced-scoring';

const result = evaluateAnswersAdvanced(
  userAnswers,      // Record<number, string>
  answerKey,        // Record<number, string>
  questionTypes,    // Record<number, string> (optional)
  questionTimes     // Record<number, number> (optional, seconds)
);

console.log(result);
// {
//   rawScore: 35,
//   totalQuestions: 40,
//   percentage: 87.5,
//   band: 7.0,
//   evaluations: [...],
//   questionTypes: { 'mcq': { correct: 10, total: 12 }, ... },
//   timeStats: { avgTimePerQuestion: 45.2, fastestQuestion: {...}, slowestQuestion: {...} }
// }
```

#### Answer Matching Strategies

The `answersMatch()` function supports multiple matching strategies:

1. **exact** - Case-insensitive exact match
2. **alternate** - Pipe-separated alternatives (e.g., "A|B|C")
3. **phone-normalized** - Phone numbers with formatting ignored
4. **numeric-normalized** - Numbers with commas/decimals normalized
5. **date-normalized** - Various date formats normalized
6. **fuzzy** - Spelling errors (if similarity ≥ 85%)
7. **none** - No match

## Backward Compatibility

The original `scoreAnswers()` function remains unchanged for backward compatibility. The advanced features are opt-in via `evaluateAnswersAdvanced()`.

## Performance

- Levenshtein distance: O(n*m) where n, m are string lengths
- For IELTS Reading (40 questions, short answers), negligible performance impact
- All calculations happen client-side before submission

## Future Enhancements

Potential additions:
- AI-powered semantic matching (word embeddings)
- Synonym detection using a dictionary
- Difficulty weighting (harder questions worth more)
- Historical performance comparison
- Personalized study recommendations based on weaknesses

## Testing

Run the demo: `npx tsx demo-advanced-scoring.mts`

This demonstrates all matching strategies and outputs sample analytics.
