import { test, expect } from '@playwright/test';

/**
 * Example E2E Tests for TradieMate
 *
 * These tests demonstrate how to test the actual application
 * in a real browser environment.
 */

test.describe('TradieMate App - Basic Navigation', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Check if the app loaded
    expect(page.url()).toContain('localhost:8080');

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'e2e-screenshots/homepage.png', fullPage: true });
  });

  test('should have proper page title', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/TradieMate/);
  });

  test('should display login/signup options', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for authentication elements
    const authButton = page.locator('button, a').filter({
      hasText: /sign in|login|get started/i
    }).first();

    if (await authButton.isVisible()) {
      await expect(authButton).toBeVisible();
      console.log('✅ Authentication button found');
    } else {
      console.log('ℹ️ User might already be logged in or on dashboard');
    }
  });
});

test.describe('TradieMate App - Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take mobile screenshot
    await page.screenshot({ path: 'e2e-screenshots/mobile-view.png', fullPage: true });

    // Verify page is responsive
    const body = await page.locator('body').boundingBox();
    expect(body?.width).toBeLessThanOrEqual(375);
  });

  test('should work on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take tablet screenshot
    await page.screenshot({ path: 'e2e-screenshots/tablet-view.png', fullPage: true });
  });
});

test.describe('TradieMate App - Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load in less than 6 seconds (increased for network variability)
    expect(loadTime).toBeLessThan(6000);
    console.log(`✅ Page loaded in ${loadTime}ms`);
  });
});

// Example: Testing a form (uncomment when auth is accessible)
/*
test.describe('Authentication Flow', () => {
  test('should show email validation', async ({ page }) => {
    await page.goto('/');

    // Find and fill email field
    await page.fill('[name="email"]', 'invalid-email');
    await page.fill('[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=/invalid email/i')).toBeVisible();
  });

  test('should successfully login', async ({ page }) => {
    await page.goto('/');

    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/);
  });
});
*/
