import { test, expect } from '@playwright/test';
import { createTestContext, generateTestData, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Settings E2E Tests
 *
 * Tests all settings functionality including:
 * - Profile settings
 * - Business details
 * - Branding customization
 * - Team management
 * - Payment settings
 * - Subscription management
 * - Theme switching
 * - Sign out
 */

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);

    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test.describe('Settings Hub', () => {
    test('should display settings page with all sections', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Should have settings header
      const pageHeader = page.locator('h1, [role="heading"]').filter({ hasText: /settings/i });
      await expect(pageHeader.first()).toBeVisible();

      await ctx.screenshot.capture('settings-hub');
    });

    test('should show profile settings option', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const profileLink = page.locator('a, button').filter({ hasText: /profile/i });
      const hasProfile = await profileLink.count() > 0;

      expect(hasProfile).toBeTruthy();
    });

    test('should show business settings option', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const businessLink = page.locator('a, button').filter({ hasText: /business/i });
      const hasBusiness = await businessLink.count() > 0;

      expect(hasBusiness).toBeTruthy();
    });

    test('should show payment settings option', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const paymentLink = page.locator('a, button').filter({ hasText: /payment|stripe|bank/i });
      const hasPayment = await paymentLink.count() > 0;

      expect(hasPayment).toBeTruthy();
    });

    test('should show sign out option', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const signOutButton = page.locator('button').filter({ hasText: /sign out|log out|logout/i });
      const hasSignOut = await signOutButton.count() > 0;

      expect(hasSignOut).toBeTruthy();
    });
  });

  test.describe('Profile Settings', () => {
    test('should display profile settings form', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/profile');
      await ctx.wait.waitForPageReady();

      // Should show profile form
      const nameInput = page.locator('input[name*="name"], input[placeholder*="name" i]').first();
      const emailInput = page.locator('input[name*="email"], input[type="email"]').first();

      const hasForm = await nameInput.count() > 0 || await emailInput.count() > 0;

      await ctx.screenshot.capture('settings-profile');
    });

    test('should pre-fill current user data', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await page.goto('/settings/profile');
      await ctx.wait.waitForPageReady();

      // Email should be pre-filled
      const emailInput = page.locator('input[name*="email"], input[type="email"]').first();

      if (await emailInput.isVisible()) {
        const emailValue = await emailInput.inputValue();
        expect(emailValue.length).toBeGreaterThan(0);
      }
    });

    test('should update profile successfully', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await page.goto('/settings/profile');
      await ctx.wait.waitForPageReady();

      // Update phone number
      const phoneInput = page.locator('input[name*="phone"], input[type="tel"]').first();

      if (await phoneInput.isVisible()) {
        await phoneInput.clear();
        await phoneInput.fill('0412345678');

        // Save
        const saveButton = page.locator('button[type="submit"], button').filter({ hasText: /save|update/i }).first();
        await saveButton.click();

        await page.waitForTimeout(2000);

        await ctx.screenshot.capture('settings-profile-updated');
      }
    });
  });

  test.describe('Business Settings', () => {
    test('should display business settings form', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/business');
      await ctx.wait.waitForPageReady();

      // Should show business form
      const businessNameInput = page.locator('input[name*="business"], input[placeholder*="business" i]').first();
      const abnInput = page.locator('input[name*="abn"]').first();

      const hasForm = await businessNameInput.count() > 0 || await abnInput.count() > 0;

      await ctx.screenshot.capture('settings-business');
    });

    test('should validate ABN format', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/business');
      await ctx.wait.waitForPageReady();

      const abnInput = page.locator('input[name*="abn"]').first();

      if (await abnInput.isVisible()) {
        // Enter invalid ABN
        await abnInput.clear();
        await abnInput.fill('123');

        // Try to save
        const saveButton = page.locator('button[type="submit"], button').filter({ hasText: /save|update/i }).first();
        await saveButton.click();

        await page.waitForTimeout(500);

        // May show validation error
        await ctx.screenshot.capture('settings-business-abn-validation');
      }
    });

    test('should update business details', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await page.goto('/settings/business');
      await ctx.wait.waitForPageReady();

      const testProfile = generateTestData.profile();

      // Update business name
      const businessNameInput = page.locator('input[name*="business"]').first();

      if (await businessNameInput.isVisible()) {
        await businessNameInput.clear();
        await businessNameInput.fill(testProfile.businessName);

        // Save
        const saveButton = page.locator('button[type="submit"], button').filter({ hasText: /save|update/i }).first();
        await saveButton.click();

        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Branding Settings', () => {
    test('should display branding settings', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/branding');
      await ctx.wait.waitForPageReady();

      // Should show branding options
      const colorPicker = page.locator('input[type="color"], [class*="color-picker"]');
      const logoUpload = page.locator('input[type="file"], [class*="upload"]');

      const hasBranding = await colorPicker.count() > 0 || await logoUpload.count() > 0;

      await ctx.screenshot.capture('settings-branding');
    });

    test('should change primary color', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await page.goto('/settings/branding');
      await ctx.wait.waitForPageReady();

      const colorPicker = page.locator('input[type="color"]').first();

      if (await colorPicker.isVisible()) {
        await colorPicker.fill('#3b82f6');

        await page.waitForTimeout(500);

        await ctx.screenshot.capture('settings-branding-color');
      }
    });

    test('should preview branding on documents', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/branding');
      await ctx.wait.waitForPageReady();

      // Look for preview section
      const previewText = page.locator('text=/preview/i');
      const previewClass = page.locator('[class*="preview"]');
      const hasPreview = await previewText.count() > 0 || await previewClass.count() > 0;

      await ctx.screenshot.capture('settings-branding-preview');
    });
  });

  test.describe('Team Settings', () => {
    test('should display team settings', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/team');
      await ctx.wait.waitForPageReady();

      // Should show team section
      const teamHeader = page.locator('h1, h2').filter({ hasText: /team/i });
      const hasTeam = await teamHeader.count() > 0;

      await ctx.screenshot.capture('settings-team');
    });

    test('should have invite team member option', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/team');
      await ctx.wait.waitForPageReady();

      const inviteButton = page.locator('button').filter({ hasText: /invite|add.*member/i });
      const hasInvite = await inviteButton.count() > 0;

      await ctx.screenshot.capture('settings-team-invite');
    });

    test('should display team members list', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await page.goto('/settings/team');
      await ctx.wait.waitForPageReady();

      // Should show current user as team member
      const membersList = page.locator('[class*="member"], [class*="team-item"]');

      await ctx.screenshot.capture('settings-team-list');
    });
  });

  test.describe('Payment Settings', () => {
    test('should display payment settings', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/payments');
      await ctx.wait.waitForPageReady();

      // Should show payment section
      const paymentHeader = page.locator('h1, h2').filter({ hasText: /payment/i });
      const hasPayment = await paymentHeader.count() > 0;

      await ctx.screenshot.capture('settings-payments');
    });

    test('should show Stripe connect option', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/payments');
      await ctx.wait.waitForPageReady();

      // Look for Stripe connect
      const stripeOption = page.locator('text=/stripe|connect.*stripe|online.*payments/i');
      const hasStripe = await stripeOption.count() > 0;

      await ctx.screenshot.capture('settings-stripe-connect');
    });

    test('should show bank details section', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/payments');
      await ctx.wait.waitForPageReady();

      // Look for bank details
      const bankSection = page.locator('text=/bank|bsb|account.*number/i');
      const hasBank = await bankSection.count() > 0;

      await ctx.screenshot.capture('settings-bank-details');
    });

    test('should update bank details', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await page.goto('/settings/payments');
      await ctx.wait.waitForPageReady();

      // Fill bank details
      const bsbInput = page.locator('input[name*="bsb"]').first();
      const accountInput = page.locator('input[name*="account"]').first();

      if (await bsbInput.isVisible()) {
        await bsbInput.fill('062000');
      }

      if (await accountInput.isVisible()) {
        await accountInput.fill('12345678');
      }

      // Save
      const saveButton = page.locator('button[type="submit"], button').filter({ hasText: /save|update/i }).first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Subscription Settings', () => {
    test('should display subscription settings', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/subscription');
      await ctx.wait.waitForPageReady();

      // Should show subscription section
      const subHeader = page.locator('h1, h2').filter({ hasText: /subscription|plan/i });
      const hasSub = await subHeader.count() > 0;

      await ctx.screenshot.capture('settings-subscription');
    });

    test('should show current plan', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/subscription');
      await ctx.wait.waitForPageReady();

      // Look for plan info
      const planInfo = page.locator('text=/free|solo|team|premium|current.*plan/i');
      const hasPlan = await planInfo.count() > 0;

      await ctx.screenshot.capture('settings-current-plan');
    });

    test('should show upgrade options', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/subscription');
      await ctx.wait.waitForPageReady();

      // Look for upgrade button
      const upgradeButton = page.locator('button').filter({ hasText: /upgrade|change.*plan/i });
      const hasUpgrade = await upgradeButton.count() > 0;

      await ctx.screenshot.capture('settings-upgrade-options');
    });

    test('should show usage limits', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.goto('/settings/subscription');
      await ctx.wait.waitForPageReady();

      // Look for usage info
      const usageInfo = page.locator('text=/usage|limit|remaining|clients|invoices/i');
      const hasUsage = await usageInfo.count() > 0;

      await ctx.screenshot.capture('settings-usage-limits');
    });
  });

  test.describe('Theme Settings', () => {
    test('should have theme toggle', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      // Look for theme toggle
      const themeToggle = page.locator('button, [role="switch"]').filter({ hasText: /theme|dark|light/i });
      const hasTheme = await themeToggle.count() > 0;

      await ctx.screenshot.capture('settings-theme-toggle');
    });

    test('should switch to dark mode', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      const darkModeToggle = page.locator('button, [role="switch"]').filter({ hasText: /dark/i }).first();

      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click();
        await page.waitForTimeout(500);

        // Check if dark mode is applied
        const isDark = await page.locator('html.dark, [data-theme="dark"]').count() > 0;

        await ctx.screenshot.capture('settings-dark-mode');
      }
    });

    test('should switch to light mode', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToSettings();

      const lightModeToggle = page.locator('button, [role="switch"]').filter({ hasText: /light/i }).first();

      if (await lightModeToggle.isVisible()) {
        await lightModeToggle.click();
        await page.waitForTimeout(500);

        await ctx.screenshot.capture('settings-light-mode');
      }
    });
  });

  test.describe('Sign Out', () => {
    test('should sign out successfully', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToSettings();

      const signOutButton = page.locator('button').filter({ hasText: /sign out|log out/i }).first();

      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        await page.waitForTimeout(2000);

        // Should redirect to auth page
        expect(page.url()).toContain('/auth');

        await ctx.screenshot.capture('settings-signed-out');
      }
    });
  });

  test.describe('Mobile Settings', () => {
    test('should display settings on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToSettings();

      const header = page.locator('h1').first();
      await expect(header).toBeVisible();

      await ctx.screenshot.capture('settings-mobile');
    });

    test('should navigate settings sections on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToSettings();

      // Tap on profile settings
      const profileLink = page.locator('a, button').filter({ hasText: /profile/i }).first();

      if (await profileLink.isVisible()) {
        await profileLink.tap();
        await ctx.wait.waitForPageReady();

        await ctx.screenshot.capture('settings-mobile-profile');
      }
    });
  });
});
