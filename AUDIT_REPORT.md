# TradieMate Mobile App Audit Report

**Date:** 2026-02-13
**Scope:** iOS + Android native mobile (Capacitor 8)
**Stack:** React 18 + TypeScript + Vite 5 + Supabase + RevenueCat + Stripe Connect
**Repository:** `elevate-mobile-experience` (submodule)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [App Overview](#2-app-overview)
3. [Feature & Flow Inventory](#3-feature--flow-inventory)
4. [Findings](#4-findings)
5. [Subscriptions Deep Dive](#5-subscriptions-deep-dive)
6. [Stripe Connect Deep Dive](#6-stripe-connect-deep-dive)
7. [Security & Privacy Review](#7-security--privacy-review)
8. [Performance & Reliability Review](#8-performance--reliability-review)
9. [Code Quality Review](#9-code-quality-review)
10. [Test Coverage Plan](#10-test-coverage-plan)
11. [Remediation Plan](#11-remediation-plan)
12. [Appendix](#12-appendix)

---

## 1. Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4     |
| HIGH     | 6     |
| MEDIUM   | 7     |
| LOW      | 5     |
| **Total**| **22**|

### Critical Issues Requiring Immediate Action

1. **Live production secrets committed to Git** — `.env` contains Stripe secret keys, Supabase service role key, Twilio auth token, Resend API key, and RevenueCat secret keys in plaintext, tracked by Git.
2. **RevenueCat secret keys (sk_) used as public API keys** — The `VITE_REVENUECAT_*_API_KEY` vars use secret keys instead of public mobile SDK keys. These get bundled into the client-side JS bundle.
3. **VITE_SUPABASE_SECRET_KEY exposed to frontend** — Any `VITE_` prefixed env var is embedded in the client bundle by Vite.
4. **All 32 edge functions have `verify_jwt = false`** — No JWT verification at the Supabase gateway level; functions must do their own auth checks (some do, but several don't).

---

## 2. App Overview

### Architecture

```
┌─────────────────────────────────────────────────┐
│                 Mobile App (Capacitor 8)         │
│  React 18 + TypeScript + Vite 5 + Tailwind CSS  │
│  Radix UI + Framer Motion + TanStack Query v5   │
│  Dexie (IndexedDB offline) + React Router v6    │
├─────────────────────────────────────────────────┤
│  Native Plugins                                  │
│  - @capacitor/preferences (secure storage)       │
│  - @revenuecat/purchases-capacitor v11.3.2       │
│  - @capacitor/android ^8.0.0                     │
│  - @capacitor/ios ^8.0.0                         │
├─────────────────────────────────────────────────┤
│                 Supabase Backend                  │
│  Auth | PostgreSQL | 32 Edge Functions | Storage │
├─────────────────────────────────────────────────┤
│  External Services                               │
│  - Stripe Connect Express (merchant payments)    │
│  - RevenueCat (IAP subscriptions)                │
│  - Xero / MYOB / QuickBooks (accounting)         │
│  - Twilio (SMS) | Resend (email)                 │
└─────────────────────────────────────────────────┘
```

### Configuration

| Key               | Value                                   |
|--------------------|-----------------------------------------|
| App ID             | `com.tradiemate.app`                   |
| iOS Scheme         | `tradiemate`                           |
| Production URL     | `https://app.tradiemate.com.au`        |
| Supabase Project   | `rucuomtojzifrvplhwja`                |
| Build Format       | Android AAB (Play Store ready)         |
| Min SDK (Android)  | 22 (Android 5.1)                       |
| Target SDK         | 35 (Android 15)                        |

---

## 3. Feature & Flow Inventory

### Pages (37 total)

**Core Business:**
- Dashboard, Clients (list/new/edit/detail), Quotes (list/new/edit/detail), Invoices (list/new/edit/detail)
- Jobs (list/new/edit/detail), Schedule, Photo Gallery, Materials

**Settings (11 pages):**
- ProfileSettings, BusinessSettings, SubscriptionSettings, PaymentSettings
- NotificationSettings, IntegrationSettings, BrandingSettings, AppearanceSettings
- DataManagement, SecuritySettings, HelpSupport

**Auth:** Login, SignUp, ForgotPassword, ResetPassword, AuthCallback

**Other:** Landing, NotFound

### Business Flows (15)

1. User Registration → Profile Setup → Business Configuration
2. Client CRUD with search and filtering
3. Quote Creation → Line Items → PDF Generation → Send (email/SMS)
4. Quote → Invoice Conversion
5. Invoice Creation → Line Items → PDF → Send → Payment Tracking
6. Job Management with status tracking
7. Schedule/Calendar management
8. Photo capture and gallery
9. Materials tracking
10. Subscription purchase via RevenueCat (iOS/Android)
11. Stripe Connect onboarding for merchant payments
12. Invoice payment via Stripe Checkout (connected accounts)
13. Accounting sync (Xero/MYOB/QuickBooks OAuth)
14. Branding customization (logo, colors, templates)
15. Data export and management

### Edge Functions (32)

Payment & Subscription: `create-checkout-session`, `create-stripe-connect`, `stripe-webhook`, `revenuecat-webhook`, `check-stripe-status`, `create-portal-session`, `create-subscription`, `cancel-subscription`, `verify-subscription`

Communication: `send-invoice-email`, `send-quote-email`, `send-sms`, `send-payment-reminder`

Accounting Integration: `xero-auth`, `xero-callback`, `xero-sync-invoice`, `myob-auth`, `myob-callback`, `myob-sync-invoice`, `quickbooks-auth`, `quickbooks-callback`, `quickbooks-sync-invoice`

User Management: `create-team-member`, `verify-team-invite`, `update-profile`

Other: `generate-pdf`, `stripe-connect-webhook`, `get-payment-methods`, `update-branding`, `check-usage-limits`, `admin-dashboard`, `health-check`

---

## 4. Findings

### CRITICAL-01: Production Secrets Committed to Git

**File:** `elevate-mobile-experience/.env`
**Evidence:** The `.env` file is tracked by Git and contains live production keys:
- `STRIPE_SECRET_KEY="sk_test_51SixpH..."`
- `SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."`
- `TWILIO_AUTH_TOKEN="b8c7f164..."`
- `RESEND_API_KEY="re_Wrocvos4..."`
- `STRIPE_WEBHOOK_SECRET="whsec_ay23j6tr..."`
- `XERO_CLIENT_SECRET="3QGyHmb28QS..."`
- `QUICKBOOKS_CLIENT_SECRET="AEOyZRRj4eq..."`
- `ENCRYPTION_KEY="bGwzO+3FpGluw..."`
- `VERCEL_TOKEN="lEwq62lZBhg..."`
- `SUPABASE_ACCESS_TOKEN="sbp_08470f91..."`

**Root Cause:** The parent repo `.gitignore` only ignores `.vercel` and `.env*.local`, not `.env`. The submodule `.gitignore` does list `.env` but the file was already tracked before the rule was added.

**Impact:** Anyone with repo access has full admin control of Supabase, Stripe, Twilio, Resend, Xero, QuickBooks, and Vercel. Complete platform takeover possible.

**Fix:**
1. Rotate ALL secrets immediately (every key in that file)
2. `git rm --cached elevate-mobile-experience/.env`
3. Add `.env` to the parent `.gitignore`
4. Use `git filter-branch` or BFG Repo Cleaner to purge from history
5. Move all secrets to Supabase Vault / CI environment variables

---

### CRITICAL-02: RevenueCat Secret Keys Used as Public API Keys

**File:** `elevate-mobile-experience/.env` (lines 6-10)
**Evidence:**
```
VITE_REVENUECAT_ANDROID_API_KEY="sk_[REDACTED]"
VITE_REVENUECAT_IOS_API_KEY="sk_[REDACTED]"
VITE_REVENUECAT_WEB_API_KEY="sk_[REDACTED]"
```

**Root Cause:** The `.env` file has a `FIXME` comment on line 8-9 acknowledging this issue but it was never resolved. RevenueCat mobile SDKs should use public API keys (`goog_xxx` for Android, `appl_xxx` for iOS).

**Impact:** Secret keys grant full API access to RevenueCat including the ability to grant/revoke subscriptions for any user, read subscriber data, and modify entitlements. Since `VITE_` prefix bundles these into the client JS, they are extractable from the app bundle.

**Fix:**
1. Go to RevenueCat dashboard → App Settings
2. Copy the PUBLIC API keys (`goog_xxx` for Android, `appl_xxx` for iOS)
3. Replace `sk_` keys with public keys in environment configuration
4. For web, use Web Billing API key (`rcb_xxx`) from Project → Web Billing
5. Revoke the compromised `sk_` keys after migration

---

### CRITICAL-03: Supabase Secret Key Exposed to Frontend

**File:** `elevate-mobile-experience/.env` (line 27)
**Evidence:**
```
VITE_SUPABASE_SECRET_KEY="[REDACTED - secret key was exposed here]"
```

**Root Cause:** Vite embeds all `VITE_` prefixed environment variables into the client-side JavaScript bundle. The `.env.example` file even has a comment marking this as deprecated/security risk.

**Impact:** This key may grant elevated access to Supabase resources, bypassing RLS policies. Extractable from the compiled app bundle.

**Fix:**
1. Remove `VITE_SUPABASE_SECRET_KEY` from all environment files
2. Remove any code that references `import.meta.env.VITE_SUPABASE_SECRET_KEY`
3. Ensure only the anon key is used client-side; service role key stays server-side only
4. Rotate the key after removal

---

### CRITICAL-04: All Edge Functions Have JWT Verification Disabled

**File:** `elevate-mobile-experience/supabase/config.toml`
**Evidence:** All 32 function entries contain `verify_jwt = false`

**Root Cause:** Likely set during development for ease of testing and never re-enabled.

**Impact:** Any unauthenticated request can invoke edge functions. While some functions implement their own auth checks (e.g., `create-stripe-connect` checks the Authorization header), others may not, allowing unauthorized access to business logic and data.

**Fix:**
1. Audit each function for internal auth checks
2. Set `verify_jwt = true` for all functions that require authentication
3. Keep `verify_jwt = false` only for genuinely public endpoints (webhooks, health-check)
4. Webhooks should verify their own signatures (Stripe webhook does this, RevenueCat does too)

---

### HIGH-01: Overly Broad Anon RLS Policies

**File:** `supabase/migrations/20260207_consolidated_rls_policies.sql`
**Evidence:** SELECT policies with `USING(true)` on 7 tables: `clients`, `quotes`, `invoices`, `invoice_line_items`, `quote_line_items`, `profiles`, `branding_settings`

**Impact:** Anonymous users (using only the anon key) can read all rows in these tables. Combined with CRITICAL-04 (no JWT verification), this means unauthenticated API calls can enumerate all client data, quotes, invoices, and profiles.

**Fix:**
1. Replace `USING(true)` with `USING(auth.uid() = user_id)` for user-scoped tables
2. For tables without `user_id`, add a join condition through the parent table
3. Test all queries after changing policies to ensure app still works

---

### HIGH-02: Android `allowBackup=true`

**File:** `elevate-mobile-experience/android/app/src/main/AndroidManifest.xml`
**Evidence:** `android:allowBackup="true"`

**Impact:** Android backup includes app data (databases, shared preferences, files) which could contain auth tokens, cached business data, and encryption keys. ADB backup extraction is trivial on rooted devices.

**Fix:**
```xml
android:allowBackup="false"
android:dataExtractionRules="@xml/data_extraction_rules"
```
Create `res/xml/data_extraction_rules.xml` to exclude sensitive data from cloud backup while allowing non-sensitive data.

---

### HIGH-03: Android Release Build Not Obfuscated

**File:** `elevate-mobile-experience/android/app/build.gradle`
**Evidence:** `minifyEnabled = false` in release buildType

**Impact:** The release APK/AAB contains unobfuscated code making it trivial to reverse-engineer business logic, find hardcoded values, and understand API patterns.

**Fix:**
```gradle
buildTypes {
    release {
        minifyEnabled = true
        shrinkResources = true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```
Create `proguard-rules.pro` with rules to keep Capacitor bridge classes and any reflection-dependent code.

---

### HIGH-04: No Android Signing Configuration

**File:** `elevate-mobile-experience/android/app/build.gradle`
**Evidence:** No `signingConfigs` block present

**Impact:** Cannot produce signed release builds for Google Play Store. Without a signing config, the build process will use a debug key which Play Store rejects.

**Fix:**
```gradle
signingConfigs {
    release {
        storeFile file(System.getenv("KEYSTORE_PATH") ?: "release.keystore")
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
        keyAlias System.getenv("KEY_ALIAS") ?: ""
        keyPassword System.getenv("KEY_PASSWORD") ?: ""
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        // ...
    }
}
```
Store the keystore and credentials in CI secrets, never in the repo.

---

### HIGH-05: No iOS Xcode Project

**File:** `elevate-mobile-experience/ios/` (directory)
**Evidence:** No `App.xcodeproj` or `App.xcworkspace` found. The `ios/` directory either doesn't exist or is empty.

**Impact:** iOS builds cannot be produced. App Store submission is blocked.

**Fix:**
```bash
cd elevate-mobile-experience
npx cap add ios
npx cap sync ios
```
Then configure:
- Bundle ID: `com.tradiemate.app`
- Set deployment target (iOS 14+)
- Add `RevenueCat` via CocoaPods or SPM
- Configure push notification entitlements
- Set up App Transport Security exceptions if needed
- Configure code signing with Apple Developer certificates

---

### HIGH-06: RevenueCat Webhook Missing Idempotency

**File:** `elevate-mobile-experience/supabase/functions/revenuecat-webhook/index.ts`
**Evidence:** The Stripe webhook uses the shared `webhook-idempotency.ts` helper, but the RevenueCat webhook does not import or use it.

**Impact:** If RevenueCat delivers the same webhook event multiple times (common during retries), the handler will process it multiple times, potentially corrupting subscription state or causing duplicate operations.

**Fix:**
```typescript
import { processWebhookWithIdempotency } from "../_shared/webhook-idempotency.ts";

// Wrap the processing logic:
const result = await processWebhookWithIdempotency(
  supabaseClient,
  `revenuecat_${event.type}_${event.app_user_id}_${event.product_id}`,
  async () => {
    // existing switch/case logic
  }
);
```

---

### MEDIUM-01: Capacitor Config Uses `process.env.NODE_ENV`

**File:** `elevate-mobile-experience/capacitor.config.ts` (line ~10)
**Evidence:** Uses `process.env.NODE_ENV` to toggle cleartext, but Capacitor config is evaluated at build time, not at Node.js runtime.

**Impact:** The cleartext toggle may not work as intended, potentially allowing cleartext HTTP traffic in production builds or blocking it in development.

**Fix:** Use the static `capacitor.config.json` for production builds and a separate dev config, or use Capacitor's built-in environment handling.

---

### MEDIUM-02: No Deep Link / App Link Configuration

**File:** `elevate-mobile-experience/android/app/src/main/AndroidManifest.xml`
**Evidence:** Only has a standard LAUNCHER intent filter. No `<intent-filter>` for `https://app.tradiemate.com.au` deep links or custom scheme links.

**Impact:** OAuth callbacks (Xero, QuickBooks), Stripe Connect return URLs, and magic link auth cannot redirect back to the native app. Users get stuck in the browser after authentication.

**Fix:** Add intent filters for:
```xml
<!-- Universal Links -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="app.tradiemate.com.au" />
</intent-filter>

<!-- Custom Scheme -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="tradiemate" />
</intent-filter>
```
For iOS, configure Associated Domains in the entitlements file.

---

### MEDIUM-03: No Network Security Config (Android)

**File:** `elevate-mobile-experience/android/app/src/main/AndroidManifest.xml`
**Evidence:** No `android:networkSecurityConfig` attribute

**Impact:** No certificate pinning, no control over trusted CAs, no cleartext traffic policy enforcement beyond the default.

**Fix:** Create `res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config>
        <domain includeSubdomains="true">rucuomtojzifrvplhwja.supabase.co</domain>
        <pin-set expiration="2027-01-01">
            <!-- Add certificate pins -->
        </pin-set>
    </domain-config>
</network-security-config>
```

---

### MEDIUM-04: RevenueCat Store Mapping Incomplete

**File:** `elevate-mobile-experience/supabase/functions/revenuecat-webhook/index.ts` (line 125)
**Evidence:**
```typescript
const provider = event.store === 'PLAY_STORE' ? 'google_play' : 'apple_iap';
```

**Impact:** If `event.store` is `'STRIPE'` (web purchases), it gets incorrectly mapped to `'apple_iap'`.

**Fix:**
```typescript
const providerMap: Record<string, string> = {
  'PLAY_STORE': 'google_play',
  'APP_STORE': 'apple_iap',
  'STRIPE': 'stripe',
};
const provider = providerMap[event.store] || 'unknown';
```

---

### MEDIUM-05: No Offline Subscription Validation

**File:** `elevate-mobile-experience/src/lib/platformPayments.ts`
**Evidence:** Subscription status is checked via Supabase queries; no local caching or grace period logic for offline scenarios.

**Impact:** Users in areas with poor connectivity (common for tradies on job sites) may lose access to paid features even though they have an active subscription.

**Fix:** Cache the subscription status and expiry in Capacitor Preferences or Dexie with a 24-48 hour grace period. Validate locally when offline and sync when connectivity returns.

---

### MEDIUM-06: No Rate Limiting on Edge Functions

**File:** `supabase/functions/*/index.ts`
**Evidence:** No rate limiting middleware or checks in any edge function.

**Impact:** API abuse, credential stuffing on auth endpoints, webhook replay attacks, and potential cost escalation from excessive function invocations.

**Fix:** Implement rate limiting using Supabase's built-in features or a Redis-based rate limiter. At minimum, add rate limiting to auth-related functions and payment endpoints.

---

### MEDIUM-07: PDF Generation Uses html2canvas

**File:** `elevate-mobile-experience/package.json` (line 75)
**Evidence:** Dependencies include `html2canvas` v1.4.1 and `jspdf` v3.0.4

**Impact:** html2canvas renders HTML to canvas on the client side, which is slow on mobile, memory-intensive, and produces lower-quality PDFs than server-side generation. Large invoices may crash on older devices.

**Fix:** Move PDF generation to an edge function using a headless renderer or a PDF library like `@react-pdf/renderer` on the server side.

---

### LOW-01: Debug Logging in Production Code

**Evidence:** Multiple edge functions use `console.log` with detailed data including user IDs, product IDs, and error details. The `create-stripe-connect` function logs the full error object with `JSON.stringify(error, null, 2)`.

**Fix:** Use structured logging with severity levels and redact sensitive fields in production.

---

### LOW-02: `versionCode 1` and `versionName "1.0"`

**File:** `elevate-mobile-experience/android/app/build.gradle`
**Evidence:** Static version values

**Impact:** Play Store requires incrementing `versionCode` for each upload. Manual management is error-prone.

**Fix:** Automate version bumping in CI/CD. Derive `versionCode` from build number or commit count.

---

### LOW-03: No ProGuard Rules File

**File:** `elevate-mobile-experience/android/app/` (directory)
**Evidence:** No `proguard-rules.pro` file found

**Fix:** Create the file with rules to keep Capacitor bridge, WebView, and any reflection-based code.

---

### LOW-04: Dual Capacitor Config Files

**Files:** `capacitor.config.ts` + `capacitor.config.json`
**Evidence:** Both exist; Capacitor prioritizes `.ts` over `.json` but the `.json` has different values (includes `PurchasesPlugin` config, live `url`).

**Impact:** Confusion about which config is active. The `.json` config's `PurchasesPlugin` API key placeholder may not be used.

**Fix:** Consolidate into a single `capacitor.config.ts` with all settings.

---

### LOW-05: Missing `google-services.json`

**File:** `elevate-mobile-experience/android/app/build.gradle` (line ~29)
**Evidence:** Conditional plugin application: `if (file("google-services.json").exists())`

**Impact:** Firebase/Google services (push notifications, analytics, crashlytics) won't work until this file is added.

**Fix:** Download from Firebase Console and add to `android/app/`. Don't commit to Git; distribute via CI secrets.

---

## 5. Subscriptions Deep Dive

### Architecture

```
Mobile App (Capacitor)
  └─ @revenuecat/purchases-capacitor v11.3.2
       ├─ iOS: StoreKit 2 → Apple App Store
       ├─ Android: Google Play Billing Library → Play Store
       └─ Web: Stripe Billing (via rcb_ key)

RevenueCat Dashboard
  └─ Webhook → Supabase Edge Function (revenuecat-webhook)
       └─ Updates profiles.subscription_tier in PostgreSQL
```

### Product IDs

| Product ID       | Tier | Period  |
|-----------------|------|---------|
| `solo_monthly`  | solo | monthly |
| `solo_annual`   | solo | annual  |
| `crew_monthly`  | crew | monthly |
| `crew_annual`   | crew | annual  |
| `pro_monthly`   | pro  | monthly |
| `pro_annual`    | pro  | annual  |

### Stripe Price IDs (Web Fallback)

| Tier | Monthly Price ID | Annual Price ID |
|------|-----------------|-----------------|
| Solo ($29/mo, $288/yr) | `price_1SiyYiHfG2W0TmGhQDHUiQkt` | `price_1SyeNGHfG2W0TmGhIxUfjqqG` |
| Crew ($49/mo, $468/yr) | `price_1SiybGHfG2W0TmGh4QYBj996` | `price_1SyeNIHfG2W0TmGhZnphxnFi` |
| Pro ($79/mo, $780/yr)  | `price_1SiybvHfG2W0TmGh0DdDE5xt` | `price_1SyeNJHfG2W0TmGhqf0XBXSl` |

### Webhook Events Handled

| Event Type | Action |
|-----------|--------|
| INITIAL_PURCHASE | Set tier, provider, expiry |
| RENEWAL | Update tier, provider, expiry |
| PRODUCT_CHANGE | Update tier (upgrade/downgrade) |
| UNCANCELLATION | Restore active subscription |
| CANCELLATION | Downgrade to free |
| EXPIRATION | Downgrade to free |
| BILLING_ISSUE | Downgrade to free |
| SUBSCRIBER_ALIAS | Log only |

### Issues Found

1. **CRITICAL-02:** Secret keys instead of public keys
2. **HIGH-06:** No idempotency on webhook
3. **MEDIUM-04:** Store mapping defaults STRIPE to apple_iap
4. **MEDIUM-05:** No offline subscription caching
5. No receipt validation endpoint — relying entirely on RevenueCat webhook for server-side state
6. No subscription restoration flow visible in the codebase (restore purchases function exists but may not be wired up in UI)
7. No grace period handling for billing issues (immediately downgrades to free)

### Recommendations

- Add a 3-7 day grace period before downgrading on BILLING_ISSUE
- Implement client-side subscription caching with `@capacitor/preferences`
- Add a "Restore Purchases" button prominently in the subscription UI
- Add server-side receipt validation as a backup to webhooks
- Implement subscription status polling (every app foreground) as a fallback

---

## 6. Stripe Connect Deep Dive

### Architecture

```
Tradie (User)
  └─ App: "Connect Stripe" button
       └─ Edge Function: create-stripe-connect
            └─ Creates Stripe Express Account (AU)
                 └─ Onboarding link → Stripe hosted UI
                      └─ Return URL: /settings/payments?success=true

Client (Payer)
  └─ Invoice "Pay Now" link
       └─ Edge Function: create-checkout-session
            └─ Stripe Checkout Session (connected account)
                 └─ Payment → Stripe webhook
                      └─ Edge Function: stripe-webhook
                           └─ Updates invoice status + sends email
```

### Connect Account Configuration

| Setting | Value |
|---------|-------|
| Account Type | Express |
| Country | AU (Australia) |
| Capabilities | card_payments, transfers |
| Business Type | individual |
| MCC | 1799 (Special Trade Contractors) |

### Webhook Event Handling

The `stripe-webhook` function handles dual webhook secrets:
- **Connect webhook** (`STRIPE_WEBHOOK_SECRET`): Events from connected accounts
- **Platform webhook** (`STRIPE_WEBHOOK_SECRET_PLATFORM`): Platform subscription events

Events handled:
- `checkout.session.completed` — Marks invoice as paid, sends notification email
- `payment_intent.succeeded` — Updates payment records
- `customer.subscription.created/updated/deleted` — Manages platform subscriptions
- `invoice.payment_succeeded` — Updates billing records

### Issues Found

1. No platform fee configuration visible (Stripe Connect Express supports `application_fee_amount` but it's not set in checkout session creation)
2. No payout schedule configuration
3. No handling for `account.updated` webhook event (won't know if a connected account becomes restricted)
4. Error response in `create-stripe-connect` exposes raw Stripe error details to client (line 205)
5. No Stripe Connect account deletion/disconnection flow

### Recommendations

- Add `application_fee_amount` or `application_fee_percent` to checkout sessions
- Subscribe to and handle `account.updated` events
- Add account disconnection flow for users who want to unlink Stripe
- Sanitize error responses — don't expose raw Stripe errors to the client
- Add a dashboard showing payout history and upcoming transfers

---

## 7. Security & Privacy Review

### Authentication

- **Supabase Auth** handles user authentication
- JWT tokens used for API authorization
- Auth callback page exists for magic link / OAuth flows
- Password reset flow exists

### Authorization

- **RLS Policies:** Present but overly broad (see HIGH-01)
- **Edge Function Auth:** Inconsistent — some check Authorization header, others don't
- **verify_jwt = false** on all functions (see CRITICAL-04)

### Data Protection

- **Dexie + AES-GCM encryption** for sensitive offline data (positive)
- **DOMPurify** for HTML sanitization (positive)
- **Zod** for input validation (positive)
- **VITE_ prefix** leaks secrets into client bundle (see CRITICAL-02, CRITICAL-03)

### CORS Configuration

- Shared CORS helper (`_shared/cors.ts`) used across edge functions
- `getCorsHeaders(req)` generates origin-aware headers — should verify it's not overly permissive

### Sensitive Data in Client Bundle

The following `VITE_` prefixed variables end up in the compiled JavaScript:
- `VITE_REVENUECAT_ANDROID_API_KEY` (sk_ key — CRITICAL)
- `VITE_REVENUECAT_IOS_API_KEY` (sk_ key — CRITICAL)
- `VITE_REVENUECAT_WEB_API_KEY` (sk_ key — CRITICAL)
- `VITE_SUPABASE_SECRET_KEY` (CRITICAL)
- `VITE_SUPABASE_ANON_KEY` (acceptable — designed for client use)
- `VITE_SUPABASE_URL` (acceptable)
- `VITE_SUPABASE_PROJECT_ID` (acceptable)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (acceptable)
- `VITE_STRIPE_PRICE_ID_*` (acceptable)

---

## 8. Performance & Reliability Review

### Positive Patterns

- **TanStack Query v5** for data fetching with caching and background refetching
- **Dexie** (IndexedDB) for offline-first storage
- **Framer Motion** for smooth animations
- **React 18** with concurrent features available

### Concerns

1. **html2canvas + jspdf** for PDF generation — client-side rendering is slow and memory-intensive on mobile
2. **No service worker** for offline PWA support
3. **No lazy loading** visible for route-level code splitting (should verify in router config)
4. **recharts** library is large — consider a lighter charting library for mobile
5. **32 separate edge functions** — cold starts may cause latency; consider consolidating related functions
6. No visible error boundary implementation for graceful crash handling
7. No visible retry logic for failed API calls (TanStack Query has retry built in — verify it's configured)

---

## 9. Code Quality Review

### Positive

- TypeScript throughout with strict typing
- Zod schemas for runtime validation
- Shared CORS and idempotency helpers
- Modular architecture with clear separation of concerns
- React Hook Form for form management
- Consistent project structure

### Concerns

1. Some edge functions have verbose `console.log` that should use structured logging
2. Error handling exposes internal details in some responses
3. Dual config files (`.ts` and `.json`) cause confusion
4. Some `any` type assertions in edge functions (e.g., `(error as any).type`)

---

## 10. Test Coverage Plan

### Current State

**19 test files found:**
- Unit tests using Vitest + React Testing Library
- E2E tests using Playwright
- Integration tests using custom tsx script
- MSW for API mocking

**Test commands available:**
- `npm run test` — Vitest watch mode
- `npm run test:run` — Vitest single run
- `npm run test:coverage` — With V8 coverage
- `npm run test:e2e` — Playwright
- `npm run test:integration` — Custom integration suite
- `npm run test:full` — All tests combined

### Path to 100% Functional Coverage

#### Phase 1: Core Business Logic (Priority: Highest)

| Test File | Target | Description |
|-----------|--------|-------------|
| `src/lib/platformPayments.test.ts` | NEW | Platform detection, payment provider routing |
| `src/lib/subscriptions.test.ts` | NEW | Subscription tier logic, usage limits |
| `src/lib/offline-storage.test.ts` | NEW | Dexie operations, encryption/decryption |
| `src/lib/pdf-generation.test.ts` | NEW | PDF creation, template rendering |
| `src/lib/invoice-calculations.test.ts` | NEW | Line items, tax, totals |
| `src/lib/quote-calculations.test.ts` | NEW | Quote pricing, discounts |

#### Phase 2: Component Tests (Priority: High)

| Test File | Target | Description |
|-----------|--------|-------------|
| `src/pages/settings/SubscriptionSettings.test.tsx` | NEW/EXPAND | Tier selection, purchase flow, restore |
| `src/pages/settings/PaymentSettings.test.tsx` | NEW | Stripe Connect onboarding UI |
| `src/pages/invoices/*.test.tsx` | NEW | Invoice CRUD, send, payment status |
| `src/pages/quotes/*.test.tsx` | NEW | Quote CRUD, send, convert to invoice |
| `src/pages/clients/*.test.tsx` | NEW | Client CRUD, search, filter |
| `src/pages/jobs/*.test.tsx` | NEW | Job management, status tracking |
| `src/pages/auth/*.test.tsx` | NEW | Login, signup, password reset flows |

#### Phase 3: Integration Tests (Priority: High)

| Test File | Target | Description |
|-----------|--------|-------------|
| `e2e/subscription-flow.spec.ts` | NEW | Full subscription purchase E2E |
| `e2e/stripe-connect.spec.ts` | NEW | Connect onboarding E2E |
| `e2e/invoice-payment.spec.ts` | NEW | Invoice creation → payment E2E |
| `e2e/quote-to-invoice.spec.ts` | NEW | Quote creation → conversion E2E |
| `e2e/auth-flow.spec.ts` | NEW | Full auth flow E2E |
| `e2e/offline-mode.spec.ts` | NEW | Offline data persistence E2E |

#### Phase 4: Edge Function Tests (Priority: Medium)

| Test File | Target | Description |
|-----------|--------|-------------|
| `tests/functions/revenuecat-webhook.test.ts` | NEW | All event types, signature verification, idempotency |
| `tests/functions/stripe-webhook.test.ts` | NEW | All event types, dual secret, idempotency |
| `tests/functions/create-stripe-connect.test.ts` | NEW | Account creation, existing account, errors |
| `tests/functions/create-checkout-session.test.ts` | NEW | Session creation, connected accounts |
| `tests/functions/accounting-sync.test.ts` | NEW | Xero/MYOB/QuickBooks sync |
| `tests/functions/communication.test.ts` | NEW | Email/SMS send functions |

#### Estimated Test Count for 100% Functional Coverage

| Category | Estimated Tests |
|----------|----------------|
| Unit (lib functions) | ~80 |
| Component (pages) | ~120 |
| Integration (E2E) | ~40 |
| Edge Functions | ~60 |
| **Total** | **~300** |

---

## 11. Remediation Plan

### Phase 1: Emergency (Do Now — Week 1)

| # | Task | Finding | Effort |
|---|------|---------|--------|
| 1 | Rotate ALL compromised secrets | CRITICAL-01 | 2h |
| 2 | Remove `.env` from Git tracking | CRITICAL-01 | 30m |
| 3 | Purge secrets from Git history (BFG) | CRITICAL-01 | 1h |
| 4 | Replace RevenueCat sk_ keys with public keys | CRITICAL-02 | 30m |
| 5 | Remove `VITE_SUPABASE_SECRET_KEY` | CRITICAL-03 | 30m |
| 6 | Enable `verify_jwt = true` on non-webhook functions | CRITICAL-04 | 2h |
| 7 | Fix RLS policies to scope by user_id | HIGH-01 | 3h |

### Phase 2: Security Hardening (Week 2-3)

| # | Task | Finding | Effort |
|---|------|---------|--------|
| 8 | Set `allowBackup=false` on Android | HIGH-02 | 30m |
| 9 | Enable ProGuard/R8 minification | HIGH-03 | 2h |
| 10 | Configure Android signing for release | HIGH-04 | 1h |
| 11 | Generate iOS Xcode project | HIGH-05 | 4h |
| 12 | Add idempotency to RevenueCat webhook | HIGH-06 | 1h |
| 13 | Add network security config (Android) | MEDIUM-03 | 1h |
| 14 | Configure deep links (Android + iOS) | MEDIUM-02 | 3h |

### Phase 3: Functionality Fixes (Week 3-4)

| # | Task | Finding | Effort |
|---|------|---------|--------|
| 15 | Fix Capacitor config consolidation | MEDIUM-01, LOW-04 | 1h |
| 16 | Fix RevenueCat store mapping | MEDIUM-04 | 30m |
| 17 | Add offline subscription caching | MEDIUM-05 | 4h |
| 18 | Add rate limiting to edge functions | MEDIUM-06 | 3h |
| 19 | Move PDF generation server-side | MEDIUM-07 | 8h |
| 20 | Add billing issue grace period | Subscriptions | 2h |

### Phase 4: Test Coverage (Week 4-8)

| # | Task | Effort |
|---|------|--------|
| 21 | Write unit tests for core lib functions | 16h |
| 22 | Write component tests for all pages | 24h |
| 23 | Write E2E tests for critical flows | 16h |
| 24 | Write edge function integration tests | 16h |
| 25 | Set up CI/CD test pipeline | 4h |
| 26 | Achieve and maintain 100% functional coverage | Ongoing |

---

## 12. Appendix

### Key File Paths

```
elevate-mobile-experience/
├── src/
│   ├── main.tsx                          # App entry point
│   ├── App.tsx                           # Router and providers
│   ├── lib/
│   │   ├── platformPayments.ts           # Platform detection
│   │   ├── supabase.ts                   # Supabase client
│   │   └── ...
│   ├── pages/
│   │   ├── settings/
│   │   │   ├── SubscriptionSettings.tsx  # Subscription UI
│   │   │   ├── PaymentSettings.tsx       # Stripe Connect UI
│   │   │   └── ...
│   │   └── ...
│   └── components/
├── supabase/
│   ├── config.toml                       # Edge function config
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts                   # CORS helper
│   │   │   └── webhook-idempotency.ts    # Idempotency helper
│   │   ├── revenuecat-webhook/index.ts   # RevenueCat webhook
│   │   ├── stripe-webhook/index.ts       # Stripe webhook
│   │   ├── create-stripe-connect/index.ts# Stripe Connect
│   │   ├── create-checkout-session/index.ts
│   │   └── ... (32 total)
│   └── migrations/
├── android/
│   └── app/
│       ├── build.gradle                  # Android build config
│       └── src/main/AndroidManifest.xml  # Android manifest
├── ios/                                  # Needs Xcode project
├── capacitor.config.ts                   # Active Capacitor config
├── capacitor.config.json                 # Secondary config
├── .env                                  # SECRETS - REMOVE FROM GIT
├── .env.example                          # Template
├── package.json
└── vite.config.ts
```

### Commands Reference

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npx cap sync                   # Sync web assets to native projects
npx cap open android           # Open Android Studio
npx cap open ios               # Open Xcode

# Testing
npm run test:run               # Unit tests
npm run test:coverage          # Unit tests with coverage
npm run test:e2e               # E2E tests (Playwright)
npm run test:integration       # Integration tests
npm run test:full              # All tests

# Supabase
npx supabase start             # Start local Supabase
npx supabase functions serve   # Serve edge functions locally
npx supabase db push           # Push migrations
```

---

*Report generated by automated audit on 2026-02-13*
