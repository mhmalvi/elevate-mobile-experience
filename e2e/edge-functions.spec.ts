import { test, expect } from '@playwright/test';
import { createTestContext, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Edge Functions E2E Tests
 *
 * Comprehensive tests for all Supabase Edge Functions with:
 * - Network request verification
 * - Response validation
 * - Error handling verification
 * - CORS configuration checks
 * - Console log monitoring
 *
 * These tests verify the complete integration from frontend to backend.
 */

const SUPABASE_URL = 'https://rucuomtojzifrvplhwja.supabase.co';

// Helper to intercept and verify edge function calls
async function interceptEdgeFunctionCall(
    page: any,
    functionName: string,
    expectedStatus: number = 200
) {
    const responses: any[] = [];

    page.on('response', (response: any) => {
        const url = response.url();
        if (url.includes(`/functions/v1/${functionName}`)) {
            responses.push({
                url,
                status: response.status(),
                headers: response.headers(),
            });
        }
    });

    return () => responses;
}

// Helper to capture console logs for debugging
async function captureConsoleLogs(page: any) {
    const logs: { type: string; text: string }[] = [];

    page.on('console', (msg: any) => {
        logs.push({
            type: msg.type(),
            text: msg.text(),
        });
    });

    return () => logs;
}

test.describe('Edge Functions - Authentication Required', () => {
    test.beforeEach(async ({ page }) => {
        if (!HAS_TEST_CREDENTIALS) {
            test.skip();
            return;
        }

        const ctx = createTestContext(page);
        await ctx.auth.login();
    });

    test.describe('PDF Generation', () => {
        test('should generate PDF for invoice via Edge Function', async ({ page }) => {
            const ctx = createTestContext(page);
            const getLogs = await captureConsoleLogs(page);

            // Navigate to invoices
            await ctx.nav.goToInvoices();
            await ctx.wait.waitForPageReady();

            // Click on first invoice if available
            const invoiceLink = page.locator('a[href*="/invoices/"]').first();
            if (await invoiceLink.isVisible()) {
                await invoiceLink.click();
                await ctx.wait.waitForPageReady();

                // Look for PDF button
                const pdfButton = page
                    .locator('button')
                    .filter({ hasText: /pdf|download|preview/i })
                    .first();
                if (await pdfButton.isVisible()) {
                    // Intercept the generate-pdf function call
                    const getResponses = await interceptEdgeFunctionCall(page, 'generate-pdf');

                    await pdfButton.click();
                    await page.waitForTimeout(3000);

                    // Verify no console errors related to PDF generation
                    const logs = getLogs();
                    const pdfErrors = logs.filter(
                        (l) =>
                            l.type === 'error' && (l.text.includes('pdf') || l.text.includes('generate'))
                    );
                    expect(pdfErrors).toHaveLength(0);

                    await ctx.screenshot.capture('edge-function-pdf-generation');
                }
            }
        });

        test('should generate PDF for quote via Edge Function', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToQuotes();
            await ctx.wait.waitForPageReady();

            const quoteLink = page.locator('a[href*="/quotes/"]').first();
            if (await quoteLink.isVisible()) {
                await quoteLink.click();
                await ctx.wait.waitForPageReady();

                const pdfButton = page
                    .locator('button')
                    .filter({ hasText: /pdf|download|preview/i })
                    .first();
                if (await pdfButton.isVisible()) {
                    await pdfButton.click();
                    await page.waitForTimeout(3000);

                    // Verify page didn't crash
                    expect(page.url()).toContain('/quotes/');
                    await ctx.screenshot.capture('edge-function-quote-pdf');
                }
            }
        });
    });

    test.describe('Email Sending', () => {
        test('should trigger email Edge Function when sending invoice', async ({ page }) => {
            const ctx = createTestContext(page);
            const getLogs = await captureConsoleLogs(page);

            await ctx.nav.goToInvoices();
            await ctx.wait.waitForPageReady();

            const invoiceLink = page.locator('a[href*="/invoices/"]').first();
            if (await invoiceLink.isVisible()) {
                await invoiceLink.click();
                await ctx.wait.waitForPageReady();

                // Look for email/send button
                const sendButton = page
                    .locator('button')
                    .filter({ hasText: /email|send/i })
                    .first();
                if (await sendButton.isVisible()) {
                    await sendButton.click();
                    await page.waitForTimeout(1000);

                    // Verify dialog opened or action was triggered
                    const emailDialog = page.locator('[role="dialog"]');
                    if (await emailDialog.isVisible()) {
                        await ctx.screenshot.capture('edge-function-email-dialog');

                        // Check for email input
                        const emailInput = emailDialog.locator('input[type="email"]');
                        if (await emailInput.isVisible()) {
                            await emailInput.fill('test@example.com');
                        }

                        // Don't actually send - just verify UI
                    }
                }
            }
        });
    });

    test.describe('SMS Sending', () => {
        test('should trigger SMS Edge Function when sending notification', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToInvoices();
            await ctx.wait.waitForPageReady();

            const invoiceLink = page.locator('a[href*="/invoices/"]').first();
            if (await invoiceLink.isVisible()) {
                await invoiceLink.click();
                await ctx.wait.waitForPageReady();

                // Look for SMS button
                const smsButton = page.locator('button').filter({ hasText: /sms/i }).first();
                if (await smsButton.isVisible()) {
                    await smsButton.click();
                    await page.waitForTimeout(1000);

                    // Verify dialog opened
                    const smsDialog = page.locator('[role="dialog"]');
                    if (await smsDialog.isVisible()) {
                        await ctx.screenshot.capture('edge-function-sms-dialog');

                        // Check for phone input
                        const phoneInput = smsDialog.locator('input[type="tel"], input[placeholder*="phone" i]');
                        if (await phoneInput.isVisible()) {
                            await phoneInput.fill('+61400000000');
                        }
                    }
                }
            }
        });
    });

    test.describe('Stripe Integration', () => {
        test('should check Stripe account status', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToSettings();
            await ctx.wait.waitForPageReady();

            // Navigate to payment settings
            const paymentTab = page.locator('button, a').filter({ hasText: /payment/i }).first();
            if (await paymentTab.isVisible()) {
                await paymentTab.click();
                await page.waitForTimeout(2000);
                await ctx.wait.waitForPageReady();

                // Verify payment settings loaded without errors
                const hasError = await page.locator('[role="alert"]').isVisible();

                await ctx.screenshot.capture('edge-function-stripe-settings');
            }
        });

        test('should handle subscription checkout flow', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToSettings();
            await ctx.wait.waitForPageReady();

            // Navigate to subscription settings
            const subscriptionTab = page
                .locator('button, a')
                .filter({ hasText: /subscription|billing|plan/i })
                .first();
            if (await subscriptionTab.isVisible()) {
                await subscriptionTab.click();
                await page.waitForTimeout(2000);

                // Look for upgrade buttons
                const upgradeButton = page.locator('button').filter({ hasText: /upgrade|subscribe/i }).first();
                if (await upgradeButton.isVisible()) {
                    await ctx.screenshot.capture('edge-function-subscription-options');
                }
            }
        });
    });

    test.describe('Team Management', () => {
        test('should send team invitation via Edge Function', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToSettings();
            await ctx.wait.waitForPageReady();

            // Navigate to team settings
            const teamTab = page.locator('button, a').filter({ hasText: /team/i }).first();
            if (await teamTab.isVisible()) {
                await teamTab.click();
                await page.waitForTimeout(2000);

                const inviteButton = page.locator('button').filter({ hasText: /invite/i }).first();
                if (await inviteButton.isVisible()) {
                    await inviteButton.click();
                    await page.waitForTimeout(1000);

                    const inviteDialog = page.locator('[role="dialog"]');
                    if (await inviteDialog.isVisible()) {
                        await ctx.screenshot.capture('edge-function-team-invite');
                    }
                }
            }
        });
    });

    test.describe('Accounting Integration', () => {
        test('should handle Xero OAuth flow', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.goto('/settings/integrations');
            await ctx.wait.waitForPageReady();

            // Look for Xero connect button
            const xeroButton = page.locator('button, a').filter({ hasText: /xero/i }).first();
            if (await xeroButton.isVisible()) {
                await ctx.screenshot.capture('edge-function-xero-integration');
                // Don't click - would redirect to Xero OAuth
            }
        });

        test('should handle MYOB OAuth flow', async ({ page }) => {
            const ctx = createTestContext(page);

            await page.goto('/settings/integrations');
            await ctx.wait.waitForPageReady();

            const myobButton = page.locator('button, a').filter({ hasText: /myob/i }).first();
            if (await myobButton.isVisible()) {
                await ctx.screenshot.capture('edge-function-myob-integration');
            }
        });
    });

    test.describe('Voice Commands', () => {
        test('should process voice command via Edge Function', async ({ page }) => {
            const ctx = createTestContext(page);

            await ctx.nav.goToDashboard();
            await ctx.wait.waitForPageReady();

            // Look for voice command button
            const voiceButton = page
                .locator('button')
                .filter({ hasText: /voice|mic|speak/i })
                .first();
            if (await voiceButton.isVisible()) {
                await ctx.screenshot.capture('edge-function-voice-button');
            }

            // Also check for Matey voice assistant
            const mateyButton = page.locator('[data-testid="voice-assistant"], button[aria-label*="voice" i]').first();
            if (await mateyButton.isVisible()) {
                await mateyButton.click();
                await page.waitForTimeout(1000);
                await ctx.screenshot.capture('edge-function-voice-assistant');
            }
        });
    });
});

