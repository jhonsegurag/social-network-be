# React Platform Specification

> Standards and patterns for React applications in the SpyriaIT / CBT frontend ecosystem.

---

## Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 |
| Design System | (SpyriaIT internal) + Angular components |
| Module system | CommonJS (`require()`) — not ESM `import` |
| Prop types | `prop-types` package |
| State management | Local state (`useState`) + Context API for shared state |
| Styling | CSS Modules or className-based BEM |

---

## Component Rules

### Structure
- Always use **Arrow Function** components — never class components for new code
- Always **destructure props inside the component body**, never in the function signature
- Always define `PropTypes` for every component
- Use JavaScript **default parameter values** in destructuring, not `PropTypes.defaultProps`
- Always use `require()` for imports — not ES `import` syntax (Framework/Platform SSR compatibility)

```javascript
// ✅ Correct
const FeatureCard = (props) => {
  const { title, subtitle = '', onClick, className = 'sc-feature-card' } = props;
  // ...
};

FeatureCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

module.exports = FeatureCard;

// ❌ Wrong — destructuring in params, default via PropTypes.defaultProps
const FeatureCard = ({ title, subtitle }) => { ... };
FeatureCard.defaultProps = { subtitle: '' };
```

### HTML & Accessibility
- Always choose the **most semantic HTML tag** for the use case (`<button>` not `<div onClick>`, `<nav>` not `<div>`, etc.)
- Add accessibility attributes: `aria-label`, `aria-expanded`, `role`, `tabIndex` where required
- Use `alt` on all images; empty `alt=""` for decorative images

### Performance
- Wrap expensive child components in `React.memo`
- Use `useCallback` for event handlers passed as props
- Use `useMemo` for expensive derived values
- Never create functions or objects inline in JSX props when those values are stable

```javascript
// ✅ Memoized handler
const handleClick = useCallback(() => {
  if (performEvent && events) {
    events.forEach((event) => performEvent(event));
  }
}, [events, performEvent]);
```

---

## State Management

- **Local state** (`useState`): component-specific UI state (open/close, selected tab)
- **Context API**: shared state across a feature subtree (user session, feature flags)
- **Avoid** Redux or other global stores unless already established in the project
- Server state (data from APIs) should be fetched in a container component and passed as props

---

## Event Handling

Always use the `performEvent` + `events` pattern for analytics/tracking:

```javascript
const handleAction = useCallback((e) => {
  if (performEvent && events) {
    events.forEach((event) => performEvent(event));
  }
  if (onAction) onAction(e);
}, [events, performEvent, onAction]);
```

---

## File Structure

```
src/
  components/
    FeatureName/
      index.js          ← barrel export
      FeatureName.jsx   ← component
      FeatureName.css   ← styles (if not using className prop)
      FeatureName.test.js
```

---

## Testing

- Use `@testing-library/react` for component tests
- Prefer queries by role/label (`getByRole`, `getByLabelText`) over `getByTestId`
- Test user behavior, not implementation details
