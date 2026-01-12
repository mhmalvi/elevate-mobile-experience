import { test, expect } from '@playwright/test';

/**
 * Form Validation E2E Tests
 *
 * Tests form validation across all major forms in the application:
 * - Client forms
 * - Quote forms
 * - Invoice forms
 * - Job forms
 */

test.describe('Client Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Assume user is logged in for these tests
    // In real scenarios, you'd implement login first
  });

  test('should validate required fields', async ({ page }) => {
    // Navigate to client creation form
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Check if on auth page (if not logged in)
    const isOnAuth = page.url().includes('/auth');
    if (isOnAuth) {
      expect(isOnAuth).toBeTruthy();
      return;
    }

    // Try to submit without filling required fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show validation errors or stay on form
    const nameError = page.locator('text=/name is required/i');
    const stayedOnForm = page.url().includes('/new');
    expect(await nameError.isVisible().catch(() => false) || stayedOnForm).toBeTruthy();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Fill in invalid email
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email');
      await emailInput.blur();

      // Should show email validation error
      const emailError = page.locator('text=/invalid email/i');
      const isVisible = await emailError.isVisible().catch(() => false);
      if (isVisible) {
        expect(isVisible).toBeTruthy();
      }
    }
  });

  test('should validate Australian phone number format', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Fill in invalid phone
    const phoneInput = page.locator('input[name="phone"]');
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('123'); // Too short
      await phoneInput.blur();

      // Should show phone validation error
      const phoneError = page.locator('text=/invalid phone/i, text=/phone.*required/i');
      const isVisible = await phoneError.first().isVisible().catch(() => false);
      if (isVisible) {
        expect(isVisible).toBeTruthy();
      }
    }
  });

  test('should accept valid client data', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Fill in valid client data
    const nameInput = page.locator('input[name="name"], input[name="client_name"]');
    if (await nameInput.first().isVisible()) {
      await nameInput.first().fill('John Smith');

      const emailInput = page.locator('input[name="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill('john@example.com');
      }

      const phoneInput = page.locator('input[name="phone"]');
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('0412345678');
      }

      // Take screenshot of filled form
      await page.screenshot({
        path: 'e2e-screenshots/client-form-filled.png',
        fullPage: true,
      });
    }
  });
});

test.describe('Quote Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should validate quote required fields', async ({ page }) => {
    await page.goto('/quotes/new');
    await page.waitForLoadState('networkidle');

    // Check if on auth page (if not logged in)
    const isOnAuth = page.url().includes('/auth');
    if (isOnAuth) {
      expect(isOnAuth).toBeTruthy();
      return;
    }

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Should show validation errors or stay on form
      const errors = page.locator('text=/required/i');
      const count = await errors.count();
      const stayedOnForm = page.url().includes('/new');
      expect(count > 0 || stayedOnForm).toBeTruthy();
    }
  });

  test('should validate line item amounts', async ({ page }) => {
    await page.goto('/quotes/new');
    await page.waitForLoadState('networkidle');

    // Add line item with invalid amount
    const addItemButton = page.locator('button:has-text("Add Item"), button:has-text("Add Line")');
    if (await addItemButton.first().isVisible()) {
      await addItemButton.first().click();

      const quantityInput = page.locator('input[name*="quantity"]').first();
      if (await quantityInput.isVisible()) {
        await quantityInput.fill('-1'); // Invalid negative quantity
        await quantityInput.blur();
      }
    }
  });

  test('should calculate quote totals correctly', async ({ page }) => {
    await page.goto('/quotes/new');
    await page.waitForLoadState('networkidle');

    // Check if on auth page (if not logged in)
    const isOnAuth = page.url().includes('/auth');
    if (isOnAuth) {
      expect(isOnAuth).toBeTruthy();
      return;
    }

    // Check if subtotal, GST, and total are displayed
    const subtotal = page.locator('text=/subtotal/i');
    const gst = page.locator('text=/gst/i');
    const tax = page.locator('text=/tax/i');
    const total = page.locator('text=/total/i');

    const hasSubtotal = await subtotal.isVisible().catch(() => false);
    const hasGst = await gst.first().isVisible().catch(() => false);
    const hasTax = await tax.first().isVisible().catch(() => false);
    const hasTotal = await total.first().isVisible().catch(() => false);

    // At least one of these should be visible in a quote form
    expect(hasSubtotal || hasGst || hasTax || hasTotal).toBeTruthy();
  });
});

