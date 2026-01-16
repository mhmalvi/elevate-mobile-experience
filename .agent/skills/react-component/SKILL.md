---
name: react-component
description: Creates a new React component or modifies an existing one. Use when adding UI elements or refactoring components.
---

# React Component Skill

When working with React components in this project, follow these guidelines:

## Component Structure

- Use **functional components** with `const` and arrow functions.
- Use **TypeScript** for all components. Define props interface:
  ```typescript
  interface MyComponentProps {
    title: string;
    isActive?: boolean;
    // ...
  }
  ```
- Export the component as default: `export default MyComponent;` (unless creating a utility library).

## Styling

- Use **Tailwind CSS** for styling.
- Avoid inline styles where possible.
- Use the `cn` utility for conditional classes if available (e.g., `lib/utils.ts`).

## File Location

- Place reusable UI components in `src/components/ui/`.
- Place feature-specific components in their respective feature folders.

## Best Practices

- Destructure props in the function arguments.
- Use `shadcn/ui` components from `src/components/ui` as building blocks when possible.
- Ensure components are responsive (use `md:`, `lg:` prefixes).
