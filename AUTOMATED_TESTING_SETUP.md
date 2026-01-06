# 🤖 Automated Testing Setup Guide

**Project:** TradieMate
**Date:** January 6, 2026
**Status:** Setting Up Automated Testing Framework

---

## 🎯 Testing Strategy

We'll implement a **comprehensive 3-tier testing approach**:

1. **Unit Tests** - Test individual functions and utilities (Vitest)
2. **Component Tests** - Test React components in isolation (React Testing Library)
3. **E2E Tests** - Test complete user journeys (Playwright)

---

## 📦 Required Dependencies

### Testing Framework: Vitest
- Fast, Vite-native test runner
- Compatible with Jest API
- Better performance than Jest

### Component Testing: React Testing Library
- Industry standard for React testing
- User-centric testing approach
- Works seamlessly with Vitest

### E2E Testing: Playwright
- Modern, reliable E2E testing
- Cross-browser support (Chrome, Firefox, Safari)
- Better than Cypress for authentication flows

### Additional Tools:
- **@testing-library/user-event** - Simulate user interactions
- **@testing-library/jest-dom** - Custom matchers for DOM
- **msw** - Mock Service Worker for API mocking
- **@faker-js/faker** - Generate test data

---

## 🚀 Installation Commands

```bash
# Install Vitest and React Testing Library
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Install Playwright for E2E
npm install -D @playwright/test

# Install additional testing utilities
npm install -D msw @faker-js/faker

# Initialize Playwright (creates playwright.config.ts)
npx playwright install
```

---

## 📁 Recommended Project Structure

```
elevate-mobile-experience/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   └── button.test.tsx          # Component test
│   │   └── forms/
│   │       ├── ClientForm.tsx
│   │       └── ClientForm.test.tsx
│   ├── lib/
│   │   ├── utils.ts
│   │   └── utils.test.ts                # Unit test
│   ├── hooks/
│   │   ├── useClients.ts
│   │   └── useClients.test.ts
│   └── __tests__/                       # Test utilities
│       ├── setup.ts
│       ├── mocks/
│       │   └── handlers.ts              # MSW handlers
│       └── fixtures/
│           └── testData.ts
├── e2e/                                  # E2E tests
│   ├── auth.spec.ts
│   ├── clients.spec.ts
│   ├── quotes.spec.ts
│   ├── invoices.spec.ts
│   └── payments.spec.ts
├── vitest.config.ts                     # Vitest config
├── playwright.config.ts                 # Playwright config
└── setup-tests.ts                       # Global test setup
```

---

## ⚙️ Configuration Files

### 1. vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 2. src/__tests__/setup.ts
```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### 3. playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 📝 Package.json Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report",
    "test:all": "npm run test:run && npm run test:e2e"
  }
}
```

---

## 🧪 Sample Test Files

### 1. Unit Test Example: `src/lib/utils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, calculateGST } from './utils';

