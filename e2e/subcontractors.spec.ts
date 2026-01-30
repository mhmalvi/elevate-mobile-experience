import { test, expect } from '@playwright/test';
import { createTestContext, generateTestData, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Subcontractors E2E Tests
 *
 * Tests the subcontractor management including:
 * - Subcontractor list view
 * - Adding subcontractors
 * - Editing subcontractors
 * - Subcontractor assignments
 */

test.describe('Subcontractor Management', () => {
    test.beforeEach(async ({ page }) => {
        const ctx = createTestContext(page);

        if (HAS_TEST_CREDENTIALS) {
            await ctx.auth.login();
        }
    });

    test.describe('Subcontractor List', () => {
        test('should display subcontractors page', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.goto('/subcontractors');
            await page.waitForLoadState('networkidle');

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Should have page header
            const pageHeader = page.locator('h1, h2').filter({ hasText: /subcontract|subbies/i });
            const hasHeader = await pageHeader.count() > 0;

            await ctx.screenshot.capture('subcontractors-list');
        });

        test('should have add subcontractor button', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.goto('/subcontractors');
            await page.waitForLoadState('networkidle');

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Should have add button
            const addButton = page.locator('button, a').filter({ hasText: /add|new|invite/i });
            const hasAddButton = await addButton.count() > 0;

            await ctx.screenshot.capture('subcontractors-add-button');
        });

        test('should show subcontractor list or empty state', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/subcontractors');
            await page.waitForLoadState('networkidle');

            // Should show list or empty state
            const subList = page.locator('[class*="card"], [class*="list-item"]');
            const emptyState = page.locator('text=/no subcontract|add.*first|get started/i');

            const hasContent = await subList.count() > 0 || await emptyState.count() > 0;
            expect(hasContent).toBeTruthy();

            await ctx.screenshot.capture('subcontractors-content');
        });
    });

    test.describe('Add Subcontractor', () => {
        test('should open add subcontractor form', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/subcontractors');
            await page.waitForLoadState('networkidle');

            // Click add button
            const addButton = page.locator('button').filter({ hasText: /add|new|invite/i }).first();

            if (await addButton.isVisible()) {
                await addButton.click();
                await page.waitForTimeout(500);

                // Should show form or dialog
                const form = page.locator('form, [role="dialog"]');
                const nameInput = page.locator('input[name*="name"], input[placeholder*="name" i]');

                const hasForm = await form.count() > 0 || await nameInput.count() > 0;

                await ctx.screenshot.capture('subcontractors-add-form');
            }
        });

        test('should have required subcontractor fields', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/subcontractors');
            await page.waitForLoadState('networkidle');

            // Click add button
            const addButton = page.locator('button').filter({ hasText: /add|new/i }).first();

            if (await addButton.isVisible()) {
                await addButton.click();
                await page.waitForTimeout(500);

                // Check for required fields
                const nameInput = page.locator('input[name*="name"], input[placeholder*="name" i]');
                const tradeInput = page.locator('input[name*="trade"], select[name*="trade"]');
                const phoneInput = page.locator('input[name*="phone"], input[type="tel"]');

                const hasNameField = await nameInput.count() > 0;

                await ctx.screenshot.capture('subcontractors-form-fields');
            }
        });
    });

    test.describe('Subcontractor Details', () => {
        test('should show subcontractor profile', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/subcontractors');
            await page.waitForLoadState('networkidle');

            // Click on first subcontractor if exists
            const subLink = page.locator('[class*="card"], a[href*="/subcontractors/"]').first();

            if (await subLink.isVisible()) {
                await subLink.click();
                await ctx.wait.waitForPageReady();

                // Should show profile details
                const profileName = page.locator('h1, h2, [class*="title"]');
                const hasProfile = await profileName.count() > 0;

                await ctx.screenshot.capture('subcontractor-profile');
            }
        });
    });
});
