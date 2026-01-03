# Phase 2: High-Priority Security Fixes

**Date:** January 3, 2026
**Status:** 🔄 In Progress
**Priority:** HIGH (Before App Store Submission)

---

## 📋 OVERVIEW

Phase 2 focuses on high-priority security and compliance fixes required before App Store submission and production launch.

### Scope
- **Timeframe:** 1-2 weeks
- **Focus:** Security, compliance, data protection
- **Goal:** App Store ready + Production secure

---

## ✅ ALREADY COMPLETED (From Phase 1)

1. ✅ Use Capacitor SecureStorage for auth tokens
2. ✅ Change Android build to AAB format
3. ✅ All CORS security implemented

---

## 🎯 PHASE 2 TASKS (7 Remaining)

### 1. 🔴 CRITICAL: Encrypt Bank Account Details
**Priority:** CRITICAL
**Risk:** HIGH - Australian Banking Standards violation
**Files:**
- `src/integrations/supabase/types.ts` (profiles table)
- `src/pages/settings/PaymentSettings.tsx`
- `supabase/functions/_shared/encryption.ts` (extend existing)

**Current State:**
```typescript
// INSECURE: Plaintext storage
bank_name: string
bank_bsb: string
bank_account_number: string
bank_account_name: string
```

**Required Changes:**
1. Extend existing AES-GCM encryption module
2. Encrypt on write, decrypt on read
3. Use ENCRYPTION_KEY environment variable
4. Add database migration for encrypted columns
5. Update PaymentSettings.tsx to encrypt/decrypt

**Estimated Time:** 4-6 hours

---

### 2. 🔴 HIGH: Implement OAuth State Signing (CSRF Protection)
**Priority:** HIGH
**Risk:** HIGH - Session hijacking vulnerability
**File:** `supabase/functions/xero-oauth/index.ts` (Line 76)

**Current State:**
```typescript
// INSECURE: Base64 encoding, no signature
const stateParam = btoa(JSON.stringify({ userId: user.id }));
```

**Required Fix:**
```typescript
// SECURE: HMAC-SHA256 signed state
import { signState, verifyState } from "../_shared/oauth-security.ts";

// On authorization request
const state = signState({ userId: user.id, timestamp: Date.now() });

// On callback
const { valid, data } = verifyState(stateParam);
if (!valid) throw new Error('Invalid OAuth state');
```

**Implementation:**
1. Create `supabase/functions/_shared/oauth-security.ts`
2. Implement HMAC-SHA256 signing
3. Add timestamp validation (10 min expiry)
4. Update xero-oauth function

**Estimated Time:** 2-3 hours

---

### 3. 🟡 REQUIRED: Add iOS Privacy Manifest
**Priority:** HIGH
**Risk:** App Store rejection
**File:** `ios/App/PrivacyInfo.xcprivacy` (new)

**Required:**
Apple requires privacy manifest for all apps using certain APIs.

**Implementation:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeEmailAddress</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            </array>
        </dict>
        <!-- Add other collected data types -->
    </array>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

**Data to Declare:**
- Email addresses (authentication)
- Name, phone (client management)
- Financial data (invoices)
- Location (optional - for job tracking)

**Estimated Time:** 2-3 hours

---

### 4. 🟡 HIGH: Encrypt Offline IndexedDB Storage
**Priority:** HIGH
**Risk:** MEDIUM - Offline data exposure
**File:** `src/lib/offline/database.ts`

**Current State:**
```typescript
// INSECURE: Plaintext Dexie storage
export const db = new Dexie('tradiemate');
db.version(1).stores({
  clients: '++id, user_id, name, email',
  jobs: '++id, user_id, client_id, title',
  // ...
});
```

**Required Fix:**
- Implement encryption middleware for Dexie
- Use Web Crypto API for AES-GCM encryption
- Derive key from user session
- Auto-encrypt on write, decrypt on read

**Implementation:**
```typescript
import { encryptData, decryptData } from './crypto';

db.clients.hook('creating', async (primKey, obj) => {
  return { ...obj, encrypted: await encryptData(obj) };
});

db.clients.hook('reading', async (obj) => {
  return obj.encrypted ? await decryptData(obj.encrypted) : obj;
});
```

