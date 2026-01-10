import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Test credentials
const EMAIL = 'yuanhuafung2021@gmail.com';
const PASSWORD = '90989098';
const BASE_URL = 'http://localhost:8080';

// Screenshot directory setup
const SCREENSHOTS_DIR = 'e2e-screenshots';

/**
 * Ensure screenshot directory exists
 */
function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Visual Audit Test Suite
 * Captures screenshots of all pages in mobile viewport with light/dark themes
 */
test.describe('TradieMate Premium UI Visual Audit', () => {
    // Set generous timeout for comprehensive audit
    test.setTimeout(600000); // 10 minutes

    test.beforeEach(async ({ page }) => {
        // Set mobile viewport (iPhone 13 dimensions)
        await page.setViewportSize({ width: 390, height: 844 });
    });

    test('Complete UI/UX Coverage Audit - Light Mode', async ({ page }) => {
        const theme = 'light';
        const screenshotDir = path.join(SCREENSHOTS_DIR, 'mobile', theme);
        ensureDir(screenshotDir);

        // Helper to capture screenshot with proper waiting
        const capture = async (name: string, options?: { fullPage?: boolean }) => {
            const filePath = path.join(screenshotDir, `${name}.png`);
            console.log(`[${theme.toUpperCase()}] Capturing: ${name}`);

            // Wait for network to settle and animations to complete
            await page.waitForLoadState('networkidle').catch(() => { });
            await page.waitForTimeout(800);

            await page.screenshot({
                path: filePath,
                fullPage: options?.fullPage ?? true,
                animations: 'disabled'
            });
        };

        // ===== STEP 1: LOGIN =====
        console.log('========== AUTHENTICATION ==========');
        await page.goto(`${BASE_URL}/auth`);
        await capture('00-auth-page');

        // Wait for login form to be visible
        const emailInput = page.locator('input[type="email"]');
        await emailInput.waitFor({ state: 'visible', timeout: 10000 });

        // Fill login credentials
        console.log('Filling login credentials...');
        await emailInput.fill(EMAIL);
        await page.locator('input[type="password"]').fill(PASSWORD);

        // Click Sign In and wait for navigation
        console.log('Clicking Sign In...');
        await page.locator('button:has-text("Sign In")').click();

        // Wait for successful login - should redirect to dashboard
        try {
            await page.waitForURL('**/dashboard', { timeout: 15000 });
            console.log('✓ Login successful! Redirected to dashboard.');
        } catch (e) {
            // Check if we're still on auth page (login failed)
            const currentUrl = page.url();
            console.error(`✗ Login may have failed. Current URL: ${currentUrl}`);

            // Capture the error state
            await capture('ERROR-login-failed');

            // Check for error messages
            const errorText = await page.locator('.text-destructive, [role="alert"]').textContent().catch(() => '');
            if (errorText) {
                console.error(`Error message: ${errorText}`);
            }

            throw new Error(`Login failed. Current URL: ${currentUrl}`);
        }

        // ===== STEP 2: SET LIGHT THEME =====
        console.log('========== SETTING LIGHT THEME ==========');
        await page.goto(`${BASE_URL}/settings`);
        await page.waitForLoadState('networkidle').catch(() => { });

        const themeSwitch = page.getByRole('switch');
        try {
            await themeSwitch.waitFor({ state: 'visible', timeout: 5000 });
            const isDark = await themeSwitch.getAttribute('aria-checked') === 'true';
            if (isDark) {
                console.log('Switching to LIGHT mode...');
                await themeSwitch.click();
                await page.waitForTimeout(1000);
            } else {
                console.log('Already in LIGHT mode.');
            }
        } catch (e) {
            console.warn('Could not find theme switch, proceeding...');
        }

        // ===== STEP 3: DASHBOARD =====
        console.log('========== DASHBOARD ==========');
        await page.goto(`${BASE_URL}/dashboard`);
        await capture('01-dashboard');

        // ===== STEP 4: QUOTES =====
        console.log('========== QUOTES ==========');
        await page.goto(`${BASE_URL}/quotes`);
        await capture('02-quotes-list');

        // Try to click first quote for detail view
        const firstQuote = page.locator('[class*="card"], button').filter({ hasText: /\$|Quote/ }).first();
        if (await firstQuote.isVisible().catch(() => false)) {
            await firstQuote.click();
            await page.waitForLoadState('networkidle').catch(() => { });
            await capture('03-quote-detail');
        }

        // New quote form
        await page.goto(`${BASE_URL}/quotes/new`);
        await capture('04-quote-form');

        // ===== STEP 5: JOBS =====
        console.log('========== JOBS ==========');
        await page.goto(`${BASE_URL}/jobs`);
        await capture('05-jobs-list');

        // Try to click first job
        const firstJob = page.locator('[class*="card"], button').filter({ hasText: /Job|Scheduled/ }).first();
        if (await firstJob.isVisible().catch(() => false)) {
            await firstJob.click();
            await page.waitForLoadState('networkidle').catch(() => { });
            await capture('06-job-detail');
        }

        // New job form
        await page.goto(`${BASE_URL}/jobs/new`);
        await capture('07-job-form');

        // ===== STEP 6: INVOICES =====
        console.log('========== INVOICES ==========');
        await page.goto(`${BASE_URL}/invoices`);
        await capture('08-invoices-list');

        // Try to click first invoice
        const firstInvoice = page.locator('[class*="card"], button').filter({ hasText: /\$|Invoice|INV/ }).first();
        if (await firstInvoice.isVisible().catch(() => false)) {
            await firstInvoice.click();
            await page.waitForLoadState('networkidle').catch(() => { });
            await capture('09-invoice-detail');
        }

        // New invoice form
        await page.goto(`${BASE_URL}/invoices/new`);
        await capture('10-invoice-form');

        // ===== STEP 7: CLIENTS =====
        console.log('========== CLIENTS ==========');
        await page.goto(`${BASE_URL}/clients`);
        await capture('11-clients-list');

        // Try to click first client
        const firstClient = page.locator('[class*="card"], button').filter({ hasText: /@|Client/ }).first();
        if (await firstClient.isVisible().catch(() => false)) {
            await firstClient.click();
            await page.waitForLoadState('networkidle').catch(() => { });
            await capture('12-client-detail');
        }

        // New client form
        await page.goto(`${BASE_URL}/clients/new`);
        await capture('13-client-form');

        // ===== STEP 8: SETTINGS =====
        console.log('========== SETTINGS ==========');
        await page.goto(`${BASE_URL}/settings`);
        await capture('20-settings-main');

        // Settings subpages
        const settingsPages = [
            { path: 'profile', name: '21-settings-profile' },
            { path: 'business', name: '22-settings-business' },
            { path: 'branding', name: '23-settings-branding' },
            { path: 'team', name: '24-settings-team' },
            { path: 'payments', name: '25-settings-payments' },
            { path: 'subscription', name: '26-settings-subscription' },
        ];

        for (const setting of settingsPages) {
            await page.goto(`${BASE_URL}/settings/${setting.path}`);
            await capture(setting.name);
        }

        // ===== STEP 9: EMPTY STATES =====
        console.log('========== EMPTY STATES ==========');
        // These are already captured if lists are empty

        // ===== STEP 10: ONBOARDING =====
        console.log('========== ONBOARDING ==========');
        await page.goto(`${BASE_URL}/onboarding`);
        await capture('30-onboarding');

        console.log('========== AUDIT COMPLETE ==========');
        console.log(`Screenshots saved to: ${screenshotDir}`);
    });

    test('Complete UI/UX Coverage Audit - Dark Mode', async ({ page }) => {
        const theme = 'dark';
        const screenshotDir = path.join(SCREENSHOTS_DIR, 'mobile', theme);
        ensureDir(screenshotDir);

        // Helper to capture screenshot
        const capture = async (name: string) => {
            const filePath = path.join(screenshotDir, `${name}.png`);
            console.log(`[${theme.toUpperCase()}] Capturing: ${name}`);

            await page.waitForLoadState('networkidle').catch(() => { });
            await page.waitForTimeout(800);

            await page.screenshot({
                path: filePath,
                fullPage: true,
                animations: 'disabled'
            });
        };

        // ===== LOGIN =====
        console.log('========== AUTHENTICATION (Dark Mode) ==========');
        await page.goto(`${BASE_URL}/auth`);

        const emailInput = page.locator('input[type="email"]');
        await emailInput.waitFor({ state: 'visible', timeout: 10000 });
        await emailInput.fill(EMAIL);
        await page.locator('input[type="password"]').fill(PASSWORD);
        await page.locator('button:has-text("Sign In")').click();

        await page.waitForURL('**/dashboard', { timeout: 15000 });

        // ===== SET DARK THEME =====
        console.log('========== SETTING DARK THEME ==========');
        await page.goto(`${BASE_URL}/settings`);
        await page.waitForLoadState('networkidle').catch(() => { });

        const themeSwitch = page.getByRole('switch');
        try {
            await themeSwitch.waitFor({ state: 'visible', timeout: 5000 });
            const isDark = await themeSwitch.getAttribute('aria-checked') === 'true';
            if (!isDark) {
                console.log('Switching to DARK mode...');
                await themeSwitch.click();
                await page.waitForTimeout(1000);
            } else {
                console.log('Already in DARK mode.');
            }
        } catch (e) {
            console.warn('Could not find theme switch, proceeding...');
        }

        // Capture auth page in dark mode
        await page.goto(`${BASE_URL}/auth`);
        await capture('00-auth-page');

        // Re-login if needed
        if (page.url().includes('/auth')) {
            await page.locator('input[type="email"]').fill(EMAIL);
            await page.locator('input[type="password"]').fill(PASSWORD);
            await page.locator('button:has-text("Sign In")').click();
            await page.waitForURL('**/dashboard', { timeout: 15000 });
        }

        // Dashboard
        await page.goto(`${BASE_URL}/dashboard`);
        await capture('01-dashboard');

        // Quotes
        await page.goto(`${BASE_URL}/quotes`);
        await capture('02-quotes-list');
        await page.goto(`${BASE_URL}/quotes/new`);
        await capture('04-quote-form');

        // Jobs
        await page.goto(`${BASE_URL}/jobs`);
        await capture('05-jobs-list');
        await page.goto(`${BASE_URL}/jobs/new`);
        await capture('07-job-form');

        // Invoices
        await page.goto(`${BASE_URL}/invoices`);
        await capture('08-invoices-list');
        await page.goto(`${BASE_URL}/invoices/new`);
        await capture('10-invoice-form');

        // Clients
        await page.goto(`${BASE_URL}/clients`);
        await capture('11-clients-list');
        await page.goto(`${BASE_URL}/clients/new`);
        await capture('13-client-form');

        // Settings
        await page.goto(`${BASE_URL}/settings`);
        await capture('20-settings-main');

        const settingsPages = ['profile', 'business', 'branding', 'team', 'payments', 'subscription'];
        for (let i = 0; i < settingsPages.length; i++) {
            await page.goto(`${BASE_URL}/settings/${settingsPages[i]}`);
            await capture(`2${i + 1}-settings-${settingsPages[i]}`);
        }

        // Onboarding
        await page.goto(`${BASE_URL}/onboarding`);
        await capture('30-onboarding');

        console.log('========== DARK MODE AUDIT COMPLETE ==========');
    });
});
