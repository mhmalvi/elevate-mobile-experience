# Security Fixes Implementation Progress

**Started:** January 3, 2026
**Status:** Phase 1 (Critical Fixes) - IN PROGRESS

---

## ✅ COMPLETED FIXES

### 1. Capacitor Mobile Security Configuration
**File:** `capacitor.config.ts`
**Status:** ✅ FIXED
**Changes:**
- Cleartext traffic now conditional (development only)
- `allowMixedContent` disabled (prevents HTTP resources in HTTPS app)
- Android build changed from APK to AAB format (Play Store requirement)

**Impact:**
- ✅ Prevents MITM attacks in production
- ✅ Ensures App Store compliance
- ✅ Enforces HTTPS-only communication

---

### 2. Secure CORS Module Created
**File:** `supabase/functions/_shared/cors.ts`
**Status:** ✅ CREATED
**Features:**
- Whitelist-based origin validation
- Development vs production environment detection
- Helper functions for consistent responses
- Prevents CSRF attacks

**Whitelisted Production Domains:**
- `https://tradiemate.com.au`
- `https://www.tradiemate.com.au`
- `https://app.tradiemate.com.au`

**Development Domains:**
- `http://localhost:5173`
- `capacitor://localhost`

**Impact:**
- ✅ Prevents cross-site request forgery
- ✅ Restricts API access to authorized domains only

---

### 3. Stripe Webhook CORS Updated
**File:** `supabase/functions/stripe-webhook/index.ts`
**Status:** ✅ UPDATED
**Changes:**
- Replaced wildcard CORS with secure getCorsHeaders()
- Now validates request origin before processing

---

## 🚧 IN PROGRESS

### Edge Function CORS Updates
**Remaining:** 22 edge functions need CORS updates
**Pattern:** Apply same cors.ts import to all functions

**Functions to update:**
1. ✅ stripe-webhook (DONE)
2. ⏳ revenuecat-webhook
3. ⏳ subscription-webhook
4. ⏳ create-payment
5. ⏳ create-stripe-connect
6. ⏳ send-email
7. ⏳ send-notification
8. ⏳ send-invoice
9. ⏳ generate-pdf
10. ⏳ xero-oauth
11. ⏳ xero-sync-clients
12. ⏳ xero-sync-invoices
13. ⏳ check-subscription
14. ⏳ check-stripe-account
15. ⏳ customer-portal
16. ⏳ payment-reminder
17. ⏳ accept-team-invitation
18. ⏳ send-team-invitation
19. ⏳ delete-account
20. ⏳ generate-recurring-invoices
21. ⏳ create-subscription-checkout

---

## ⏳ PENDING CRITICAL FIXES

### 3. Add Authentication to Unauthenticated Functions
**Priority:** CRITICAL
**Status:** NOT STARTED

**Functions missing auth:**
- `send-email` - Anyone can send emails
- `send-notification` - Anyone can send SMS
- `generate-pdf` - Anyone can generate PDFs
- `payment-reminder` - Anyone can trigger reminders

**Required:**
```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return createErrorResponse(req, "Unauthorized", 401);
}
const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
if (error || !user) {
  return createErrorResponse(req, "Invalid token", 401);
}
```

---

### 4. Fix Client-Side Platform Fee Calculation
**File:** `supabase/functions/create-payment/index.ts`
**Priority:** CRITICAL
**Status:** NOT STARTED

**Current issue:**
```typescript
// Line 112-115 - Client provides fee amount (can be manipulated)
const platformFeeAmount = Math.round(balance * 100 * 0.0015);
```

**Required fix:**
Server must recalculate fees independently, never trust client input.

---

### 5. Add User Ownership Validation in PDF Generation
**File:** `supabase/functions/generate-pdf/index.ts`
**Priority:** CRITICAL
**Status:** NOT STARTED

**Current issue:**
```typescript
// Lines 36-40 - No user_id check
.eq("id", id)  // Anyone with ID can get PDF
```

**Required fix:**
```typescript
.eq("id", id)
.eq("user_id", userId)  // Verify ownership
```

---

### 6. Sanitize HTML in PDF Preview (XSS Prevention)
**File:** `src/components/PDFPreviewModal.tsx`
**Priority:** CRITICAL
**Status:** NOT STARTED

**Current vulnerability:**
```typescript
// Lines 106, 123, 200 - Unsafe HTML injection
printWindow.document.write(html);  // XSS risk
container.innerHTML = html;  // XSS risk
```