describe('utils', () => {
  describe('cn (className merger)', () => {
    it('merges class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });
  });

  describe('formatCurrency', () => {
    it('formats AUD currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('handles negative numbers', () => {
      expect(formatCurrency(-50.25)).toBe('-$50.25');
    });
  });

  describe('calculateGST', () => {
    it('calculates 10% GST correctly', () => {
      expect(calculateGST(100)).toBe(10);
    });

    it('rounds to 2 decimal places', () => {
      expect(calculateGST(33.33)).toBe(3.33);
    });
  });
});
```

### 2. Component Test Example: `src/components/ui/button.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant classes correctly', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(container.firstChild).toHaveClass('bg-destructive');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });
});
```

### 3. Hook Test Example: `src/hooks/useClients.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClients } from './useClients';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useClients hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches clients successfully', async () => {
    const { result } = renderHook(() => useClients(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('handles error state', async () => {
    // Mock Supabase error
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    } as any);

    const { result } = renderHook(() => useClients(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
```

### 4. E2E Test Example: `e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should register new user successfully', async ({ page }) => {
    await page.goto('/');

    // Click sign up
    await page.click('text=Sign Up');

    // Fill registration form
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.fill('[name="confirmPassword"]', 'TestPassword123!');

    // Submit form
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should login existing user', async ({ page }) => {
    await page.goto('/');

    // Fill login form
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');

    // Submit
    await page.click('button:has-text("Sign In")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });
});
```

### 5. E2E Test Example: `e2e/invoices.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL(/.*dashboard/);
  });

  test('should create new invoice', async ({ page }) => {
    // Navigate to invoices
    await page.click('text=Invoices');
    await page.click('text=Create Invoice');

    // Fill invoice form
    await page.selectOption('[name="client_id"]', { index: 1 });
    await page.fill('[name="title"]', 'Test Invoice');

    // Add line item
    await page.click('text=Add Item');
    await page.fill('[name="items[0].description"]', 'Labour');
    await page.fill('[name="items[0].quantity"]', '10');
    await page.fill('[name="items[0].unit_price"]', '85');

    // Save invoice
    await page.click('button:has-text("Save Invoice")');

    // Should redirect to invoice detail
    await expect(page.locator('h1:has-text("Test Invoice")')).toBeVisible();
    await expect(page.locator('text=$850.00')).toBeVisible();
  });

  test('should send invoice via email', async ({ page }) => {
    // Go to first invoice
    await page.click('text=Invoices');
    await page.click('.invoice-list-item').first();

    // Click send email
    await page.click('button:has-text("Send Invoice")');
    await page.click('text=Email');

    // Confirm send
    await page.click('button:has-text("Send Email")');

    // Should show success toast
    await expect(page.locator('text=Invoice sent via email')).toBeVisible();

    // Status should update
    await expect(page.locator('[data-status="sent"]')).toBeVisible();
  });

  test('should generate PDF for invoice', async ({ page }) => {
    await page.click('text=Invoices');
    await page.click('.invoice-list-item').first();

    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download PDF")');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/invoice.*\.pdf/);
  });
});
```

---

## 🎯 Test Coverage Goals

### Target Coverage Levels

| Type | Target | Priority |
|------|--------|----------|
| Unit Tests | 80%+ | High |
| Component Tests | 70%+ | High |
| E2E Tests | Critical Paths | High |
| Integration Tests | 60%+ | Medium |

### Critical Paths to Test (E2E)

1. ✅ User registration → Email verification → Login
2. ✅ Create client → Create invoice → Send email → Client pays → Status updates
3. ✅ Create quote → Send to client → Client accepts → Convert to job
4. ✅ Subscribe to paid tier → Create resources beyond free limits
5. ✅ Team invitation → Accept → Collaborate on invoice

---

## 🚀 Running Tests

### Unit & Component Tests
```bash
# Watch mode (development)
npm run test

# Run once with coverage
npm run test:coverage

# Visual UI
npm run test:ui
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode (visual debugging)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

### CI/CD Integration
```bash
# Run all tests (for CI pipeline)
npm run test:all
```

---

## 📊 Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 🎓 Best Practices

### 1. Test Naming
```typescript
// ❌ Bad
test('test1', () => { ... });

// ✅ Good
test('should create invoice with correct total when adding line items', () => { ... });
```

### 2. AAA Pattern
```typescript
test('should calculate GST correctly', () => {
  // Arrange
  const subtotal = 100;

  // Act
  const gst = calculateGST(subtotal);

  // Assert
  expect(gst).toBe(10);
});
```

### 3. Don't Test Implementation Details
```typescript
// ❌ Bad - testing implementation
expect(component.state.count).toBe(5);

// ✅ Good - testing behavior
expect(screen.getByText('Count: 5')).toBeInTheDocument();
```

### 4. Use Data-Testid Sparingly
```typescript
// ❌ Overuse
<button data-testid="submit-button">Submit</button>

// ✅ Use semantic queries first
<button type="submit">Submit</button>
// Then: screen.getByRole('button', { name: /submit/i })
```

### 5. Mock External Dependencies
```typescript
// Mock Supabase
vi.mock('@/integrations/supabase/client');

// Mock Stripe
vi.mock('@stripe/stripe-js');

// Don't mock internal code
```

---

## 📚 Next Steps

1. **Install dependencies** (run commands above)
2. **Create configuration files** (vitest.config.ts, playwright.config.ts)
3. **Set up test utilities** (src/__tests__/setup.ts)
4. **Write first tests** (start with utils, then components)
5. **Set up CI/CD** (GitHub Actions)
6. **Aim for 80% coverage** before production

---

## 🔗 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Ready to implement automated testing? Start with unit tests and work your way up to E2E!** 🚀
