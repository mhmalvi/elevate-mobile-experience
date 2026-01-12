import { Page, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * E2E Test Helpers and Utilities
 * Provides reusable functions for common test operations
 */

// Test user credentials - use environment variables or defaults for testing
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'aethonautomation@gmail.com',
  password: process.env.TEST_USER_PASSWORD || '90989098',
};

// Flag to indicate if test credentials are available (always true since we have defaults)
// Use this instead of checking process.env.TEST_USER_EMAIL directly
export const HAS_TEST_CREDENTIALS = Boolean(TEST_USER.email && TEST_USER.password);

// Generate test data
export const generateTestData = {
  client: () => ({
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    phone: `04${faker.string.numeric(8)}`,
    address: faker.location.streetAddress(),
    suburb: faker.location.city(),
    state: 'NSW',
    postcode: faker.string.numeric(4),
    notes: faker.lorem.sentence(),
  }),

  quote: () => ({
    title: `Quote - ${faker.commerce.productName()}`,
    description: faker.lorem.paragraph(),
    validDays: 30,
    lineItems: [
      {
        description: faker.commerce.productName(),
        quantity: faker.number.int({ min: 1, max: 10 }),
        unitPrice: faker.number.int({ min: 50, max: 500 }),
      },
      {
        description: faker.commerce.productName(),
        quantity: faker.number.int({ min: 1, max: 5 }),
        unitPrice: faker.number.int({ min: 100, max: 1000 }),
      },
    ],
  }),

  invoice: () => ({
    title: `Invoice - ${faker.commerce.productName()}`,
    description: faker.lorem.paragraph(),
    dueInDays: 14,
    lineItems: [
      {
        description: faker.commerce.productName(),
        quantity: faker.number.int({ min: 1, max: 10 }),
        unitPrice: faker.number.int({ min: 50, max: 500 }),
      },
    ],
  }),

  job: () => ({
    title: `Job - ${faker.commerce.productName()}`,
    description: faker.lorem.paragraph(),
    siteAddress: faker.location.streetAddress(),
    scheduledDate: faker.date.future().toISOString().split('T')[0],
  }),

  profile: () => ({
    businessName: faker.company.name(),
    abn: faker.string.numeric(11),
    phone: `04${faker.string.numeric(8)}`,
    address: faker.location.streetAddress(),
  }),
};

/**
 * Authentication helpers
 */
export class AuthHelper {
  constructor(private page: Page) {}

  async login(email = TEST_USER.email, password = TEST_USER.password) {
    await this.page.goto('/auth');
    await this.page.waitForLoadState('networkidle');

    // Fill login form
    const emailInput = this.page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = this.page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(email);
    await passwordInput.fill(password);

    // Click login button
    const loginButton = this.page.locator('button[type="submit"]').filter({ hasText: /sign in|log in|login/i });
    await loginButton.click();

    // Wait for navigation away from auth page
    await this.page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });
  }

  async signup(email: string, password: string) {
    await this.page.goto('/auth');
    await this.page.waitForLoadState('networkidle');

    // Click signup tab/link if exists
    const signupTab = this.page.locator('button, a').filter({ hasText: /sign up|register|create account/i });
    if (await signupTab.isVisible()) {
      await signupTab.click();
      await this.page.waitForTimeout(500);
    }

    // Fill signup form
    const emailInput = this.page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = this.page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(email);
    await passwordInput.fill(password);

    // Click signup button
    const signupButton = this.page.locator('button[type="submit"]').filter({ hasText: /sign up|register|create/i });
    await signupButton.click();
  }

  async logout() {
    // Navigate to settings and logout
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');

    const logoutButton = this.page.locator('button').filter({ hasText: /sign out|log out|logout/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await this.page.waitForURL((url) => url.pathname.includes('/auth'), { timeout: 10000 });
    }
  }

  async isLoggedIn(): Promise<boolean> {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
    return !this.page.url().includes('/auth');
  }
}

/**
 * Navigation helpers
 */
export class NavigationHelper {
  constructor(private page: Page) {}

  async goToDashboard() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async goToClients() {
    await this.page.goto('/clients');
    await this.page.waitForLoadState('networkidle');
  }

  async goToNewClient() {
    await this.page.goto('/clients/new');
    await this.page.waitForLoadState('networkidle');
  }

  async goToQuotes() {
    await this.page.goto('/quotes');
    await this.page.waitForLoadState('networkidle');
  }

  async goToNewQuote() {
    await this.page.goto('/quotes/new');
    await this.page.waitForLoadState('networkidle');
  }

  async goToInvoices() {
    await this.page.goto('/invoices');
    await this.page.waitForLoadState('networkidle');
  }

