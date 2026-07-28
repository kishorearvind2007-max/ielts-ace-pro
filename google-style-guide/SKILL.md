---
name: google-style-guide
description: >
  Enforce Google's official style guides for TypeScript, JavaScript, HTML, and CSS
  to produce clean, readable, production-quality code. Use this skill for ALL code
  generation, editing, and review tasks — any time you write or modify TypeScript,
  JavaScript, TSX/JSX, HTML, or CSS files. This skill reduces hallucination by
  grounding every coding decision in Google's concrete, well-documented conventions
  instead of ad-hoc patterns. Trigger this skill whenever the user asks you to write
  code, fix code, refactor code, review code, add features, build components, create
  APIs, or make any source code changes. Even if the user doesn't explicitly mention
  "style" or "formatting", always follow these rules.
---

# Google Style Guide — Coding Standards

This skill enforces Google's official style guides to produce consistent, readable,
production-quality code. Every code change — new files, edits, refactors, fixes —
follows these rules.

The goal is twofold:
1. **Readability**: Consistent patterns make code scannable and reduce cognitive load.
2. **Reduce hallucination**: Concrete rules prevent the agent from inventing ad-hoc
   patterns. When there's a Google convention, use it — don't improvise.

For detailed language-specific rules, read the appropriate reference file:
- `references/typescript.md` — TypeScript & JavaScript rules (primary)
- `references/html-css.md` — HTML & CSS rules
- `references/react-nextjs.md` — React & Next.js conventions for this project

---

## Core Principles (All Languages)

### 1. Naming Conventions

| Construct | Style | Example |
|-----------|-------|---------|
| Local variables, parameters, functions | `camelCase` | `getUserName`, `isValid` |
| Global/module-level constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Classes, interfaces, type aliases, enums | `PascalCase` | `UserProfile`, `ReadingPassage` |
| Enum members | `PascalCase` | `TaskType.Essay`, `Band.Six` |
| Type parameters | Single uppercase letter or `PascalCase` | `T`, `ResponseType` |
| File names (components) | `kebab-case` | `user-profile.tsx`, `scoring.ts` |
| Private class members | No underscore prefix; use `private` keyword | `private count = 0` |
| Boolean variables/params | Use `is`, `has`, `should`, `can` prefix | `isLoading`, `hasError` |

**Never use abbreviations** that would be ambiguous. Write `button` not `btn`,
`message` not `msg`, `document` not `doc` — unless the abbreviation is universally
understood (e.g., `URL`, `HTML`, `ID`).

### 2. File Structure (in order)

Every TypeScript/JavaScript file follows this structure:
1. Copyright/license comment (if present)
2. `@fileoverview` JSDoc (if present)
3. Imports (grouped: external packages → internal modules → relative imports)
4. Module-level constants and types
5. The file's implementation (functions, classes, components)
6. Exports (prefer named exports at declaration site)

Separate each section with **exactly one blank line**.

### 3. Imports

```typescript
// ✅ GOOD: Named imports, grouped logically
import {useState, useEffect} from 'react';
import {NextResponse} from 'next/server';

import type {ReadingPassage, WritingTask} from '@/lib/ielts-types';
import {generateWritingQuestions} from '@/lib/nvidia-api';
import {calculateBand} from './scoring';
```

Rules:
- Use **named imports** `{Foo}` — not default imports — for consistency.
  Exception: framework defaults like `React`, `NextResponse` where required.
- Use `import type {...}` when importing only types.
- Sort imports: third-party packages first, then `@/` aliases, then relative.
- Limit `../../../` depth — use path aliases (`@/`) instead.
- Never use `require()` or `namespace`.

### 4. Variables & Constants

```typescript
// ✅ GOOD
const maxRetries = 3;                    // const for values that never change
let currentAttempt = 0;                  // let only when reassignment is needed
const API_URL = 'https://example.com';   // UPPER_SNAKE for true constants

// ❌ BAD
var count = 0;                           // Never use var
let name = 'fixed';                      // Use const if never reassigned
```

- Always use `const` unless reassignment is needed, then use `let`.
- **Never use `var`** — its function-scoping causes subtle bugs.
- One variable per declaration — no `let a = 1, b = 2;`.

### 5. Type System (TypeScript)

```typescript
// ✅ GOOD: Use interfaces for object shapes, type for unions/intersections
interface UserProfile {
  id: string;
  name: string;
  score: number;
  isActive: boolean;
}

type TaskType = 'essay' | 'report' | 'letter';
type ApiResponse = SuccessResponse | ErrorResponse;

// ✅ GOOD: Annotate return types for public/exported functions
export function calculateBand(scores: number[]): number {
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 2) / 2;
}

// ✅ GOOD: Use type narrowing, not type assertions
if (response.status === 'success') {
  // TypeScript now knows response is SuccessResponse
  handleSuccess(response.data);
}
```

Rules:
- **Annotate return types** on exported functions — helps readers and catches bugs.
- **Don't use `any`** — use `unknown` and narrow with type guards. If `any` is
  truly unavoidable, add a `// eslint-disable-next-line` with a comment explaining why.
- **Don't use type assertions** (`as Foo`) except in tests or when provably safe.
  Prefer type guards and narrowing.
- Use `interface` for object shapes that may be extended.
  Use `type` for unions, intersections, and mapped types.
- **Don't use `!` (non-null assertion)** without an explanatory comment.
- Use `readonly` for properties that should not be reassigned after construction.

### 6. Functions