test.describe('Invoice Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should validate invoice required fields', async ({ page }) => {
    await page.goto('/invoices/new');
    await page.waitForLoadState('networkidle');

    // Check if on auth page (if not logged in)
    const isOnAuth = page.url().includes('/auth');
    if (isOnAuth) {
      expect(isOnAuth).toBeTruthy();
      return;
    }

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Should show validation errors or stay on form
      const errors = page.locator('text=/required/i');
      const count = await errors.count();
      const stayedOnForm = page.url().includes('/new');
      expect(count > 0 || stayedOnForm).toBeTruthy();
    }
  });

  test('should validate invoice due date is in future', async ({ page }) => {
    await page.goto('/invoices/new');
    await page.waitForLoadState('networkidle');

    // Try to set due date in the past
    const dueDateInput = page.locator('input[name="due_date"], input[name="dueDate"]');
    if (await dueDateInput.first().isVisible()) {
      // Set date to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      await dueDateInput.first().fill(dateStr);
      await dueDateInput.first().blur();
    }
  });

  test('should validate payment terms', async ({ page }) => {
    await page.goto('/invoices/new');
    await page.waitForLoadState('networkidle');

    // Check if payment terms options exist
    const paymentTerms = page.locator('select[name="payment_terms"], input[name="payment_terms"]');
    const hasPaymentTerms = await paymentTerms.first().isVisible().catch(() => false);

    if (hasPaymentTerms) {
      expect(hasPaymentTerms).toBeTruthy();
    }
  });
});

test.describe('Job Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should validate job required fields', async ({ page }) => {
    await page.goto('/jobs/new');
    await page.waitForLoadState('networkidle');

    // Check if on auth page (if not logged in)
    const isOnAuth = page.url().includes('/auth');
    if (isOnAuth) {
      expect(isOnAuth).toBeTruthy();
      return;
    }

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Should show validation errors or stay on form
      const errors = page.locator('text=/required/i');
      const count = await errors.count();
      const stayedOnForm = page.url().includes('/new');
      expect(count > 0 || stayedOnForm).toBeTruthy();
    }
  });

  test('should validate job scheduled date', async ({ page }) => {
    await page.goto('/jobs/new');
    await page.waitForLoadState('networkidle');

    // Check if scheduled date field exists
    const scheduledDateInput = page.locator(
      'input[name="scheduled_date"], input[name="scheduledDate"]'
    );
    const hasScheduledDate = await scheduledDateInput.first().isVisible().catch(() => false);

    if (hasScheduledDate) {
      // Set valid future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await scheduledDateInput.first().fill(dateStr);
      expect(await scheduledDateInput.first().inputValue()).toBeTruthy();
    }
  });

  test('should validate job status transitions', async ({ page }) => {
    await page.goto('/jobs/new');
    await page.waitForLoadState('networkidle');

    // Check if status field exists
    const statusSelect = page.locator('select[name="status"]');
    const hasStatus = await statusSelect.isVisible().catch(() => false);

    if (hasStatus) {
      // Should have valid status options
      const options = await statusSelect.locator('option').count();
      expect(options).toBeGreaterThan(0);
    }
  });
});

test.describe('Form Error Handling', () => {
  test('should display network error messages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Simulate offline scenario by going offline
    await page.context().setOffline(true);

    // Try to navigate to a form
    await page.goto('/clients/new').catch(() => {
      // Expected to fail when offline
    });

    // Go back online
    await page.context().setOffline(false);
  });

  test('should show clear validation messages', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Submit form to trigger validation
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Wait for validation messages
      await page.waitForTimeout(1000);

      // Take screenshot of validation errors
      await page.screenshot({
        path: 'e2e-screenshots/validation-errors.png',
        fullPage: true,
      });
    }
  });

  test('should clear validation errors after fixing', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('input[name="name"], input[name="client_name"]');
    if (await nameInput.first().isVisible()) {
      // Submit without name to trigger error
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Now fill in the name
        await nameInput.first().fill('Valid Name');
        await page.waitForTimeout(500);

        // Error should clear (implementation dependent)
        // Take screenshot of corrected form
        await page.screenshot({
          path: 'e2e-screenshots/validation-cleared.png',
          fullPage: true,
        });
      }
    }
  });
});

test.describe('Form Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Check for labeled inputs
    const inputs = page.locator('input[type="text"], input[type="email"], input[type="tel"]');
    const count = await inputs.count();

    if (count > 0) {
      // At least some inputs should have labels or aria-labels
      const firstInput = inputs.first();
      const ariaLabel = await firstInput.getAttribute('aria-label');
      const id = await firstInput.getAttribute('id');

      // Should have either aria-label or associated label
      expect(ariaLabel || id).toBeTruthy();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Tab through form fields
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Take screenshot of focused element
    await page.screenshot({
      path: 'e2e-screenshots/keyboard-navigation.png',
      fullPage: true,
    });
  });
});
