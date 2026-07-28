# Google HTML/CSS Style Guide — Detailed Reference

Source: https://google.github.io/styleguide/htmlcssguide.html

Read this reference when writing or modifying HTML templates, JSX markup, CSS,
or Tailwind utility classes.

---

## Table of Contents

1. [General Rules](#general-rules)
2. [HTML Rules](#html-rules)
3. [CSS Rules](#css-rules)
4. [Tailwind CSS (Project-Specific)](#tailwind-css-project-specific)

---

## General Rules

### Protocol

Always use HTTPS for embedded resources (images, scripts, stylesheets).

```html
<!-- ❌ BAD -->
<script src="http://example.com/script.js"></script>

<!-- ✅ GOOD -->
<script src="https://example.com/script.js"></script>
```

### Indentation

Indent by **2 spaces**. No tabs. No mixing tabs and spaces.

### Capitalization

Use lowercase for HTML element names, attributes, attribute values, CSS selectors,
properties, and property values.

```html
<!-- ❌ BAD -->
<A HREF="/">Home</A>

<!-- ✅ GOOD -->
<a href="/">Home</a>
```

```css
/* ❌ BAD */
color: #E5E5E5;

/* ✅ GOOD */
color: #e5e5e5;
```

### Trailing Whitespace

Remove all trailing whitespace — it complicates diffs.

### Encoding

Use UTF-8 (no BOM). Specify via `<meta charset="utf-8">`.

### Comments

Explain code's purpose — what it covers, why this approach was chosen.
Use `TODO: description` for action items.

---

## HTML Rules

### Document Type

Always use `<!doctype html>` for no-quirks mode rendering.

### Validity

Use valid HTML where possible. Use semantic elements.

### Semantics

Use HTML elements for their intended purpose:
- `<h1>` through `<h6>` for headings (one `<h1>` per page)
- `<p>` for paragraphs
- `<a>` for links (never `<div onClick>`)
- `<button>` for interactive actions
- `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>` for structure
- `<ul>`/`<ol>` for lists

### Multimedia Fallbacks

Always provide `alt` attributes for images. For video/audio, provide captions
or transcripts.

```html
<!-- ❌ BAD -->
<img src="chart.png">

<!-- ✅ GOOD -->
<img src="chart.png" alt="Bar chart showing Q4 revenue by region">
```

### Separation of Concerns

- Structure (HTML) and presentation (CSS) and behavior (JS) are separate concerns.
- Don't use inline styles except for truly dynamic values.
- Don't use `<style>` blocks in component files when CSS modules or Tailwind work.

### Type Attributes

Don't add `type` attributes for stylesheets and scripts — HTML5 implies them.

```html
<!-- ❌ BAD -->
<script type="text/javascript" src="app.js"></script>
<link rel="stylesheet" type="text/css" href="style.css">

<!-- ✅ GOOD -->
<script src="app.js"></script>
<link rel="stylesheet" href="style.css">
```

### HTML Formatting

- Use a new line for every block, list, or table element.
- Indent every child element.
- Use double quotes `"` for attribute values in HTML/JSX.

```html
<!-- ✅ GOOD -->
<nav>
  <ul>
    <li>
      <a href="/home">Home</a>
    </li>
    <li>
      <a href="/about">About</a>
    </li>
  </ul>
</nav>
```

---

## CSS Rules

### Validity

Use valid CSS where possible.

### Class Naming

Use meaningful, descriptive class names that reflect purpose, not presentation.

```css
/* ❌ BAD: Presentational */
.blue-button { }
.left-sidebar { }

/* ✅ GOOD: Purposeful */
.primary-action { }
.navigation-sidebar { }
```

### Class Name Style

- Use lowercase with hyphens: `kebab-case`.
- Avoid IDs for styling — use classes.

```css
/* ❌ BAD */
.navBar { }
#header { }

/* ✅ GOOD */
.nav-bar { }
.site-header { }
```

### Shorthand Properties

Use shorthand properties where possible for conciseness.

```css
/* ❌ BAD */
padding-top: 1rem;
padding-right: 1rem;
padding-bottom: 1rem;
padding-left: 1rem;
font-family: sans-serif;
font-size: 1rem;
line-height: 1.5;

/* ✅ GOOD */
padding: 1rem;
font: 1rem/1.5 sans-serif;
```

### Units

- Omit units for `0` values: `margin: 0` not `margin: 0px`.
- Omit leading `0` in decimals: `font-size: .875rem` not `font-size: 0.875rem`.
- Use `rem` for font sizes, `px` for borders and shadows.

### Hex Color Notation

Use 3-character hex when possible, lowercase.

```css
/* ❌ BAD */
color: #EEBBCC;

/* ✅ GOOD */
color: #ebc;
```

### Declaration Order

Group declarations by type:
1. Positioning (`position`, `top`, `right`, `z-index`)
2. Box model (`display`, `flex`, `width`, `margin`, `padding`)
3. Typography (`font`, `line-height`, `color`, `text-align`)
4. Visual (`background`, `border`, `border-radius`, `box-shadow`)
5. Animation (`transition`, `animation`)
6. Misc (`cursor`, `overflow`)

### Selector Rules

- Avoid qualifying class selectors with element names (`div.nav` → `.nav`).
- Keep selectors as short as possible.
- Avoid `!important` — fix specificity issues properly.

### Declaration Stops

End every declaration with a semicolon — even the last one in a block.

### Property Name Stops

Use a space after the colon in property declarations.

```css
/* ❌ BAD */
color:red;

/* ✅ GOOD */
color: red;
```

### Block Content Indentation

Indent all block content — properties within selectors.

### Selector and Declaration Separation

Put each selector and declaration on its own line.

```css
/* ❌ BAD */
h1, h2, h3 { font-weight: bold; color: #333; }

/* ✅ GOOD */
h1,
h2,
h3 {
  font-weight: bold;
  color: #333;
}
```

### Rule Separation

Separate rules with a blank line.

---

## Tailwind CSS (Project-Specific)

This project uses Tailwind CSS v3 with `tailwind-merge` and `clsx`. Rules:

### Class Ordering

Follow a logical order in Tailwind classes:
1. Layout (`flex`, `grid`, `block`, `hidden`)
2. Sizing (`w-`, `h-`, `max-w-`, `min-h-`)
3. Spacing (`p-`, `m-`, `gap-`)
4. Typography (`text-`, `font-`, `leading-`, `tracking-`)
5. Colors (`bg-`, `text-`, `border-`)
6. Effects (`shadow-`, `opacity-`, `blur-`)
7. Borders (`border-`, `rounded-`)
8. Transitions (`transition-`, `duration-`, `ease-`)
9. Responsive/state (`hover:`, `focus:`, `md:`, `lg:`)

### Using `cn()` Utility

Always merge conditional classes with the `cn()` utility (uses `clsx` + `tailwind-merge`):

```typescript
import {cn} from '@/lib/utils';

<button
  className={cn(
    'flex items-center gap-2 rounded-lg px-4 py-2',
    'text-sm font-medium transition-colors',
    isActive && 'bg-primary text-primary-foreground',
    isDisabled && 'cursor-not-allowed opacity-50',
  )}
>
```

### Don't Mix Inline Styles with Tailwind

Use Tailwind utilities instead of inline `style` props. Only use `style` for
truly dynamic computed values (e.g., `style={{width: `${progress}%`}}`).
