# Google TypeScript Style Guide — Detailed Reference

Source: https://google.github.io/styleguide/tsguide.html

Read this reference when you need detailed TypeScript rules beyond what the main
SKILL.md covers. This file covers advanced patterns, edge cases, and the rationale
behind specific rules.

---

## Table of Contents

1. [Imports & Exports](#imports--exports)
2. [Variables & Declarations](#variables--declarations)
3. [Type System](#type-system)
4. [Classes](#classes)
5. [Functions](#functions)
6. [Control Structures](#control-structures)
7. [Naming](#naming)
8. [Comments & Documentation](#comments--documentation)
9. [Disallowed Patterns](#disallowed-patterns)

---

## Imports & Exports

### Import Types

| Import type | Syntax | Use for |
|-------------|--------|---------|
| Named (destructured) | `import {Foo} from '...'` | All TypeScript imports (preferred) |
| Namespace | `import * as foo from '...'` | Large APIs with many symbols |
| Default | `import Foo from '...'` | Only when external code requires it |
| Side-effect | `import '...'` | Libraries with side effects on load |
| Type-only | `import type {Foo} from '...'` | When symbol used only as a type |

### Named vs Namespace Imports

- **Prefer named imports** for symbols used frequently or with clear names.
- **Use namespace imports** when importing many symbols from a large API to avoid
  long destructured import lines.

```typescript
// ❌ BAD: Long destructured import
import {Item as TableviewItem, Header as TableviewHeader,
  Row as TableviewRow, Model as TableviewModel} from './tableview';

// ✅ GOOD: Namespace import
import * as tableview from './tableview';
let item: tableview.Item | undefined;

// ❌ BAD: Namespace for common well-known functions
import * as testing from './testing';
testing.describe('foo', () => { testing.it('bar', () => {}); });

// ✅ GOOD: Named imports for common functions
import {describe, it, expect} from './testing';
describe('foo', () => { it('bar', () => {}); });
```

### Export Rules

- **Always use named exports** — never `export default`.
- Minimize the exported API surface — only export what's used outside the module.
- **No mutable exports** — `export let` is not allowed. Use getter functions.
- Don't create container classes for static namespacing — use file scope.

```typescript
// ❌ BAD
export default class Foo { ... }
export let mutableValue = 3;
export class Container { static FOO = 1; static bar() {} }

// ✅ GOOD
export class Foo { ... }
export const FOO = 1;
export function bar() { return 1; }
export function getMutableValue() { return mutableValue; }
```

### Import Type

Use `import type` when the imported symbol is used only as a type:

```typescript
import type {UserProfile} from './types';
import {validateUser} from './validation';

// Or inline:
import {type UserProfile, validateUser} from './types';
```

### Module Organization

- Use ES6 modules — never `namespace Foo { ... }`.
- Never use `require()` — always ES6 `import`.
- Never use `/// <reference path="..."/>`.

---

## Variables & Declarations

### `const` and `let` Only

- `const` by default — switch to `let` only if reassignment is needed.
- **Never use `var`** — its function-scoping causes bugs.
- One variable per declaration.
- Variables must not be used before their declaration.

### Array Literals

- **Never use `new Array()`** — use bracket notation `[]`.
- Use spread syntax `[...foo]` for shallow copies.
- Never spread `null`, `undefined`, or primitives into arrays.

```typescript
// ❌ BAD
const a = new Array(2);     // Confusing: creates [undefined, undefined]
const b = [5, ...(flag && arr)];  // Might spread undefined

// ✅ GOOD
const a = [2];
const b = flag ? [5, ...arr] : [5];
Array.from<number>({length: 5}).fill(0);  // [0, 0, 0, 0, 0]
```

### Object Literals

- **Never use `new Object()`** — use `{}`.
- Don't use unfiltered `for...in` — use `Object.keys()` or `Object.entries()`.
- When spreading objects, never spread `null`, `undefined`, or arrays.

### Destructuring

- Use array destructuring: `const [a, b, ...rest] = arr;`
- Use object destructuring: `const {name, age} = user;`
- For function parameters, keep destructuring simple — single level, no computed keys.
- Set defaults on the left side: `{str = 'default'} = {}`.

---

## Type System

### Type Assertions

- **Avoid type assertions** (`value as Type`).
- Use type guards and narrowing instead.
- If you must assert, add a comment explaining why it's safe.
- Never use `<Type>value` syntax — always use `value as Type` (JSX compat).

### Interfaces vs Types

- Use `interface` for object shapes (they can be extended/implemented).
- Use `type` for unions, intersections, mapped types, and function types.

### Nullability

- Use `T | null` or `T | undefined` — never use `!` non-null assertion without
  a comment justifying its safety.
- Prefer optional chaining `?.` and nullish coalescing `??` over manual checks.

### Enums

- Prefer `const enum` or string literal union types over regular enums when possible.
- Enum members use `PascalCase`.

### Generics

- Type parameters are single uppercase letters or `PascalCase` descriptive names.
- Don't add constraints that TypeScript can infer.

---

## Classes

### Declaration Rules

- No semicolons after class declarations.
- Separate methods with a single blank line.
- Separate the constructor from other members with blank lines.

### Constructors

- Always use `new Foo()` with parentheses — never `new Foo`.
- Don't write empty constructors — ES2015 provides a default.
- Use parameter properties to reduce boilerplate.

```typescript
// ❌ BAD
class Foo {
  private readonly service: BarService;
  constructor(service: BarService) {
    this.service = service;
  }
}

// ✅ GOOD
class Foo {
  constructor(private readonly service: BarService) {}
}
```

### Member Visibility

- Limit visibility as much as possible.
- Never use the `public` keyword (TypeScript members are public by default)
  — exception: non-readonly public parameter properties.
- Use TypeScript's `private` keyword, not `#private` fields.
- Mark properties that are never reassigned with `readonly`.
- Never bypass visibility with `obj['foo']`.

### Getters and Setters

- Getters must be pure functions (no side effects).
- Don't create pass-through accessors — make the property public instead.
- At least one accessor must have non-trivial logic.

### Field Initializers

```typescript
// ❌ BAD: Initialize in constructor
class Foo {
  private readonly list: string[];
  constructor() { this.list = []; }
}

// ✅ GOOD: Initialize at declaration
class Foo {
  private readonly list: string[] = [];
}
```

---

## Functions

### Arrow Functions vs Declarations

- Top-level/exported: use `function` declarations.
- Callbacks, closures: use arrow functions.
- Never use `Function` constructor.

### Parameters

- Use rest parameters `...args` instead of `arguments`.
- Use object destructuring for functions with many parameters.
- Provide default values in destructured parameters.

### Return Types

- **Always annotate return types** on exported/public functions.
- For private/internal functions, return type annotation is optional if obvious.

---

## Control Structures

### Braces

Always use braces for `if`, `else`, `for`, `do`, `while` — even single-statement bodies.

### Switch Statements

- Every `case` must end with `break`, `return`, `throw`, or a `// fall through` comment.
- Always include a `default` case.
- Use braces for `case` blocks that declare variables.

### Equality

- Always use `===` and `!==` — never `==` or `!=`.
- Exception: `value == null` is acceptable to check for both `null` and `undefined`.

### Iteration

- Arrays: `for...of` or array methods (`.map()`, `.filter()`, `.forEach()`).
- Objects: `Object.keys()`, `Object.values()`, `Object.entries()`.
- Never use unfiltered `for...in`.

---

## Naming

### Identifiers

| Category | Convention | Example |
|----------|-----------|---------|
| Classes, interfaces, types, enums | `PascalCase` | `UserProfile`, `TaskType` |
| Enum members | `PascalCase` | `Color.Red` |
| Functions, methods, variables, params | `camelCase` | `getUserById`, `isValid` |
| Global constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Type parameters | `T`, `K`, `V` or `PascalCase` | `T`, `ResponseType` |
| Private members | No `_` prefix; use `private` | `private count = 0` |

### Naming Guidelines

- Don't use trailing or leading underscores for privacy — use visibility modifiers.
- Don't abbreviate unnecessarily — `message` not `msg`, `button` not `btn`.
- Boolean names should read as predicates: `isReady`, `hasPermission`, `canEdit`.
- Avoid single-letter names except in very short lambdas (`(x) => x * 2`).

---

## Comments & Documentation

### JSDoc

- Use `/** */` JSDoc on all exported symbols.
- Use `@param` and `@returns` tags — keep descriptions concise.
- Don't duplicate the type system — if TypeScript provides the type, don't
  repeat it in JSDoc `@param {string}`.
- Use `@deprecated` for symbols that should no longer be used.

### Parameter Property Comments

```typescript
class Foo {
  /**
   * @param service handles user authentication
   * @param config runtime configuration options
   */
  constructor(
    private readonly service: AuthService,
    private readonly config: AppConfig,
  ) {}
}
```

### Inline Comments

- Explain **why**, not **what**.
- Place comments on the line above the code they describe, not at the end.
- Use `// TODO: description` for todos.

---

## Disallowed Patterns

The following patterns are explicitly disallowed by Google's style guide:

| Pattern | Alternative |
|---------|-------------|
| `var` | `const` or `let` |
| `export default` | Named exports |
| `new Array()` | `[]` literal |
| `new Object()` | `{}` literal |
| `for...in` (unfiltered) | `Object.keys()` / `for...of` |
| `namespace Foo { }` | ES6 modules |
| `require()` | ES6 `import` |
| `/// <reference>` | ES6 `import` |
| `#privateField` | `private` keyword |
| `arguments` object | Rest parameters `...args` |
| `Function` constructor | Arrow functions / declarations |
| `eval()` | Never use |
| `with` statement | Never use |
| Type assertions without comment | Type guards / narrowing |
| Wrapper objects (`String`, `Boolean`, `Number`) | Primitives (`string`, `boolean`, `number`) |
