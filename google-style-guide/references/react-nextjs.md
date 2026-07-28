# React & Next.js Conventions — Project Reference

This reference documents React and Next.js patterns specific to this project
(IELTS Ace Pro), aligned with Google TypeScript style.

Read this reference when building React components, pages, API routes, or hooks.

---

## Table of Contents

1. [Component Patterns](#component-patterns)
2. [Next.js App Router](#nextjs-app-router)
3. [API Routes](#api-routes)
4. [State Management](#state-management)
5. [Hooks](#hooks)
6. [Testing](#testing)

---

## Component Patterns

### Function Components Only

Always use function components — never class components.

```tsx
// ✅ GOOD: Function component with explicit props interface
interface ScoreBadgeProps {
  score: number;
  label: string;
  variant?: 'success' | 'warning' | 'danger';
}

export function ScoreBadge({score, label, variant = 'success'}: ScoreBadgeProps) {
  return (
    <div className={cn('rounded-full px-3 py-1', variantStyles[variant])}>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-lg font-bold">{score}</span>
    </div>
  );
}
```

### Props Interface Rules

- Define a named `interface` for props — name it `ComponentNameProps`.
- Destructure props in the function signature.
- Provide default values for optional props in the destructuring.
- Use `children?: React.ReactNode` for components that accept children.
- Don't use `React.FC` — it adds an implicit `children` prop and has other quirks.

```tsx
// ❌ BAD
const Card: React.FC<{title: string}> = ({title, children}) => { ... }
export default Card;

// ✅ GOOD
interface CardProps {
  title: string;
  children?: React.ReactNode;
}

export function Card({title, children}: CardProps) { ... }
```

### Component File Structure

Each component file follows this order:
1. Imports
2. Types/interfaces (component-specific)
3. Constants (component-specific)
4. The component function (exported)
5. Helper functions (non-exported, below the component)

### Conditional Rendering

```tsx
// ✅ GOOD: Clear conditional patterns
{isLoading && <Spinner />}
{error ? <ErrorMessage error={error} /> : <Results data={data} />}
{items.length > 0 && (
  <ul>
    {items.map((item) => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
)}
```

### Key Prop

- Always provide a stable, unique `key` when rendering lists.
- **Never use array index as key** unless the list is static and never reordered.
- Prefer IDs from data: `key={passage.id}`, `key={question.questionNumber}`.

### Event Handlers

Name event handlers with the `handle` prefix:

```tsx
function SearchForm() {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // ...
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ...
  };

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleInputChange} />
    </form>
  );
}
```

---

## Next.js App Router

### File Naming

Next.js App Router uses specific file conventions:
- `page.tsx` — Route page component
- `layout.tsx` — Layout wrapper
- `loading.tsx` — Loading UI
- `error.tsx` — Error boundary
- `not-found.tsx` — 404 page
- `route.ts` — API route handler

These are the **only** files that use `export default` — Next.js requires it.

### Page Components

```tsx
// src/app/dashboard/page.tsx

interface DashboardPageProps {
  searchParams: Promise<{tab?: string}>;
}

export default async function DashboardPage({searchParams}: DashboardPageProps) {
  const {tab = 'overview'} = await searchParams;
  return (
    <main className="container mx-auto p-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <DashboardTabs activeTab={tab} />
    </main>
  );
}
```

### Client vs Server Components

- Components are **Server Components by default** in App Router.
- Add `'use client'` only when the component needs:
  - `useState`, `useEffect`, `useRef`, or other React hooks
  - Browser APIs (`window`, `document`, `localStorage`)
  - Event handlers (`onClick`, `onChange`, etc.)
  - Third-party client libraries (Framer Motion, Recharts)
- Keep `'use client'` boundaries as low in the tree as possible.

```tsx
// ✅ GOOD: Only the interactive part is a client component
// components/search-bar.tsx
'use client';

import {useState} from 'react';

export function SearchBar() {
  const [query, setQuery] = useState('');
  // ...
}
```

### Metadata

Use the `metadata` export or `generateMetadata` function for SEO:

```tsx
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Reading Test | IELTS Ace Pro',
  description: 'Practice IELTS Academic Reading with AI-generated passages',
};
```

---

## API Routes

### Structure

```typescript
// src/app/api/evaluate-writing/route.ts
import {NextRequest, NextResponse} from 'next/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate input
    if (!body.essay || typeof body.essay !== 'string') {
      return NextResponse.json(
        {error: 'Missing required field: essay'},
        {status: 400},
      );
    }

    // Process
    const result = await evaluateEssay(body.essay, body.taskType);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[evaluate-writing] Error:', message);
    return NextResponse.json({error: message}, {status: 500});
  }
}
```

### API Route Rules

- Always validate request body before processing.
- Return proper HTTP status codes (400 for bad input, 500 for server errors).
- Include descriptive error messages.
- Log errors with context (`[route-name] Error: ...`).
- Type the catch parameter as `unknown` and narrow with `instanceof`.
- Never expose internal details (stack traces, API keys) in responses.

---

## State Management

### Local State

Use `useState` for component-local state:

```tsx
const [isOpen, setIsOpen] = useState(false);
const [scores, setScores] = useState<number[]>([]);
```

### Complex State

Use `useReducer` for complex state with multiple related values:

```tsx
interface TestState {
  currentQuestion: number;
  answers: Map<number, string>;
  timeRemaining: number;
  isSubmitted: boolean;
}

type TestAction =
  | {type: 'ANSWER_QUESTION'; questionId: number; answer: string}
  | {type: 'NEXT_QUESTION'}
  | {type: 'TICK'}
  | {type: 'SUBMIT'};

function testReducer(state: TestState, action: TestAction): TestState {
  switch (action.type) {
    case 'ANSWER_QUESTION':
      return {
        ...state,
        answers: new Map(state.answers).set(action.questionId, action.answer),
      };
    // ... other cases
  }
}
```

### Server State

Use React Query (`@tanstack/react-query`) for server state:

```tsx
const {data, isLoading, error} = useQuery({
  queryKey: ['writing-questions', difficulty],
  queryFn: () => fetchWritingQuestions(difficulty),
});
```

---

## Hooks

### Custom Hook Naming

All custom hooks start with `use`:

```tsx
// ✅ GOOD
export function useTimer(initialSeconds: number) { ... }
export function useTestProgress(testId: string) { ... }

// ❌ BAD
export function getTimer() { ... }       // Not a hook name
export function timerHook() { ... }      // Wrong convention
```

### Hook Rules

- Only call hooks at the top level — never inside loops, conditions, or callbacks.
- Only call hooks from React function components or other custom hooks.
- Extract complex logic into custom hooks for reusability and testability.
- Return objects (not arrays) from hooks with more than 2 return values:

```tsx
// ❌ BAD: Hard to remember order with many values
return [value, setValue, isLoading, error, refetch];

// ✅ GOOD: Named properties
return {value, setValue, isLoading, error, refetch};
```

---

## Testing

### File Naming

- Unit tests: `*.test.ts` or `*.test.tsx` in `src/test/`.
- E2E tests: `*.spec.ts` using Playwright.

### Test Structure

```typescript
describe('calculateOverallBand', () => {
  it('returns correct band for perfect scores', () => {
    expect(calculateOverallBand([9, 9, 9, 9])).toBe(9);
  });

  it('rounds to nearest 0.5 following IELTS rules', () => {
    expect(calculateOverallBand([6, 7, 6, 7])).toBe(6.5);
  });

  it('handles edge case of all zeros', () => {
    expect(calculateOverallBand([0, 0, 0, 0])).toBe(0);
  });
});
```

### Testing Rules

- Each test should verify one behavior — the name should describe that behavior.
- Use descriptive test names that read like sentences.
- Arrange-Act-Assert (AAA) pattern within each test.
- Mock external dependencies (API calls, databases) — don't hit real services.
- Test edge cases: empty inputs, boundary values, error conditions.