  async goToNewInvoice() {
    await this.page.goto('/invoices/new');
    await this.page.waitForLoadState('networkidle');
  }

  async goToJobs() {
    await this.page.goto('/jobs');
    await this.page.waitForLoadState('networkidle');
  }

  async goToNewJob() {
    await this.page.goto('/jobs/new');
    await this.page.waitForLoadState('networkidle');
  }

  async goToSettings() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }

  async goToPublicInvoice(id: string) {
    await this.page.goto(`/i/${id}`);
    await this.page.waitForLoadState('networkidle');
  }

  async goToPublicQuote(id: string) {
    await this.page.goto(`/q/${id}`);
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Form helpers
 */
export class FormHelper {
  constructor(private page: Page) {}

  async fillInput(selector: string, value: string) {
    const input = this.page.locator(selector).first();
    await input.clear();
    await input.fill(value);
  }

  async fillInputByLabel(label: string, value: string) {
    const input = this.page.locator(`input, textarea`).filter({
      has: this.page.locator(`label:has-text("${label}")`),
    });
    if (await input.count() > 0) {
      await input.first().clear();
      await input.first().fill(value);
    } else {
      // Try finding by placeholder
      const byPlaceholder = this.page.locator(`input[placeholder*="${label}" i], textarea[placeholder*="${label}" i]`);
      if (await byPlaceholder.count() > 0) {
        await byPlaceholder.first().clear();
        await byPlaceholder.first().fill(value);
      }
    }
  }

  async selectOption(selector: string, value: string) {
    const select = this.page.locator(selector).first();
    await select.selectOption(value);
  }

  async clickButton(text: string) {
    const button = this.page.locator('button').filter({ hasText: new RegExp(text, 'i') }).first();
    await button.click();
  }

  async submitForm() {
    const submitButton = this.page.locator('button[type="submit"]').first();
    await submitButton.click();
  }

  async waitForFormSuccess() {
    // Wait for success toast or redirect
    await Promise.race([
      this.page.waitForSelector('[data-sonner-toast][data-type="success"]', { timeout: 5000 }).catch(() => null),
      this.page.waitForURL((url) => !url.pathname.includes('/new') && !url.pathname.includes('/edit'), { timeout: 5000 }).catch(() => null),
    ]);
  }

  async hasValidationError(): Promise<boolean> {
    const errorMessages = this.page.locator('[role="alert"], .text-destructive, [data-error="true"]');
    return (await errorMessages.count()) > 0;
  }
}

/**
 * Wait helpers
 */
export class WaitHelper {
  constructor(private page: Page) {}

  async waitForToast(type: 'success' | 'error' = 'success') {
    await this.page.waitForSelector(`[data-sonner-toast][data-type="${type}"]`, { timeout: 5000 });
  }

  async waitForLoading() {
    // Wait for loading indicators to disappear
    const loadingIndicators = this.page.locator('[aria-busy="true"], .animate-spin, [data-loading="true"]');
    if (await loadingIndicators.count() > 0) {
      await loadingIndicators.first().waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageReady() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle');
    await this.waitForLoading();
  }
}

/**
 * Assertion helpers
 */
export class AssertionHelper {
  constructor(private page: Page) {}

  async expectUrl(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  async expectToastMessage(message: string) {
    const toast = this.page.locator('[data-sonner-toast]').filter({ hasText: new RegExp(message, 'i') });
    await expect(toast).toBeVisible({ timeout: 5000 });
  }

  async expectElementVisible(selector: string) {
    await expect(this.page.locator(selector).first()).toBeVisible();
  }

  async expectElementHidden(selector: string) {
    await expect(this.page.locator(selector).first()).toBeHidden();
  }

  async expectText(text: string) {
    await expect(this.page.locator(`text=${text}`).first()).toBeVisible();
  }

  async expectNoText(text: string) {
    await expect(this.page.locator(`text=${text}`)).toHaveCount(0);
  }
}

/**
 * Screenshot helper for visual testing
 */
export class ScreenshotHelper {
  constructor(private page: Page) {}

  async capture(name: string) {
    await this.page.screenshot({
      path: `e2e-screenshots/${name}.png`,
      fullPage: true,
    });
  }

  async captureElement(selector: string, name: string) {
    const element = this.page.locator(selector).first();
    await element.screenshot({
      path: `e2e-screenshots/${name}.png`,
    });
  }
}

/**
 * Combined test context with all helpers
 */
export function createTestContext(page: Page) {
  return {
    page,
    auth: new AuthHelper(page),
    nav: new NavigationHelper(page),
    form: new FormHelper(page),
    wait: new WaitHelper(page),
    assert: new AssertionHelper(page),
    screenshot: new ScreenshotHelper(page),
  };
}

export type TestContext = ReturnType<typeof createTestContext>;
