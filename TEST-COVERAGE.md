# TradieMate Test Coverage & Verification Guide

## Overview

This document outlines the comprehensive testing strategy for TradieMate, including unit tests, E2E tests, integration tests, and service log verification from Supabase, Vercel, Resend, Twilio, and Stripe.

## Test Categories

### 1. Unit Tests (Vitest)

Located in `src/**/__tests__/*.test.ts`

**Coverage Areas:**
- `notification-integration.test.ts` - Email & SMS notification logic
- `payment-integration.test.ts` - Stripe payment flows
- `voice-command.test.ts` - Voice command processing
- `validation.test.ts` - Form validation utilities
- `calculations.test.ts` - Quote/invoice calculations
- `utils.test.ts` - Utility functions

**Run Commands:**
```bash
# Run all unit tests
npm run test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm run test -- --watch
```

### 2. E2E Tests (Playwright)

Located in `e2e/*.spec.ts`

**Coverage Areas:**
- `auth.spec.ts` - Authentication flows
- `clients.spec.ts` - Client management
- `quotes.spec.ts` - Quote CRUD operations
- `invoices.spec.ts` - Invoice management
- `jobs.spec.ts` - Job tracking
- `production-test.spec.ts` - Critical production paths
- `edge-functions.spec.ts` - Edge Function integration

**Run Commands:**
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/edge-functions.spec.ts

# Run on specific browser
npx playwright test --project=chromium
```

### 3. Integration Tests

Located in `scripts/run-integration-tests.ts`

**Coverage Areas:**
- All 27 Supabase Edge Functions
- Database table access verification
- Stripe integration endpoints
- Email/SMS notification endpoints
- Accounting integrations (Xero, MYOB)
- Voice command processing

**Run Commands:**
```bash
# Run integration tests
npm run test:integration

# Run with verbose logging
npm run test:integration:verbose
```

## Service Log Verification

### Supabase Function Logs

```bash
# View logs for a specific function
npx supabase functions logs --project-ref rucuomtojzifrvplhwja send-email --limit 20

# View all function logs
npx supabase functions logs --project-ref rucuomtojzifrvplhwja --limit 50
```

**Key things to verify:**
- ✅ No authentication errors
- ✅ Successful database operations
- ✅ Proper error handling
- ✅ Rate limiting working correctly

### Vercel Deployment Logs

```bash
# View recent logs
npx vercel logs --limit 20

# View deployment status
npx vercel list --limit 1
```

**Key things to verify:**
- ✅ No build errors
- ✅ Fast edge function cold starts
- ✅ Proper routing

### Stripe Webhook Logs

```bash
# View recent events
stripe events list --limit 20

# View webhook logs
stripe logs tail --limit 20

# Test webhooks locally
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

**Key things to verify:**
- ✅ Webhook signature verification passing
- ✅ Invoice status updates
- ✅ Payment confirmation emails sent
- ✅ Subscription lifecycle events processed

### Resend Email Logs

Check via Resend Dashboard: https://resend.com/emails

**Key things to verify:**
- ✅ Emails delivered successfully
- ✅ Correct recipient addresses
- ✅ Proper subject lines and content
- ✅ No bounce or spam issues

### Twilio SMS Logs

Check via Twilio Console: https://console.twilio.com/us1/monitor/logs/sms

**Key things to verify:**
- ✅ SMS delivered successfully
- ✅ Correct phone number formatting (+61...)
- ✅ Message content within limits
- ✅ No delivery failures

## Edge Functions Test Matrix

| Function | Unit Test | E2E Test | Integration | Manual Verification |
|----------|-----------|----------|-------------|---------------------|
| generate-pdf | ✅ | ✅ | ✅ | ✅ |
| send-email | ✅ | ✅ | ✅ | ✅ |
| send-notification | ✅ | ✅ | ✅ | ⚠️ (SMS costs) |
| stripe-webhook | ✅ | ✅ | ✅ | ✅ |
| create-payment | ✅ | ✅ | ✅ | ✅ |
| check-stripe-account | ✅ | ✅ | ✅ | ✅ |
| create-subscription-checkout | ✅ | ✅ | ✅ | ✅ |
| process-voice-command | ✅ | ✅ | ✅ | ✅ |
| accept-quote | ✅ | ✅ | ✅ | ✅ |
| xero-oauth | ⬜ | ✅ | ✅ | ⚠️ (Requires Xero account) |
| myob-oauth | ⬜ | ✅ | ✅ | ⚠️ (Requires MYOB account) |
| send-team-invitation | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ Implemented | ⬜ Planned | ⚠️ Requires manual verification

## Running Full Test Suite

### Development

```bash
# Run all tests
npm run test:all

# Run with coverage
npm run test:full
```

### CI/CD Pipeline

```bash
# CI-optimized test run
npm run test:ci
```

This runs:
1. Lint checks
2. Unit tests with coverage
3. E2E tests (Chromium only for speed)

### Production Verification

```bash
# Full production test
node comprehensive-production-test.js

# Integration tests against production
TEST_URL=https://app.tradiemate.com.au npm run test:integration
```

## Coverage Thresholds