**Required fix:**
Install and use DOMPurify:
```typescript
import DOMPurify from 'dompurify';
const cleanHtml = DOMPurify.sanitize(html);
```

---

### 7. Move Hardcoded Stripe Price IDs to Environment
**File:** `supabase/functions/check-subscription/index.ts`
**Priority:** HIGH
**Status:** NOT STARTED

**Current issue:**
```typescript
// Lines 12-16 - Hardcoded production price IDs
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SiyYiHfG2W0TmGhQDHUiQkt': 'solo',
  // ...
};
```

**Required fix:**
- Add to `.env`:
  ```
  STRIPE_PRICE_ID_SOLO=price_xxxxx
  STRIPE_PRICE_ID_CREW=price_xxxxx
  STRIPE_PRICE_ID_PRO=price_xxxxx
  ```
- Load dynamically from environment

---

### 8. Implement Secure Token Storage for Mobile
**File:** `src/integrations/supabase/client.ts`
**Priority:** CRITICAL
**Status:** NOT STARTED

**Current issue:**
```typescript
auth: {
  storage: localStorage,  // NOT secure on mobile
}
```

**Required fix:**
```typescript
import { Preferences } from '@capacitor/preferences';

// Implement secure storage wrapper
const secureStorage = {
  getItem: async (key) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key, value) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key) => {
    await Preferences.remove({ key });
  },
};

auth: {
  storage: isNativePlatform() ? secureStorage : sessionStorage,
}
```

---

## 🔴 CRITICAL ACTION REQUIRED

### Rotate ALL Exposed API Credentials

Your `.env` file was committed to git history (commit d54ea9b). While it's now gitignored, anyone with repository access can still see these secrets in history.

**Credentials to rotate IMMEDIATELY:**

1. **RevenueCat API Keys**
   - Android: `sk_RaPieGIXYSWkXUvztlmmuERESyqZk`
   - iOS: `sk_IigVSHMnIvIGZLJOxKQewiFvMQPrW`
   - Webhook: `rc_webhook_9f83kdf93kd9sdf9sdf`
   - Action: Generate new keys at https://app.revenuecat.com/settings/api-keys

2. **Resend Email API Key**
   - Key: `re_Wrocvos4_4hPP5GdvFjjJxrSxvMQ4PNsR`
   - Action: Rotate at https://resend.com/api-keys

3. **Twilio Credentials**
   - Account SID: `ACcea5b2de44478a73006bb424055d6f76`
   - Auth Token: `b8c7f1648a29014c870cd430bba6cec4`
   - Action: Generate new auth token at https://www.twilio.com/console

4. **Supabase Keys**
   - Service Role Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Access Token: `sbp_08470f9134209d5aa87366467ba53eeebbde19c8`
   - Action: Regenerate at https://app.supabase.com -> Settings -> API

5. **Stripe Webhook Secrets**
   - Update in Stripe Dashboard -> Webhooks

---

## 📊 PROGRESS SUMMARY

**Phase 1 (Critical Security) Progress:**
- ✅ Completed: 2/9 tasks (22%)
- 🚧 In Progress: 1/9 tasks (11%)
- ⏳ Pending: 6/9 tasks (67%)

**Estimated Time Remaining:**
- Credential rotation: 2-3 hours (manual process)
- Remaining code fixes: 4-6 hours
- Testing: 2-3 hours
**Total: 8-12 hours**

---

## 📝 NEXT STEPS

### Immediate (Today):
1. ⚠️ Rotate all exposed credentials
2. ✅ Complete CORS updates for remaining 22 edge functions
3. ✅ Add authentication to 4 unauthenticated functions

### Short-term (This Week):
4. ✅ Fix platform fee calculation
5. ✅ Add PDF ownership validation
6. ✅ Sanitize HTML in PDF preview
7. ✅ Move Stripe price IDs to environment
8. ✅ Implement secure token storage

### Testing (After Fixes):
- Test mobile app with AAB build
- Verify CORS with production domains
- Test authentication on all endpoints
- Verify secure token storage on iOS/Android

---

## 🎯 SUCCESS CRITERIA

Phase 1 will be complete when:
- ✅ All credentials rotated and secured
- ✅ No cleartext traffic in production builds
- ✅ CORS whitelist enforced on all endpoints
- ✅ All edge functions require authentication
- ✅ Server-side validation for all sensitive operations
- ✅ XSS vulnerabilities patched
- ✅ Mobile token storage uses secure storage
- ✅ No hardcoded secrets in code

---

**Last Updated:** January 3, 2026
**Next Review:** After completing all Phase 1 tasks
