---
name: playwright-test
description: Creates or modifies Playwright E2E tests. Use when testing user flows or verifying UI behavior.
---

# Playwright Test Skill

When writing end-to-end tests with Playwright:

## File Location

- Place all E2E tests in the `e2e` directory.
- Name files with the `.spec.ts` suffix (e.g., `e2e/login.spec.ts`).

## Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup (e.g., login or navigation)
  });

  test('should perform specific action', async ({ page }) => {
    // Action
    await page.goto('/some-page');
    
    // Assertion
    await expect(page.getByText('Success')).toBeVisible();
  });
});
```

## Best Practices

- Use **locators** that are resilient to change (e.g., `getByRole`, `getByText`, `getByLabel`). Avoid CSS selectors relying on implementation details.
- Group related tests using `test.describe`.
- Use `await expect(...)` for assertions to ensure auto-waiting.
- Keep tests independent; do not rely on state from previous tests.
