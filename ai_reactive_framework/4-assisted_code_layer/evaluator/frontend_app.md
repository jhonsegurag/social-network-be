# Frontend App — Code Evaluation Guide

> Checklist and criteria for evaluating AI-generated or human-written frontend (React/Nordic/Andes) code before merging.

---

## 1. Component Structure

- [ ] Arrow function component — no class components
- [ ] Props destructured **inside the component body**, not in the function signature
- [ ] Default values set via JavaScript destructuring, not `PropTypes.defaultProps`
- [ ] `PropTypes` defined for every prop
- [ ] `module.exports` used — not ES `export default`
- [ ] `require()` used for all imports — not ES `import`

---

## 2. HTML & Accessibility

- [ ] Semantic HTML tags used (`<button>` not `<div onClick>`, `<nav>`, `<header>`, `<main>`, `<section>`)
- [ ] `aria-label` / `aria-expanded` / `role` added where native semantics are insufficient
- [ ] All `<img>` tags have `alt` attribute (empty `alt=""` for decorative images)
- [ ] Interactive elements are focusable via keyboard
- [ ] Color is not the only means of conveying information

---

## 3. Performance

- [ ] `React.memo` wraps components that receive stable props and render frequently
- [ ] `useCallback` used for event handlers passed as props
- [ ] `useMemo` used for expensive computations
- [ ] No inline function or object literals in JSX props (creates new reference every render)
- [ ] No unnecessary re-renders triggered by parent state changes

---

## 4. Nordic / Andes Component Usage

- [ ] Native Nordic layout components used — no custom grid implementations
- [ ] Andes components used for buttons, inputs, tags, money amounts — no custom equivalents
- [ ] No hardcoded hex colors, font sizes, or spacing values — design tokens only
- [ ] Andes `hierarchy` and `color` props used with correct semantic values
- [ ] No internal Andes/Nordic files imported directly (only public API)
- [ ] `ThemeProvider` is present at the application root

---

## 5. Security

- [ ] No sensitive data (tokens, user IDs, PII) stored in `localStorage` or `sessionStorage`
- [ ] No `dangerouslySetInnerHTML` — if absolutely necessary, content must be sanitized
- [ ] No inline `<script>` tags constructed from user input
- [ ] External URLs validated before rendering as `href` (no `javascript:` protocol)
- [ ] User-provided content rendered as text (`{children}`) not as raw HTML

---

## 6. State Management

- [ ] Local `useState` used for component-scoped UI state
- [ ] Context API used for shared feature state — not prop drilling more than 2 levels
- [ ] Server data fetched in container component and passed as props — no fetch calls in leaf components
- [ ] Loading and error states handled and rendered appropriately

---

## 7. Event Handling

- [ ] Analytics/tracking uses the `performEvent` + `events` pattern
- [ ] Event handlers are `useCallback`-wrapped
- [ ] No default browser events unintentionally prevented (`e.preventDefault()` only when needed)

---

## 8. Testing

- [ ] Tests use `@testing-library/react`
- [ ] Queries use role/label selectors (`getByRole`, `getByLabelText`) — not `getByTestId` or class names
- [ ] User interactions tested (click, input, submit) — not internal component state
- [ ] Loading and error states have test coverage

---

## 9. Code Quality

- [ ] No `console.log` in production code
- [ ] No unused imports or variables
- [ ] Component file matches component name
- [ ] PropTypes shape matches what is actually used in the component

---

## Red Flags (Immediate Rejection)

| Finding | Reason |
|---------|--------|
| `dangerouslySetInnerHTML={{ __html: userContent }}` | XSS risk — must sanitize |
| `localStorage.setItem('token', token)` | Credential exposure |
| `<div onClick={handler}>` for primary action | Use `<button>` — accessibility violation |
| `import { Button } from '@andes/components/src/Button'` | Internal import — unstable API |
| `style={{ color: '#E53935' }}` for status | Use Andes color semantic `negative` |
| Inline function in render: `<Comp onClick={() => doThing(id)} />` | New reference every render → performance issue |
