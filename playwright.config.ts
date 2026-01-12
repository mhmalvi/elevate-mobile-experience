import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Test execution commands:
 * - npm run test:e2e          - Run all E2E tests
 * - npm run test:e2e:ui       - Run with interactive UI
 * - npm run test:e2e:report   - View test report
 *
 * Environment variables:
 * - TEST_USER_EMAIL    - Test user email for authenticated tests
 * - TEST_USER_PASSWORD - Test user password
 * - TEST_INVOICE_ID    - Valid invoice ID for public page tests
 * - TEST_QUOTE_ID      - Valid quote ID for public page tests
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 60000, // 60 second timeout per test
  expect: {
    timeout: 10000, // 10 second timeout for assertions
  },
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Test file patterns
  testMatch: '**/*.spec.ts',

  // Output directories
  outputDir: './e2e-results',

  projects: [
    // Desktop Chrome - Primary
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // Mobile Safari - iPhone 13
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
      },
    },

    // Mobile Chrome - Android
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },

    // Tablet - iPad
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11'],
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
