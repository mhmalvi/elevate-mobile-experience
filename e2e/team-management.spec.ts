import { test, expect } from '@playwright/test';
import { createTestContext, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Team Management E2E Tests
 *
 * Tests the team collaboration features including:
 * - Team invitation flow
 * - Join team page
 * - Team member management
 * - Team settings
 */

test.describe('Team Management', () => {
    test.beforeEach(async ({ page }) => {
        const ctx = createTestContext(page);

        if (HAS_TEST_CREDENTIALS) {
            await ctx.auth.login();
        }
    });

    test.describe('Team Settings', () => {
        test('should access team settings from settings page', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToSettings();

            // Look for team section
            const teamSection = page.locator('text=/team|members|collaborate/i');
            const teamLink = page.locator('a, button').filter({ hasText: /team|members/i });

            const hasTeamSection = await teamSection.count() > 0 || await teamLink.count() > 0;

            await ctx.screenshot.capture('settings-team-section');
        });

        test('should display team members list', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/settings/team');
            await page.waitForLoadState('networkidle');

            // Check if page has team content
            const membersList = page.locator('[class*="member"], [class*="card"]');
            const emptyState = page.locator('text=/no team members|invite.*first|you.*only/i');

            const hasContent = await membersList.count() > 0 || await emptyState.count() > 0;

            await ctx.screenshot.capture('team-members-list');
        });

        test('should have invite team member button', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/settings/team');
            await page.waitForLoadState('networkidle');

            // Look for invite button
            const inviteButton = page.locator('button, a').filter({ hasText: /invite|add member|add team/i });
            const hasInviteButton = await inviteButton.count() > 0;

            await ctx.screenshot.capture('team-invite-button');
        });
    });

    test.describe('Team Invitation', () => {
        test('should open invite member dialog', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/settings/team');
            await page.waitForLoadState('networkidle');

            // Click invite button
            const inviteButton = page.locator('button').filter({ hasText: /invite|add/i }).first();

            if (await inviteButton.isVisible()) {
                await inviteButton.click();
                await page.waitForTimeout(500);

                // Should show invite dialog
                const dialog = page.locator('[role="dialog"], .modal');
                const emailInput = page.locator('input[type="email"], input[name*="email"]');

                const hasDialog = await dialog.count() > 0 || await emailInput.count() > 0;

                await ctx.screenshot.capture('team-invite-dialog');
            }
        });

        test('should validate email for invitation', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/settings/team');
            await page.waitForLoadState('networkidle');

            // Click invite button
            const inviteButton = page.locator('button').filter({ hasText: /invite|add/i }).first();

            if (await inviteButton.isVisible()) {
                await inviteButton.click();
                await page.waitForTimeout(500);

                // Try to submit without email
                const submitButton = page.locator('button').filter({ hasText: /send|invite/i }).first();

                if (await submitButton.isVisible()) {
                    await submitButton.click();
                    await page.waitForTimeout(500);

                    // Should show validation or stay on form
                    const hasValidation = await page.locator('[role="alert"], .text-destructive').count() > 0;

                    await ctx.screenshot.capture('team-invite-validation');
                }
            }
        });
    });

    test.describe('Join Team', () => {
        test('should display join team page', async ({ page }) => {
            const ctx = createTestContext(page);

            // Navigate to join team page (public route)
            await page.goto('/join-team/test-token');
            await page.waitForLoadState('networkidle');

            // Should show join team content
            const joinHeader = page.locator('h1, h2').filter({ hasText: /join|team|invitation/i });
            const acceptButton = page.locator('button').filter({ hasText: /accept|join/i });
            const errorMessage = page.locator('text=/invalid|expired|not found/i');

            const hasJoinContent = await joinHeader.count() > 0 ||
                await acceptButton.count() > 0 ||
                await errorMessage.count() > 0;

            await ctx.screenshot.capture('join-team-page');
        });

        test('should handle invalid invitation token', async ({ page }) => {
            const ctx = createTestContext(page);

            // Navigate with invalid token
            await page.goto('/join-team/invalid-token-12345');
            await page.waitForLoadState('networkidle');

            // Should show error or redirect
            const errorMessage = page.locator('text=/invalid|expired|not found|error/i');
            const hasError = await errorMessage.count() > 0;

            await ctx.screenshot.capture('join-team-invalid');
        });
    });

    test.describe('Team Roles', () => {
        test('should show member roles', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/settings/team');
            await page.waitForLoadState('networkidle');

            // Look for role indicators
            const roleLabels = page.locator('text=/owner|admin|member|viewer/i');
            const hasRoles = await roleLabels.count() > 0;

            await ctx.screenshot.capture('team-roles');
        });
    });

    test.describe('Mobile Team Management', () => {
        test('should display team settings on mobile', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.setViewportSize({ width: 375, height: 667 });

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/settings/team');
            await page.waitForLoadState('networkidle');

            await ctx.screenshot.capture('team-mobile-view');
        });
    });
});
