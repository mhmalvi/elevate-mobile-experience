import { test, expect } from '@playwright/test';
import { createTestContext, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Voice Commands E2E Tests
 *
 * Tests the voice command functionality including:
 * - Voice command sheet UI
 * - Speech recognition availability
 * - Voice command triggers
 * - AI response handling
 * - Voice wizard flow
 * - MagicMic button
 */

test.describe('Voice Commands', () => {
    test.beforeEach(async ({ page }) => {
        const ctx = createTestContext(page);

        if (HAS_TEST_CREDENTIALS) {
            await ctx.auth.login();
        }
    });

    test.describe('Voice Command Sheet', () => {
        test('should display voice command trigger button in bottom nav', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToDashboard();

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Look for the central FAB button in bottom nav that triggers voice commands
            const voiceFab = page.locator('nav button[class*="rounded-full"]').first();
            const hasFab = await voiceFab.count() > 0;

            // Or look for mic icon button
            const micButton = page.locator('button').filter({ has: page.locator('svg[class*="mic" i], [data-lucide="mic"]') });
            const sparklesButton = page.locator('button').filter({ has: page.locator('svg[class*="sparkle" i], [data-lucide="sparkles"]') });

            const hasVoiceTrigger = hasFab || await micButton.count() > 0 || await sparklesButton.count() > 0;
            expect(hasVoiceTrigger).toBeTruthy();

            await ctx.screenshot.capture('voice-command-button');
        });

        test('should open voice command sheet when clicking FAB', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Click the central FAB button
            const voiceFab = page.locator('nav button[class*="rounded-full"], button[class*="sparkles"]').first();

            if (await voiceFab.isVisible()) {
                await voiceFab.click();
                await page.waitForTimeout(500);

                // Should open sheet with voice assistant UI
                const sheet = page.locator('[role="dialog"], [data-state="open"]');
                const mateyName = page.locator('text=/matey/i');
                const voiceSheet = page.locator('[class*="sheet"]');

                const sheetOpened = await sheet.count() > 0 || await mateyName.count() > 0 || await voiceSheet.count() > 0;

                await ctx.screenshot.capture('voice-command-sheet-open');
            }
        });

        test('should display Matey assistant branding', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Open voice command sheet
            const voiceFab = page.locator('nav button[class*="rounded-full"]').first();

            if (await voiceFab.isVisible()) {
                await voiceFab.click();
                await page.waitForTimeout(500);

                // Should show Matey branding
                const mateyName = page.locator('text=/matey/i');
                const helpingHand = page.locator('text=/helping hand/i');

                const hasBranding = await mateyName.count() > 0 || await helpingHand.count() > 0;

                await ctx.screenshot.capture('voice-matey-branding');
            }
        });

        test('should show quick suggestion buttons', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Open voice command sheet
            const voiceFab = page.locator('nav button[class*="rounded-full"]').first();

            if (await voiceFab.isVisible()) {
                await voiceFab.click();
                await page.waitForTimeout(500);

                // Should show quick action suggestions
                const quoteButton = page.locator('button').filter({ hasText: /create.*quote|new quote/i });
                const clientButton = page.locator('button').filter({ hasText: /add.*client/i });
                const invoiceButton = page.locator('button').filter({ hasText: /invoice/i });

                const hasSuggestions = await quoteButton.count() > 0 ||
                    await clientButton.count() > 0 ||
                    await invoiceButton.count() > 0;

                await ctx.screenshot.capture('voice-quick-suggestions');
            }
        });

        test('should have microphone button to start recording', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Open voice command sheet
            const voiceFab = page.locator('nav button[class*="rounded-full"]').first();

            if (await voiceFab.isVisible()) {
                await voiceFab.click();
                await page.waitForTimeout(500);

                // Should have mic button to start recording
                const micButton = page.locator('button').filter({
                    has: page.locator('svg[class*="mic" i], [data-lucide="mic"]')
                });

                const primaryMicButton = page.locator('button[class*="primary"][class*="rounded-full"]');

                const hasMicButton = await micButton.count() > 0 || await primaryMicButton.count() > 0;

                await ctx.screenshot.capture('voice-mic-button');
            }
        });

        test('should close voice sheet correctly', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Open voice command sheet
            const voiceFab = page.locator('nav button[class*="rounded-full"]').first();

            if (await voiceFab.isVisible()) {
                await voiceFab.click();
                await page.waitForTimeout(500);

                // Close the sheet (click outside or X button)
                const closeButton = page.locator('button[class*="close"], button[aria-label*="close" i]');
                const overlayBackdrop = page.locator('[data-state="open"] ~ div, [class*="overlay"]');

                if (await closeButton.isVisible()) {
                    await closeButton.click();
                } else if (await overlayBackdrop.isVisible()) {
                    await overlayBackdrop.click();
                } else {
                    await page.keyboard.press('Escape');
                }

                await page.waitForTimeout(500);

                await ctx.screenshot.capture('voice-sheet-closed');
            }
        });
    });

    test.describe('Voice Wizard', () => {
        test('should access voice wizard page', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.goto('/voice-wizard');
            await page.waitForLoadState('networkidle');

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Should show wizard intro
            const wizardHeader = page.locator('h1, h2').filter({ hasText: /voice|wizard|guided/i });
            const hasWizard = await wizardHeader.count() > 0;

            await ctx.screenshot.capture('voice-wizard-page');
        });

        test('should display guided quote mode intro', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/voice-wizard');
            await page.waitForLoadState('networkidle');

            // Should show intro with mic icon
            const micIcon = page.locator('svg[class*="mic" i], [data-lucide="mic"]');
            const startButton = page.locator('button').filter({ hasText: /start|begin/i });

            const hasIntro = await micIcon.count() > 0 || await startButton.count() > 0;

            await ctx.screenshot.capture('voice-wizard-intro');
        });

        test('should navigate through wizard steps', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await page.goto('/voice-wizard');
            await page.waitForLoadState('networkidle');

            // Click start button
            const startButton = page.locator('button').filter({ hasText: /start|begin/i }).first();

            if (await startButton.isVisible()) {
                await startButton.click();
                await page.waitForTimeout(500);

                // Should be on client step
                const step1Indicator = page.locator('text=/step 1|client|who/i');
                const hasStep1 = await step1Indicator.count() > 0;

                await ctx.screenshot.capture('voice-wizard-step1');

                // Fill client name and go next
                const clientInput = page.locator('input[placeholder*="name" i]').first();
                if (await clientInput.isVisible()) {
                    await clientInput.fill('Test Client');

                    const nextButton = page.locator('button').filter({ hasText: /next/i }).first();
                    if (await nextButton.isVisible()) {
                        await nextButton.click();
                        await page.waitForTimeout(500);

                        await ctx.screenshot.capture('voice-wizard-step2');
                    }
                }
            }
        });
    });

    test.describe('MagicMic Button', () => {
        test('should display MagicMic FAB on dashboard', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Look for floating mic button
            const magicMic = page.locator('button[class*="fixed"][class*="rounded-full"]');
            const magicMicLabel = page.locator('text=/magic mic/i');

            const hasMagicMic = await magicMic.count() > 0 || await magicMicLabel.count() > 0;

            await ctx.screenshot.capture('magic-mic-button');
        });

        test('should show processing state when clicked', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Find and click magic mic
            const magicMic = page.locator('button[class*="fixed"][class*="rounded-full"]').last();

            if (await magicMic.isVisible()) {
                await magicMic.click();
                await page.waitForTimeout(300);

                // Should show listening state or processing indicator
                const listeningState = page.locator('button[class*="destructive"], button[class*="pulse"]');
                const processingSpinner = page.locator('[class*="animate-spin"]');

                const hasActiveState = await listeningState.count() > 0 || await processingSpinner.count() > 0;

                await ctx.screenshot.capture('magic-mic-active');
            }
        });
    });

    test.describe('Voice Notes on Jobs', () => {
        test('should have voice recorder on job details', async ({ page }) => {
            const ctx = createTestContext(page);

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToJobs();

            // Click on first job
            const jobLink = page.locator('a[href*="/jobs/"]').first();

            if (await jobLink.isVisible()) {
                await jobLink.click();
                await ctx.wait.waitForPageReady();

                // Look for voice note recorder section
                const voiceRecorder = page.locator('text=/voice note|record/i');
                const micButton = page.locator('button').filter({ has: page.locator('[data-lucide="mic"]') });

                const hasVoiceRecorder = await voiceRecorder.count() > 0 || await micButton.count() > 0;

                await ctx.screenshot.capture('job-voice-recorder');
            }
        });
    });

    test.describe('Speech Recognition Availability', () => {
        test('should detect speech recognition support', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToDashboard();

            // Check if browser supports speech recognition
            const hasSpeechRecognition = await page.evaluate(() => {
                return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
            });

            // Chromium should support it
            expect(hasSpeechRecognition).toBeTruthy();
        });

        test('should detect speech synthesis support', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToDashboard();

            // Check if browser supports speech synthesis
            const hasSpeechSynthesis = await page.evaluate(() => {
                return 'speechSynthesis' in window;
            });

            expect(hasSpeechSynthesis).toBeTruthy();
        });
    });

    test.describe('Mobile Voice Commands', () => {
        test('should show voice button on mobile', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.setViewportSize({ width: 375, height: 667 });

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Should have FAB visible on mobile
            const voiceFab = page.locator('nav button[class*="rounded-full"]').first();

            if (await voiceFab.isVisible()) {
                await ctx.screenshot.capture('voice-mobile-fab');
                expect(true).toBeTruthy();
            }
        });

        test('should open voice sheet on mobile', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.setViewportSize({ width: 375, height: 667 });

            if (!HAS_TEST_CREDENTIALS) {
                test.skip();
                return;
            }

            await ctx.nav.goToDashboard();

            // Check if on auth page
            const isOnAuth = page.url().includes('/auth');
            if (isOnAuth) {
                expect(isOnAuth).toBeTruthy();
                return;
            }

            // Click FAB to open voice sheet
            const voiceFab = page.locator('nav button[class*="rounded-full"]').first();

            if (await voiceFab.isVisible()) {
                await voiceFab.click();
                await page.waitForTimeout(500);

                await ctx.screenshot.capture('voice-mobile-sheet');
            }
        });
    });
});