Current thresholds defined in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 60,
    statements: 60,
  },
}
```

**Target:** 100% coverage with weekly progress reviews.

## Test Data

### Test User Credentials

```env
TEST_USER_EMAIL=aethonautomation@gmail.com
TEST_USER_PASSWORD=90989098
```

### Test IDs

- Supabase Project: `rucuomtojzifrvplhwja`
- Test Client ID: (created dynamically in tests)
- Test Quote/Invoice IDs: (created dynamically in tests)

## Troubleshooting

### Common Issues

1. **"SUPABASE_ACCESS_TOKEN not set"**
   ```bash
   export SUPABASE_ACCESS_TOKEN=<your_token>
   # Or add to .env file
   ```

2. **"Stripe CLI not installed"**
   ```bash
   # Install Stripe CLI
   # Windows: scoop install stripe
   # macOS: brew install stripe/stripe-cli/stripe
   
   # Login
   stripe login
   ```

3. **"E2E tests failing with timeout"**
   ```bash
   # Increase timeout in playwright.config.ts
   # Or run with --timeout flag
   npx playwright test --timeout=60000
   ```

4. **"Coverage report not generating"**
   ```bash
   # Ensure node_modules installed
   npm install
   
   # Run with coverage
   npm run test:coverage
   ```

## Adding New Tests

### Unit Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
import { createTestContext } from './fixtures/test-helpers';

test.describe('My Feature', () => {
  test('should work correctly', async ({ page }) => {
    const ctx = createTestContext(page);
    await ctx.auth.login();
    
    // Test implementation
    await ctx.nav.goToDashboard();
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
```

## Monthly Test Review Checklist

- [ ] Run full test suite and verify all pass
- [ ] Review coverage report and identify gaps
- [ ] Check service logs for any recurring errors
- [ ] Verify Stripe webhook processing
- [ ] Verify email delivery rates
- [ ] Verify SMS delivery rates
- [ ] Update test data if needed
- [ ] Document any new edge cases

---

*Last updated: February 2026*

## Current Test Status

### Unit Tests (Vitest)
- **Total Tests:** 356
- **Pass Rate:** 100%
- **Line Coverage:** 99.34%
- **Branch Coverage:** 89.58%
- **Function Coverage:** 100%

### Integration Tests (Edge Functions)
- **Total Tests:** 48
- **Passed:** 43 (89.6%)
- **Failed:** 5

#### Passing Tests
- ✅ All 27 Edge Functions are deployed and accessible
- ✅ All 9 database tables accessible (profiles, clients, quotes, invoices, jobs, quote_line_items, invoice_line_items, usage_tracking, branding)
- ✅ Voice command processing (process-voice-command)
- ✅ Team collaboration functions (send-team-invitation, accept-team-invitation, leave-team)
- ✅ Accounting integrations (xero-oauth, myob-oauth, xero-sync-clients, xero-sync-invoices)
- ✅ Stripe basic functions (check-stripe-account)

#### Known Issues (Configuration Required)
| Function | Error | Resolution |
|----------|-------|------------|
| `check-subscription` | STRIPE_PRICE_ID_* not configured | Set Stripe price IDs in Supabase secrets |
| `get-payment-settings` | Invalid JWT | Token refresh issue - needs investigation |
| `generate-pdf` | Invoice not found | Needs real invoice ID for testing |
| `send-email` | Invoice not found | Needs real invoice ID for testing |
| `send-notification` | Invoice not found | Needs real invoice ID for testing |

### Service Log Verification Status

To enable log verification, configure the following CLIs:

```bash
# 1. Supabase CLI - Login and link project
npx supabase login
npx supabase link --project-ref rucuomtojzifrvplhwja

# 2. Stripe CLI - Login
stripe login

# 3. Vercel CLI - Login  
npx vercel login
```

### Test Files Summary

| File | Type | Tests | Pass Rate |
|------|------|-------|-----------|
| `src/lib/__tests__/notification-integration.test.ts` | Unit | 22 | 100% |
| `src/lib/__tests__/payment-integration.test.ts` | Unit | 18 | 100% |
| `src/lib/__tests__/voice-command.test.ts` | Unit | 18 | 100% |
| `src/lib/__tests__/subscription-management.test.ts` | Unit | 17 | 100% |
| `src/lib/__tests__/xero-integration.test.ts` | Unit | 15 | 100% |
| `src/lib/validation.test.ts` | Unit | 56 | 100% |
| `src/lib/calculations.test.ts` | Unit | 25 | 100% |
| `e2e/edge-functions.spec.ts` | E2E | 25+ | - |
| `scripts/run-integration-tests.ts` | Integration | 48 | 89.6% |

### Available Test Commands

```bash
npm run test              # Unit tests
npm run test:coverage     # Unit tests with coverage
npm run test:e2e          # E2E tests (Playwright)
npm run test:integration  # Integration tests (real API calls)
npm run test:functions    # Edge function E2E tests
npm run test:production   # Production tests with logs
npm run test:full         # All tests combined
npm run test:ci           # CI pipeline tests
```

### Recommended Actions

1. **Configure Stripe Price IDs** in Supabase project secrets:
   - `STRIPE_PRICE_ID_SOLO`
   - `STRIPE_PRICE_ID_CREW`
   - `STRIPE_PRICE_ID_PRO`

2. **Set up CLI tools** for log verification:
   - Supabase CLI: `npx supabase login`
   - Stripe CLI: `stripe login`

3. **Run E2E tests** with real browser:
   ```bash
   npm run test:e2e:ui
   ```

4. **Monitor coverage** and aim for 100%:
   ```bash
   npm run test:coverage
   ```

