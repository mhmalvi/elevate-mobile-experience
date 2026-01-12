import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { TEST_USER } from './fixtures/test-helpers';

/**
 * Authentication Setup for E2E Tests
 *
 * This file sets up authentication state that can be reused across tests
 * to avoid logging in before every test.
 */

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if we're already logged in
  const isLoggedIn = await page.locator('text=/dashboard|logout|sign out/i').isVisible().catch(() => false);

  if (isLoggedIn) {
    console.log('✅ Already authenticated');
    await page.context().storageState({ path: authFile });
    return;
  }

  // Look for login/signup button
  const authButton = page.locator('button, a').filter({
    hasText: /sign in|login|get started/i
  }).first();

  if (await authButton.isVisible()) {
    await authButton.click();
    await page.waitForLoadState('networkidle');

    // Use test user credentials from test-helpers
    const testEmail = TEST_USER.email;
    const testPassword = TEST_USER.password;

    // Try to fill in login form if it exists
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      console.log('📝 Filling login form...');
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);

      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  }

  // Wait for successful login (look for dashboard or logged-in indicators)
  try {
    await page.waitForSelector('text=/dashboard|welcome|home/i', { timeout: 5000 });
    console.log('✅ Authentication successful');
  } catch (e) {
    console.log('⚠️ Could not verify authentication - tests may need manual login');
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
