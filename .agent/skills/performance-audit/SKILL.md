---
name: performance-audit
description: Checklist and procedure for identifying and fixing performance bottlenecks. Use when the app feels slow or for periodic health checks.
---

# Performance Audit Skill

Follow this process to audit and improve application performance:

## 1. Network Waterfall Analysis
- Open DevTools > Network.
- Reload the page.
- **Goal**: Identify blocking requests, large assets, or slow API calls.
- **Action**: Implement caching, lazy loading, or optimize payloads.

## 2. React Render Optimization
- Use **React DevTools Profiler** to record interactions.
- Identify components that re-render unnecessarily.
- **Action**:
  - Use `React.memo` for expensive components.
  - Use `useCallback` and `useMemo` for stable props/values.
  - Virtualize long lists using `react-window` or similar if applicable.

## 3. Bundle Size
- Run `npm run build` and analyze output.
- **Action**:
  - Use dynamic imports (`React.lazy`) for route-based code splitting.
  - Checking for large dependencies that can be trimmed.

## 4. Mobile Performance (Crucial for TradieMate)
- Test on a real device or throttled CPU in DevTools.
- **Check**: Touch responsiveness, animation smoothness (60fps).
- **Action**: Use CSS transforms instead of layout properties (top/left) for animations.
