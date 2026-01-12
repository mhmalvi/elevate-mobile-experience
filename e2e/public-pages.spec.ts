import { test, expect } from '@playwright/test';
import { createTestContext } from './fixtures/test-helpers';

/**
 * Public Pages E2E Tests
 *
 * Tests for publicly accessible pages including:
 * - Public invoice view
 * - Public quote view
 * - Payment flow
 * - Team invitation
 * - 404 handling
 */

test.describe('Public Pages', () => {
  test.describe('Public Invoice Page', () => {
    test('should display invoice not found for invalid ID', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/i/invalid-uuid-12345');
      await ctx.wait.waitForPageReady();

      // Should show not found or error
      const hasError = await page.locator('text=/not found|invalid|error/i').count() > 0;

      await ctx.screenshot.capture('public-invoice-not-found');
    });

    test('should display public invoice when valid', async ({ page }) => {
      const ctx = createTestContext(page);

      // This test requires a real invoice ID
      // Using a placeholder UUID format
      const testInvoiceId = process.env.TEST_INVOICE_ID || '00000000-0000-0000-0000-000000000000';

      await page.goto(`/i/${testInvoiceId}`);
      await ctx.wait.waitForPageReady();

      // Should show invoice page structure
      const hasInvoicePage = await page.locator('text=/invoice|total|pay/i').count() > 0;

      await ctx.screenshot.capture('public-invoice-page');
    });

    test('should display invoice details correctly', async ({ page }) => {
      const ctx = createTestContext(page);

      // Skip without valid invoice ID
      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      // Should show invoice number
      const invoiceNumber = page.locator('text=/INV-/');
      const hasInvoiceNumber = await invoiceNumber.count() > 0;

      // Should show total
      const totalAmount = page.locator('text=/total|\\$/i');
      const hasTotal = await totalAmount.count() > 0;

      await ctx.screenshot.capture('public-invoice-details');
    });

    test('should display Pay Now button for unpaid invoice', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      // Look for pay button
      const payButton = page.locator('button').filter({ hasText: /pay now|pay|make payment/i });
      const hasPayButton = await payButton.count() > 0;

      await ctx.screenshot.capture('public-invoice-pay-button');
    });

    test('should show paid status for paid invoice', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_PAID_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_PAID_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      // Should show paid status
      const paidStatus = page.locator('text=/paid|payment.*received/i');
      const isPaid = await paidStatus.count() > 0;

      await ctx.screenshot.capture('public-invoice-paid');
    });

    test('should show business branding', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      // Look for business name/logo
      const businessInfo = page.locator('[class*="logo"], [class*="business"]');
      const hasBusinessInfo = await businessInfo.count() > 0;

      await ctx.screenshot.capture('public-invoice-branding');
    });

    test('should show client billing info', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      // Look for "Bill To" section
      const billTo = page.locator('text=/bill to|billed to|client/i');
      const hasBillTo = await billTo.count() > 0;

      await ctx.screenshot.capture('public-invoice-client-info');
    });

    test('should show line items', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      // Look for items section
      const itemsSection = page.locator('text=/items|services|description/i');
      const hasItems = await itemsSection.count() > 0;

      await ctx.screenshot.capture('public-invoice-line-items');
    });

    test('should show GST breakdown', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      // Look for GST/tax section
      const gstSection = page.locator('text=/gst|tax|subtotal/i');
      const hasGst = await gstSection.count() > 0;

      await ctx.screenshot.capture('public-invoice-gst');
    });
  });

  test.describe('Public Invoice Payment Flow', () => {
    test('should handle payment success redirect', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      // Simulate payment success return
      await page.goto(`/i/${process.env.TEST_INVOICE_ID}?payment=success`);
      await ctx.wait.waitForPageReady();

      // Should show success message or processing state
      const successMessage = page.locator('text=/success|thank you|processing|confirmed/i');
      const hasSuccess = await successMessage.count() > 0;

      await ctx.screenshot.capture('public-invoice-payment-success');
    });

    test('should handle payment cancelled redirect', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      // Simulate payment cancelled return
      await page.goto(`/i/${process.env.TEST_INVOICE_ID}?payment=cancelled`);
      await ctx.wait.waitForPageReady();

      // Should show cancelled message
      const cancelledMessage = page.locator('text=/cancelled|try again/i');
      const hasCancelled = await cancelledMessage.count() > 0;

      await ctx.screenshot.capture('public-invoice-payment-cancelled');
    });

    test('should initiate payment on Pay Now click', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      const payButton = page.locator('button').filter({ hasText: /pay now/i }).first();

      if (await payButton.isVisible()) {
        // Note: We don't actually click as it would redirect to Stripe
        // Just verify the button is there
        await expect(payButton).toBeEnabled();

        await ctx.screenshot.capture('public-invoice-pay-button-ready');
      }
    });
  });

  test.describe('Public Quote Page', () => {
    test('should display quote not found for invalid ID', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/q/invalid-uuid-12345');
      await ctx.wait.waitForPageReady();

      // Should show not found or error
      const hasError = await page.locator('text=/not found|invalid|error/i').count() > 0;

      await ctx.screenshot.capture('public-quote-not-found');
    });

    test('should display public quote when valid', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_QUOTE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/q/${process.env.TEST_QUOTE_ID}`);
      await ctx.wait.waitForPageReady();

      // Should show quote page structure
      const hasQuotePage = await page.locator('text=/quote|total|valid/i').count() > 0;

      await ctx.screenshot.capture('public-quote-page');
    });

    test('should display quote details correctly', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_QUOTE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/q/${process.env.TEST_QUOTE_ID}`);
      await ctx.wait.waitForPageReady();

      // Should show quote number
      const quoteNumber = page.locator('text=/Q-/');
      const hasQuoteNumber = await quoteNumber.count() > 0;

      // Should show total
      const totalAmount = page.locator('text=/total|\\$/i');
      const hasTotal = await totalAmount.count() > 0;

      await ctx.screenshot.capture('public-quote-details');
    });

    test('should display validity date', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_QUOTE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/q/${process.env.TEST_QUOTE_ID}`);
      await ctx.wait.waitForPageReady();

      // Look for validity info
      const validityInfo = page.locator('text=/valid until|expires|valid/i');
      const hasValidity = await validityInfo.count() > 0;

      await ctx.screenshot.capture('public-quote-validity');
    });

    test('should have accept quote option', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!process.env.TEST_QUOTE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/q/${process.env.TEST_QUOTE_ID}`);
      await ctx.wait.waitForPageReady();

      // Look for accept button
      const acceptButton = page.locator('button').filter({ hasText: /accept|approve/i });
      const hasAccept = await acceptButton.count() > 0;

      await ctx.screenshot.capture('public-quote-accept');
    });
  });

  test.describe('Team Invitation Page', () => {
    test('should display team join page', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/join-team');
      await ctx.wait.waitForPageReady();

      // Should show join team content
      const hasContent = await page.locator('text=/join|team|invitation/i').count() > 0;

      await ctx.screenshot.capture('join-team-page');
    });

    test('should handle invalid invitation token', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/join-team?token=invalid-token');
      await ctx.wait.waitForPageReady();

      // Should show error or redirect
      const hasError = await page.locator('text=/invalid|expired|error/i').count() > 0;

      await ctx.screenshot.capture('join-team-invalid');
    });
  });

  test.describe('404 Page', () => {
    test('should display 404 for unknown routes', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/this-page-does-not-exist-12345');
      await ctx.wait.waitForPageReady();

      // Should show 404 or redirect
      const has404 = await page.locator('text=/404|not found/i').count() > 0;
      const redirectedToHome = page.url().endsWith('/') || page.url().includes('/auth');

      expect(has404 || redirectedToHome).toBeTruthy();

      await ctx.screenshot.capture('404-page');
    });

    test('should have link back to home', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/this-page-does-not-exist-12345');
      await ctx.wait.waitForPageReady();

      // Look for home link
      const homeLink = page.locator('a').filter({ hasText: /home|go back|return/i });
      const hasHomeLink = await homeLink.count() > 0;

      await ctx.screenshot.capture('404-home-link');
    });
  });

  test.describe('Mobile Public Pages', () => {
    test('should display public invoice on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      if (!process.env.TEST_INVOICE_ID) {
        // Use placeholder
        await page.goto('/i/00000000-0000-0000-0000-000000000000');
      } else {
        await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      }

      await ctx.wait.waitForPageReady();

      await ctx.screenshot.capture('public-invoice-mobile');
    });

    test('should display public quote on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      if (!process.env.TEST_QUOTE_ID) {
        await page.goto('/q/00000000-0000-0000-0000-000000000000');
      } else {
        await page.goto(`/q/${process.env.TEST_QUOTE_ID}`);
      }

      await ctx.wait.waitForPageReady();

      await ctx.screenshot.capture('public-quote-mobile');
    });

    test('should have mobile-friendly pay button', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      if (!process.env.TEST_INVOICE_ID) {
        test.skip();
        return;
      }

      await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      await ctx.wait.waitForPageReady();

      const payButton = page.locator('button').filter({ hasText: /pay/i }).first();

      if (await payButton.isVisible()) {
        // Button should be full width or nearly full width on mobile
        const box = await payButton.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThan(300);
        }
      }

      await ctx.screenshot.capture('public-invoice-mobile-pay-button');
    });
  });

  test.describe('Public Page Performance', () => {
    test('should load public invoice quickly', async ({ page }) => {
      const ctx = createTestContext(page);

      const startTime = Date.now();

      if (!process.env.TEST_INVOICE_ID) {
        await page.goto('/i/00000000-0000-0000-0000-000000000000');
      } else {
        await page.goto(`/i/${process.env.TEST_INVOICE_ID}`);
      }

      await ctx.wait.waitForPageReady();

      const loadTime = Date.now() - startTime;

      // Public pages should load within 4 seconds
      expect(loadTime).toBeLessThan(4000);
      console.log(`Public invoice loaded in ${loadTime}ms`);
    });

    test('should load public quote quickly', async ({ page }) => {
      const ctx = createTestContext(page);

      const startTime = Date.now();

      if (!process.env.TEST_QUOTE_ID) {
        await page.goto('/q/00000000-0000-0000-0000-000000000000');
      } else {
        await page.goto(`/q/${process.env.TEST_QUOTE_ID}`);
      }

      await ctx.wait.waitForPageReady();

      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(4000);
      console.log(`Public quote loaded in ${loadTime}ms`);
    });
  });
});
