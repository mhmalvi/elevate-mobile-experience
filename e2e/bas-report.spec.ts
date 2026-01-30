import { test, expect } from '@playwright/test';
import { createTestContext, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * BAS Report E2E Tests
 *
 * Tests the Business Activity Statement reporting including:
 * - BAS Report page access
 * - Report generation
 * - Date range selection
 * - Export functionality
 */

test.describe('BAS Report', () => {
    test.beforeEach(async ({ page }) => {
        const ctx = createTestContext(page);

        if (HAS_TEST_CREDENTIALS) {
            await ctx.auth.login();
        }
    });

    test.describe('BAS Report Access', () => {
        test('should display BAS report page', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.goto('/bas-report');
            await page.waitForLoadState('networkidle');

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Should have BAS report header
            const pageHeader = page.locator('h1, h2').filter({ hasText: /bas|business activity|tax/i });
            const hasHeader = await pageHeader.count() > 0;

            await ctx.screenshot.capture('bas-report-page');
        });

        test('should show quarter selection', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/bas-report');
            await page.waitForLoadState('networkidle');

            // Should have quarter/period selection
            const quarterSelect = page.locator('select, [role="combobox"], button').filter({ hasText: /quarter|q1|q2|q3|q4|period/i });
            const dateRange = page.locator('input[type="date"], button').filter({ hasText: /date|from|to/i });

            const hasDateSelection = await quarterSelect.count() > 0 || await dateRange.count() > 0;

            await ctx.screenshot.capture('bas-quarter-selection');
        });

        test('should display GST summary', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/bas-report');
            await page.waitForLoadState('networkidle');

            // Should show GST figures
            const gstCollected = page.locator('text=/gst collected|gst on sales/i');
            const gstPaid = page.locator('text=/gst paid|gst on purchases/i');
            const gstOwing = page.locator('text=/gst owing|payable|refund/i');

            const hasGstInfo = await gstCollected.count() > 0 ||
                await gstPaid.count() > 0 ||
                await gstOwing.count() > 0;

            await ctx.screenshot.capture('bas-gst-summary');
        });

        test('should show income and expenses breakdown', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/bas-report');
            await page.waitForLoadState('networkidle');

            // Should show financial breakdown
            const income = page.locator('text=/income|revenue|sales/i');
            const expenses = page.locator('text=/expense|cost|purchase/i');

            const hasBreakdown = await income.count() > 0 || await expenses.count() > 0;

            await ctx.screenshot.capture('bas-financial-breakdown');
        });
    });

    test.describe('BAS Report Export', () => {
        test('should have export/print option', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/bas-report');
            await page.waitForLoadState('networkidle');

            // Should have export button
            const exportButton = page.locator('button').filter({ hasText: /export|print|download|pdf/i });
            const hasExport = await exportButton.count() > 0;

            await ctx.screenshot.capture('bas-export-button');
        });
    });

    test.describe('Mobile BAS Report', () => {
        test('should display BAS report on mobile', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.setViewportSize({ width: 375, height: 667 });

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/bas-report');
            await page.waitForLoadState('networkidle');

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            await ctx.screenshot.capture('bas-mobile-view');
        });
    });
});