```typescript
// ✅ GOOD: Arrow functions for callbacks, function declarations for top-level
export function evaluateWriting(essay: string, taskType: string): EvaluationResult {
  const wordCount = countWords(essay);
  const scores = CRITERIA.map((criterion) => scoreCriterion(essay, criterion));
  return buildResult(scores, wordCount);
}

// ✅ GOOD: Arrow functions for short callbacks
const activeUsers = users.filter((user) => user.isActive);

// ✅ GOOD: Object destructuring for options
function createPassage({title, content, questionCount = 13}: PassageOptions): Passage {
  // ...
}
```

Rules:
- Use `function` declarations for top-level / exported functions (they're hoisted
  and have clear names in stack traces).
- Use arrow functions `() => ...` for callbacks and inline functions.
- **Don't use `arguments`** — use rest parameters `...args` instead.
- Use parameter destructuring for functions with many options.
- Keep functions focused — one function, one job. If a function exceeds ~40 lines,
  consider splitting it.

### 7. Control Structures

```typescript
// ✅ GOOD: Braces always required, even for single-line
if (score >= 7) {
  return 'Excellent';
}

// ✅ GOOD: Use for...of for arrays, Object.entries for objects
for (const passage of passages) {
  validatePassage(passage);
}
for (const [key, value] of Object.entries(config)) {
  applyConfig(key, value);
}

// ❌ BAD: Don't use for...in without filtering
for (const key in obj) { /* might include prototype props */ }
```

Rules:
- Always use braces `{}` for `if`, `for`, `while` — even single statements.
- Use `for...of` for iterables. Use `Object.keys()` / `Object.entries()` for objects.
- Don't use unfiltered `for...in` — it includes prototype properties.
- Prefer early returns over deep nesting.

### 8. Error Handling

```typescript
// ✅ GOOD: Specific error handling with context
try {
  const result = await generateQuestions(difficulty);
  return NextResponse.json(result);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('[generate-questions] Failed:', message);
  return NextResponse.json({error: message}, {status: 500});
}
```

Rules:
- Type catch parameters as `unknown`, then narrow with `instanceof`.
- Include context in error messages — what operation failed and why.
- Don't swallow errors silently — at minimum, log them.
- Use descriptive error messages that help debugging.

### 9. Comments & Documentation

```typescript
// ✅ GOOD: JSDoc for exported functions
/**
 * Calculates the IELTS band score from individual criterion scores.
 * Uses the official IELTS rounding rule (round to nearest 0.5).
 *
 * @param scores - Array of scores (0-9) for each criterion
 * @returns The overall band score, rounded to the nearest 0.5
 */
export function calculateOverallBand(scores: number[]): number { ... }

// ✅ GOOD: Inline comment explaining WHY, not WHAT
// IELTS rounds to nearest 0.5 — multiply by 2, round, divide by 2
const rounded = Math.round(raw * 2) / 2;

// ❌ BAD: Restating the code
// Increment counter by 1
counter++;
```

Rules:
- Use `/** JSDoc */` for all exported functions, classes, interfaces, and types.
- Write comments that explain **why**, not **what** — the code shows *what*.
- Use `// TODO: description` for action items (no other formats like `@@`).
- Don't leave commented-out code — remove it (version control has history).
- Keep JSDoc parameter descriptions concise — one line per param.

### 10. Formatting & Whitespace

- **Indentation**: 2 spaces (no tabs).
- **Line length**: Aim for 80 characters; hard limit at 100.
- **Trailing commas**: Use them in multi-line arrays, objects, and parameter lists
  (helps with cleaner git diffs).
- **Semicolons**: Always use them.
- **Quotes**: Single quotes `'` for strings; template literals `` ` `` for interpolation.
- **Blank lines**: One blank line between logical sections. Two blank lines between
  top-level declarations is acceptable. Never more than two consecutive blank lines.
- **Trailing whitespace**: Remove it — it complicates diffs.
- **Braces**: Opening brace on the same line (`if (x) {`, not next line).

---

## Anti-Hallucination Rules

These rules specifically prevent the AI agent from generating unreliable code:

1. **Don't invent APIs** — if you're unsure whether a function/method exists, check
   the codebase or documentation first. Never assume an API exists.

2. **Don't guess import paths** — verify the actual file path before writing an import.
   Use `@/` path aliases as configured in `tsconfig.json`.

3. **Don't fabricate types** — if a type isn't defined, define it explicitly or use
   existing types from the codebase. Don't use `any` to paper over uncertainty.

4. **Match existing patterns** — before creating a new component, API route, or utility,
   check how similar ones are structured in the project. Follow the same pattern.

5. **Use exact library APIs** — don't assume a library has a method. If using Zod, React
   Hook Form, Radix, Framer Motion, etc., use their actual documented API.

6. **Preserve existing code** — when modifying files, keep all existing comments,
   docstrings, and unrelated code intact. Don't silently remove things.

7. **Don't over-abstract** — write concrete code that solves the actual problem. Don't
   create unnecessary abstraction layers, wrapper functions, or generic utilities
   unless the user specifically asks for them.

8. **Verify before claiming** — if you say "this function does X", make sure it actually
   does X. Read the implementation, don't guess from the name.

---

## Quick Reference Checklist

Before writing or modifying any code, verify:

- [ ] Named exports (no `export default` except where frameworks require it)
- [ ] `const` / `let` only (never `var`)
- [ ] `import type` for type-only imports
- [ ] Explicit return types on exported functions
- [ ] `unknown` instead of `any` (with type narrowing)
- [ ] JSDoc on exported symbols
- [ ] Error messages include context
- [ ] No trailing whitespace, 2-space indentation
- [ ] Single quotes for strings
- [ ] Trailing commas in multi-line constructs
- [ ] Braces on all control structures
- [ ] Import paths verified against actual file structure