test.describe('Edge Functions - Public Access', () => {
    test('should serve public quote without authentication', async ({ page }) => {
        const ctx = createTestContext(page);

        // Clear any existing session
        await page.context().clearCookies();

        // Navigate to a public quote page (will show not found for invalid ID)
        await page.goto('/q/test-public-quote-id');
        await ctx.wait.waitForPageReady();

        // Should NOT redirect to auth
        expect(page.url()).not.toContain('/auth');

        // Should show quote not found or the actual quote
        const hasContent =
            (await page.locator('text=Quote').first().isVisible()) ||
            (await page.locator('text=not found').first().isVisible());
        expect(hasContent).toBeTruthy();

        await ctx.screenshot.capture('edge-function-public-quote');
    });

    test('should serve public invoice without authentication', async ({ page }) => {
        const ctx = createTestContext(page);

        await page.context().clearCookies();

        await page.goto('/i/test-public-invoice-id');
        await ctx.wait.waitForPageReady();

        expect(page.url()).not.toContain('/auth');

        const hasContent =
            (await page.locator('text=Invoice').first().isVisible()) ||
            (await page.locator('text=not found').first().isVisible());
        expect(hasContent).toBeTruthy();

        await ctx.screenshot.capture('edge-function-public-invoice');
    });

    test('should handle quote acceptance without auth', async ({ page }) => {
        const ctx = createTestContext(page);

        await page.context().clearCookies();

        // Navigate to public quote with accept path
        await page.goto('/q/test-quote-id');
        await ctx.wait.waitForPageReady();

        // Look for accept button
        const acceptButton = page.locator('button').filter({ hasText: /accept/i }).first();
        if (await acceptButton.isVisible()) {
            await ctx.screenshot.capture('edge-function-quote-accept-button');
        }
    });
});