**Estimated Time:** 4-6 hours

---

### 5. 🟡 MEDIUM: Fix useToast Dependency Array Bug
**Priority:** MEDIUM
**Risk:** LOW - Stability issue
**File:** `src/hooks/use-toast.ts`

**Issue:**
Dependency array missing critical dependencies causing stale closures.

**Fix:**
Review and add missing dependencies to prevent memory leaks.

**Estimated Time:** 1 hour

---

### 6. 🟡 MEDIUM: Add Server-Side Usage Limit Enforcement
**Priority:** MEDIUM
**Risk:** MEDIUM - Revenue loss
**Files:**
- `supabase/functions/*/index.ts` (before operations)

**Current State:**
Client-side checks only - can be bypassed

**Required Fix:**
```typescript
// In each edge function (create-invoice, create-quote, etc.)
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription_tier')
  .eq('user_id', user.id)
  .single();

// Check tier limits
const limits = {
  free: { clients: 5, invoices: 10 },
  solo: { clients: 50, invoices: 100 },
  crew: { clients: 200, invoices: 500 },
  pro: { clients: Infinity, invoices: Infinity }
};

const tierLimits = limits[profile.subscription_tier];
// Enforce before creating...
```

**Estimated Time:** 3-4 hours

---

### 7. 🟢 LOW: Offline Sync Data Loss Prevention
**Priority:** LOW (optimization)
**Risk:** MEDIUM - User frustration
**File:** `src/lib/offline/syncManager.ts`

**Issues:**
- Queue corruption silently clears changes (Line 1250)
- Retry limit too low (3 attempts)
- Deferred items never retried

**Fixes:**
1. Increase retry limit to 10
2. Add queue backup before corruption handling
3. Implement deferred retry mechanism
4. Add user notification for data loss

**Estimated Time:** 6-8 hours

---

## 📊 PHASE 2 COMPLETION TRACKER

| Task | Priority | Status | Est. Time | Actual Time |
|------|----------|--------|-----------|-------------|
| 1. Bank account encryption | 🔴 CRITICAL | ⏳ Pending | 4-6h | - |
| 2. OAuth state signing | 🔴 HIGH | ⏳ Pending | 2-3h | - |
| 3. iOS Privacy Manifest | 🟡 REQUIRED | ⏳ Pending | 2-3h | - |
| 4. Offline data encryption | 🟡 HIGH | ⏳ Pending | 4-6h | - |
| 5. useToast bug fix | 🟡 MEDIUM | ⏳ Pending | 1h | - |
| 6. Usage limit enforcement | 🟡 MEDIUM | ⏳ Pending | 3-4h | - |
| 7. Sync data loss prevention | 🟢 LOW | ⏳ Pending | 6-8h | - |

**Total Estimated Time:** 22-33 hours (3-5 days)

---

## 🎯 SUCCESS CRITERIA

### Must Have (Before App Store)
- ✅ Bank account details encrypted (ABA compliance)
- ✅ OAuth state signed (CSRF protection)
- ✅ iOS Privacy Manifest added
- ✅ Offline data encrypted

### Should Have (Before Production)
- ✅ useToast bug fixed
- ✅ Server-side usage limits enforced

### Nice to Have (Can defer)
- Offline sync improvements

---

## 🚀 DEPLOYMENT READINESS (Post-Phase 2)

### App Store Submission
✅ **READY** - All compliance requirements met

### Production Deployment
✅ **READY** - Security hardened

### Accepting Payments
✅ **READY** - Banking compliance met

---

## 📝 IMPLEMENTATION ORDER

**Day 1-2:**
1. Bank account encryption (CRITICAL)
2. OAuth state signing (HIGH)

**Day 3:**
3. iOS Privacy Manifest (REQUIRED)
4. useToast bug fix (quick win)

**Day 4-5:**
5. Offline data encryption (HIGH)
6. Server-side usage limits (MEDIUM)

**Day 6+ (Optional):**
7. Sync data loss prevention (optimization)

---

**Status:** Ready to begin implementation
**Next Step:** Start with bank account encryption
**Last Updated:** January 3, 2026

