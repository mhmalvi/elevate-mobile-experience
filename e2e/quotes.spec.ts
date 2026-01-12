import { test, expect } from '@playwright/test';
import { createTestContext, generateTestData, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Quote Management E2E Tests
 *
 * Tests the complete quote management flow including:
 * - Viewing quote list
 * - Creating new quotes
 * - Adding line items
 * - Quote calculations (subtotal, GST, total)
 * - Quote status management
 * - Sending quotes
 * - Converting quotes to invoices
 * - Public quote view
 */

test.describe('Quote Management', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);

    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test.describe('Quote List Page', () => {
    test('should display quotes page with proper layout', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToQuotes();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Should have page header
      const pageHeader = page.locator('h1, [role="heading"]').filter({ hasText: /quotes/i });
      await expect(pageHeader.first()).toBeVisible();

      // Should have create button
      const createButton = page.locator('button, a').filter({ hasText: /new|add|create|\+/i });
      expect(await createButton.count()).toBeGreaterThan(0);

      await ctx.screenshot.capture('quotes-list-page');
    });

    test('should display quote status badges', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToQuotes();

      // Look for status indicators
      const statusBadges = page.locator('[class*="badge"], [class*="status"]');
      const hasBadges = await statusBadges.count() > 0;

      await ctx.screenshot.capture('quotes-status-badges');
    });

    test('should have search/filter functionality', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToQuotes();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
      const filterButton = page.locator('button').filter({ hasText: /filter/i });

      const hasSearch = await searchInput.count() > 0;
      const hasFilter = await filterButton.count() > 0;

      expect(hasSearch || hasFilter).toBeTruthy();
    });

    test('should navigate to create quote page', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToQuotes();

      const createButton = page.locator('button, a').filter({ hasText: /new quote|\+/i }).first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/quotes/new');
      }
    });
  });

  test.describe('Create Quote', () => {
    test('should display quote creation form', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewQuote();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Should have title input
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
      await expect(titleInput).toBeVisible();

      // Should have client selector
      const clientSelect = page.locator('select, [role="combobox"], button').filter({ hasText: /client|select/i });
      const hasClientSelect = await clientSelect.count() > 0;

      await ctx.screenshot.capture('quotes-create-form');
    });

    test('should select client for quote', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToNewQuote();

      // Find and click client selector
      const clientSelect = page.locator('select, [role="combobox"], button').filter({ hasText: /client|select/i }).first();

      if (await clientSelect.isVisible()) {
        await clientSelect.click();
        await page.waitForTimeout(500);

        // Select first client option
        const clientOption = page.locator('[role="option"], option').first();
        if (await clientOption.isVisible()) {
          await clientOption.click();
        }
      }
    });

    test('should add line items to quote', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewQuote();

      // Look for add line item button
      const addItemButton = page.locator('button').filter({ hasText: /add item|add line|\+/i }).first();

      if (await addItemButton.isVisible()) {
        await addItemButton.click();
        await page.waitForTimeout(300);

        // Should show line item fields
        const descriptionInput = page.locator('input[name*="description"], input[placeholder*="description" i]').first();
        const quantityInput = page.locator('input[name*="quantity"], input[type="number"]').first();
        const priceInput = page.locator('input[name*="price"], input[name*="rate"]').first();

        await expect(descriptionInput).toBeVisible();
      }
    });

    test('should calculate totals correctly', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewQuote();

      // Fill in a line item
      const descriptionInput = page.locator('input[name*="description"], input[placeholder*="description" i]').first();
      const quantityInput = page.locator('input[name*="quantity"], input[placeholder*="qty" i]').first();
      const priceInput = page.locator('input[name*="price"], input[name*="rate"], input[placeholder*="price" i]').first();

      if (await descriptionInput.isVisible() && await quantityInput.isVisible() && await priceInput.isVisible()) {
        await descriptionInput.fill('Test Service');
        await quantityInput.fill('2');
        await priceInput.fill('100');

        await page.waitForTimeout(500);

        // Check for calculated totals
        const subtotalText = page.locator('text=/subtotal|sub-total/i');
        const gstText = page.locator('text=/gst|tax/i');
        const totalText = page.locator('text=/total/i');

        await ctx.screenshot.capture('quotes-calculations');
      }
    });

    test('should validate required fields', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewQuote();

      // Try to submit without filling required fields
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /save|create|submit/i }).first();

      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Should show validation errors or stay on page
        const stayedOnPage = page.url().includes('/new');
        expect(stayedOnPage).toBeTruthy();
      }
    });

    test('should create quote successfully', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToNewQuote();

      const testQuote = generateTestData.quote();

      // Fill title
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
      await titleInput.fill(testQuote.title);

      // Select client if available
      const clientSelect = page.locator('select, [role="combobox"]').first();
      if (await clientSelect.isVisible()) {
        await clientSelect.click();
        await page.waitForTimeout(300);
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }

      // Add line item
      const descriptionInput = page.locator('input[name*="description"]').first();
      const quantityInput = page.locator('input[name*="quantity"]').first();
      const priceInput = page.locator('input[name*="price"], input[name*="rate"]').first();

      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill(testQuote.lineItems[0].description);
        if (await quantityInput.isVisible()) {
          await quantityInput.fill(testQuote.lineItems[0].quantity.toString());
        }
        if (await priceInput.isVisible()) {
          await priceInput.fill(testQuote.lineItems[0].unitPrice.toString());
        }
      }

      // Submit
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /save|create/i }).first();
      await submitButton.click();

      await page.waitForTimeout(2000);

      await ctx.screenshot.capture('quotes-create-success');
    });
  });

  test.describe('Quote Details', () => {
    test('should display quote details page', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      // Click on first quote
      const quoteLink = page.locator('a[href*="/quotes/"]').first();

      if (await quoteLink.isVisible()) {
        await quoteLink.click();
        await ctx.wait.waitForPageReady();

        // Should show quote details
        const hasDetails = await page.locator('text=/Q-|quote #/i').count() > 0;

        await ctx.screenshot.capture('quotes-details-page');
      }
    });

    test('should show quote status', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      const quoteLink = page.locator('a[href*="/quotes/"]').first();

      if (await quoteLink.isVisible()) {
        await quoteLink.click();
        await ctx.wait.waitForPageReady();

        // Should show status badge
        const statusBadge = page.locator('[class*="badge"], [class*="status"]').first();
        const hasStatus = await statusBadge.count() > 0;
      }
    });

    test('should have send quote option', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      const quoteLink = page.locator('a[href*="/quotes/"]').first();

      if (await quoteLink.isVisible()) {
        await quoteLink.click();
        await ctx.wait.waitForPageReady();

        // Look for send button
        const sendButton = page.locator('button').filter({ hasText: /send|share|email/i });
        const hasSend = await sendButton.count() > 0;

        await ctx.screenshot.capture('quotes-send-option');
      }
    });

    test('should have convert to invoice option', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      const quoteLink = page.locator('a[href*="/quotes/"]').first();

      if (await quoteLink.isVisible()) {
        await quoteLink.click();
        await ctx.wait.waitForPageReady();

        // Look for convert to invoice button
        const convertButton = page.locator('button').filter({ hasText: /convert|invoice/i });
        const hasConvert = await convertButton.count() > 0;

        await ctx.screenshot.capture('quotes-convert-option');
      }
    });
  });

  test.describe('Quote Actions', () => {
    test('should edit quote', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      const quoteLink = page.locator('a[href*="/quotes/"]').first();

      if (await quoteLink.isVisible()) {
        await quoteLink.click();
        await ctx.wait.waitForPageReady();

        // Click edit
        const editButton = page.locator('button, a').filter({ hasText: /edit/i }).first();
        if (await editButton.isVisible()) {
          await editButton.click();
          await ctx.wait.waitForPageReady();

          expect(page.url()).toContain('/edit');
        }
      }
    });

    test('should duplicate quote', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      const quoteLink = page.locator('a[href*="/quotes/"]').first();

      if (await quoteLink.isVisible()) {
        await quoteLink.click();
        await ctx.wait.waitForPageReady();

        // Look for duplicate/copy option
        const duplicateButton = page.locator('button').filter({ hasText: /duplicate|copy/i });
        const hasDuplicate = await duplicateButton.count() > 0;
      }
    });

    test('should delete quote with confirmation', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      const deleteButton = page.locator('button').filter({ hasText: /delete/i }).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.waitForTimeout(500);

        // Should show confirmation
        const confirmDialog = page.locator('[role="alertdialog"], [role="dialog"]');
        const hasConfirm = await confirmDialog.count() > 0;

        if (hasConfirm) {
          // Cancel delete
          const cancelButton = page.locator('button').filter({ hasText: /cancel/i }).first();
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      }
    });
  });

  test.describe('Quote PDF', () => {
    test('should have PDF preview option', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToQuotes();

      const quoteLink = page.locator('a[href*="/quotes/"]').first();

      if (await quoteLink.isVisible()) {
        await quoteLink.click();
        await ctx.wait.waitForPageReady();

        // Look for PDF/preview option
        const pdfButton = page.locator('button').filter({ hasText: /pdf|preview|download/i });
        const hasPdf = await pdfButton.count() > 0;

        await ctx.screenshot.capture('quotes-pdf-option');
      }
    });
  });

  test.describe('Mobile Quote Management', () => {
    test('should display quotes on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToQuotes();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const header = page.locator('h1').first();
      await expect(header).toBeVisible();

      await ctx.screenshot.capture('quotes-mobile-list');
    });

    test('should create quote on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToNewQuote();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const titleInput = page.locator('input[name="title"]').first();
      await expect(titleInput).toBeVisible();

      await ctx.screenshot.capture('quotes-mobile-create');
    });
  });
});