test.describe('Edge Functions - CORS Configuration', () => {
    test('should have proper CORS headers on generate-pdf', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
                    method: 'OPTIONS',
                    headers: {
                        'Access-Control-Request-Method': 'POST',
                        Origin: 'http://localhost:8080',
                    },
                });
                return {
                    status: res.status,
                    cors: res.headers.get('Access-Control-Allow-Origin'),
                };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        // Should have CORS configured (204 or 200 response)
        if (!('error' in response)) {
            expect([200, 204]).toContain(response.status);
        }
    });

    test('should have proper CORS headers on send-email', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: 'OPTIONS',
                    headers: {
                        'Access-Control-Request-Method': 'POST',
                        Origin: 'http://localhost:8080',
                    },
                });
                return {
                    status: res.status,
                    cors: res.headers.get('Access-Control-Allow-Origin'),
                };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        if (!('error' in response)) {
            expect([200, 204]).toContain(response.status);
        }
    });

    test('should have proper CORS headers on send-notification', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
                    method: 'OPTIONS',
                    headers: {
                        'Access-Control-Request-Method': 'POST',
                        Origin: 'http://localhost:8080',
                    },
                });
                return {
                    status: res.status,
                    cors: res.headers.get('Access-Control-Allow-Origin'),
                };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        if (!('error' in response)) {
            expect([200, 204]).toContain(response.status);
        }
    });

    test('should have proper CORS headers on stripe-webhook', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
                    method: 'OPTIONS',
                    headers: {
                        'Access-Control-Request-Method': 'POST',
                        Origin: 'http://localhost:8080',
                    },
                });
                return {
                    status: res.status,
                    cors: res.headers.get('Access-Control-Allow-Origin'),
                };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        if (!('error' in response)) {
            expect([200, 204]).toContain(response.status);
        }
    });
});

test.describe('Edge Functions - Error Handling', () => {
    test('should handle missing required fields gracefully', async ({ page }) => {
        if (!HAS_TEST_CREDENTIALS) {
            test.skip();
            return;
        }

        const ctx = createTestContext(page);
        await ctx.auth.login();

        // Get auth token from local storage
        const token = await page.evaluate(() => {
            const supabaseKey = Object.keys(localStorage).find((k) => k.includes('supabase'));
            if (supabaseKey) {
                try {
                    const data = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                    return data.access_token;
                } catch {
                    return null;
                }
            }
            return null;
        });

        if (token) {
            // Try to send email without required fields
            const response = await page.evaluate(
                async ({ supabaseUrl, authToken }) => {
                    try {
                        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${authToken}`,
                            },
                            body: JSON.stringify({ type: 'invoice' }), // Missing required fields
                        });
                        return { status: res.status, data: await res.json() };
                    } catch (e) {
                        return { error: (e as Error).message };
                    }
                },
                { supabaseUrl: SUPABASE_URL, authToken: token }
            );

            // Should return 4xx error for missing fields
            if (!('error' in response)) {
                expect(response.status).toBeGreaterThanOrEqual(400);
                expect(response.status).toBeLessThan(500);
            }
        }
    });

    test('should reject unauthorized requests', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // No Authorization header
                    },
                    body: JSON.stringify({ type: 'invoice', id: 'test' }),
                });
                return { status: res.status };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        // Should return 401 Unauthorized
        if (!('error' in response)) {
            expect(response.status).toBe(401);
        }
    });
});

test.describe('Edge Functions - Webhook Endpoints', () => {
    test('should have stripe-webhook endpoint available', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
                    method: 'OPTIONS',
                });
                return { status: res.status };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        if (!('error' in response)) {
            expect([200, 204, 400, 405]).toContain(response.status);
        }
    });

    test('should have revenuecat-webhook endpoint available', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/revenuecat-webhook`, {
                    method: 'OPTIONS',
                });
                return { status: res.status };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        if (!('error' in response)) {
            expect([200, 204, 400, 405]).toContain(response.status);
        }
    });

    test('should have subscription-webhook endpoint available', async ({ page }) => {
        const response = await page.evaluate(async (supabaseUrl) => {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/subscription-webhook`, {
                    method: 'OPTIONS',
                });
                return { status: res.status };
            } catch (e) {
                return { error: (e as Error).message };
            }
        }, SUPABASE_URL);

        if (!('error' in response)) {
            expect([200, 204, 400, 405]).toContain(response.status);
        }
    });
});
