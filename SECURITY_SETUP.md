# Security Configuration Guide

This document provides step-by-step instructions for securing TradieMate before production deployment.

---

## ✅ Completed Security Measures

### 1. JWT Verification ✅
All non-webhook edge functions require authentication via JWT tokens.

**Configuration:** `supabase/config.toml`
```toml
[functions.generate-pdf]
verify_jwt = true

[functions.send-notification]
verify_jwt = true

[functions.send-team-invitation]
verify_jwt = true

[functions.accept-team-invitation]
verify_jwt = true
# ... etc
```

**Webhooks (correctly disabled):**
```toml
[functions.stripe-webhook]
verify_jwt = false  # Uses signature verification instead

[functions.subscription-webhook]
verify_jwt = false  # Uses signature verification instead

[functions.revenuecat-webhook]
verify_jwt = false  # Uses signature verification instead

[functions.generate-recurring-invoices]
verify_jwt = false  # Cron job uses service role key
```

### 2. Webhook Signature Verification ✅

#### Stripe Webhooks
Both `stripe-webhook` and `subscription-webhook` verify signatures using:
```typescript
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

**Environment Variables Required:**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret from Stripe Dashboard

**How to get webhook secret:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy the signing secret

#### RevenueCat Webhook
Verifies HMAC-SHA256 signatures:
```typescript
const signature = req.headers.get('X-RevenueCat-Signature');
// Compares HMAC-SHA256 of request body with signature header
```

**Environment Variables Required:**
- `REVENUECAT_WEBHOOK_SECRET` - Webhook authorization token from RevenueCat

**How to get webhook secret:**
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to Projects → YOUR_PROJECT → Integrations → Webhooks
3. Create webhook: `https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook`
4. Copy the authorization header value

### 3. Rate Limiting ✅
Implemented in-memory rate limiter with configurable limits.

**Usage in Edge Functions:**
```typescript
import { checkRateLimit, createRateLimitResponse, getClientIdentifier, RATE_LIMITS } from '../_shared/rateLimiter.ts';

// In your edge function:
const identifier = getClientIdentifier(req, user?.id);
const rateLimit = checkRateLimit(identifier, RATE_LIMITS.api);

if (rateLimit.isLimited) {
  return createRateLimitResponse(rateLimit.resetTime, corsHeaders);
}
```

**Rate Limit Configurations:**
- **Authentication:** 5 requests / 15 minutes
- **API Endpoints:** 60 requests / minute
- **Webhooks:** 100 requests / minute
- **Messaging (Email/SMS):** 10 requests / hour
- **PDF Generation:** 30 requests / minute

**Note:** This is an in-memory implementation. For production with multiple instances, consider:
- [Upstash Redis](https://upstash.com/) for distributed rate limiting
- Cloudflare Workers for edge-level protection

### 4. Row Level Security (RLS) ✅
All database tables have RLS policies enforcing data isolation:
- 76 RLS policies across all tables
- Team-based data isolation
- User-specific access control
- Profile authentication fixed with explicit `TO authenticated` clauses

---

## 🔴 Critical: Required Configuration

### 1. Stripe Configuration

#### Production Price IDs
**File:** `src/lib/subscriptionTiers.ts`

Currently using placeholder price IDs:
```typescript
const STRIPE_PRICES = {
  solo: { monthly: 'price_solo_monthly' },  // ❌ PLACEHOLDER
  crew: { monthly: 'price_crew_monthly' },  // ❌ PLACEHOLDER
  pro: { monthly: 'price_pro_monthly' },    // ❌ PLACEHOLDER
};
```

**Required Actions:**
1. Create products in [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Create prices for each product:
   - Solo: $29 AUD/month
   - Crew: $49 AUD/month
   - Pro: $79 AUD/month
3. Replace placeholder IDs with real price IDs:
   ```typescript
   const STRIPE_PRICES = {
     solo: { monthly: 'price_XXXXXXXXXXXXXX' },
     crew: { monthly: 'price_XXXXXXXXXXXXXX' },
     pro: { monthly: 'price_XXXXXXXXXXXXXX' },
   };
   ```

#### Webhook Configuration
**File:** `supabase/functions/subscription-webhook/index.ts`

Update price-to-tier mapping:
```typescript
const PRICE_TO_TIER: Record<string, string> = {
  'price_XXXXXXXXXXXXXX': 'solo',  // Replace with real price ID
  'price_XXXXXXXXXXXXXX': 'crew',  // Replace with real price ID
  'price_XXXXXXXXXXXXXX': 'pro',   // Replace with real price ID
};
```

#### Environment Variables
Set in Supabase Dashboard → Settings → Edge Functions → Secrets:
```bash
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXX  # From Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXX  # From Stripe Webhooks page
```

### 2. RevenueCat Configuration

#### iOS Setup
**File:** `capacitor.config.json`
```json
{
  "plugins": {
    "RevenueCat": {
      "apiKey": "appl_PLACEHOLDER_IOS_API_KEY"  // ❌ REPLACE
    }
  }
}
```

**Required Actions:**
1. Create iOS app in [RevenueCat Dashboard](https://app.revenuecat.com)
2. Get API key from Project Settings → API Keys → Apple App Store
3. Replace placeholder with real key: `appl_XXXXXXXXXXXXXXXXXXXX`

#### Android Setup
**File:** `src/lib/purchases.ts`
```typescript
const androidApiKey = 'goog_PLACEHOLDER_ANDROID_API_KEY';  // ❌ REPLACE
```

**Required Actions:**
1. Create Android app in RevenueCat Dashboard
2. Get API key from Project Settings → API Keys → Google Play Store
3. Replace placeholder: `goog_XXXXXXXXXXXXXXXXXXXX`

#### Product IDs
**File:** `supabase/functions/revenuecat-webhook/index.ts`

Update product-to-tier mapping:
```typescript
const PRODUCT_TO_TIER: Record<string, string> = {
  'solo_monthly': 'solo',     // Must match RevenueCat product ID
  'crew_monthly': 'crew',     // Must match RevenueCat product ID
  'pro_monthly': 'pro',       // Must match RevenueCat product ID
};
```

Create these products in RevenueCat Dashboard with exact IDs.

#### Environment Variables
```bash
REVENUECAT_WEBHOOK_SECRET=XXXXXXXXXXXX  # From RevenueCat webhook settings
```

### 3. Email Configuration

TradieMate uses Supabase Auth for email sending. Verify SMTP settings:

**Supabase Dashboard → Authentication → Email Templates**
- Ensure custom SMTP is configured (or use Supabase default)
- Test email delivery for:
  - User signup confirmation
  - Password reset
  - Team invitations
  - Invoice notifications

**Custom SMTP (Optional):**
If you want to use your own email service (SendGrid, Mailgun, AWS SES):
1. Configure in Supabase Dashboard → Settings → Auth
2. Add SMTP credentials
3. Test email delivery

---

## 🧪 Security Testing Checklist

### Before Production Launch

#### 1. Authentication Security
- [ ] Test JWT token expiry and refresh
- [ ] Verify unauthorized requests are rejected (401)
- [ ] Test password reset flow
- [ ] Verify email confirmation works
- [ ] Test rate limiting on auth endpoints

#### 2. Webhook Security
- [ ] Test Stripe webhook with invalid signature (should reject with 400)
- [ ] Test RevenueCat webhook with invalid signature (should reject with 401)
- [ ] Verify webhooks update subscription status correctly
- [ ] Test webhook replay attack protection

#### 3. RLS Policies
- [ ] Create two users in different teams
- [ ] Verify User A cannot see User B's clients
- [ ] Verify User A cannot see User B's quotes
- [ ] Verify User A cannot see User B's invoices
- [ ] Test team member permissions (owner/admin/member/viewer)

#### 4. Rate Limiting
- [ ] Test API rate limits (should return 429 after limit)
- [ ] Verify rate limit headers are present
- [ ] Test different identifiers (user ID, IP, API key)
- [ ] Ensure legitimate users aren't blocked

#### 5. Penetration Testing
- [ ] Run OWASP ZAP or Burp Suite scan
- [ ] Test for SQL injection in all inputs
- [ ] Test for XSS in text inputs (client names, notes)
- [ ] Verify file upload size limits (logo: 2MB)
- [ ] Test API endpoint enumeration

---

## 📋 npm Vulnerabilities

### Current Status
```bash
npm audit

# 2 moderate severity vulnerabilities
# esbuild <=0.24.2 - Command injection
# vite 0.11.0 - 6.1.6 - Path traversal
```

### Resolution
```bash
# WARNING: This may introduce breaking changes
npm audit fix --force

# After fixing, test thoroughly:
npm run build
npm run dev
npm run type-check
```

### Alternative: Accept Risk
If you can't upgrade immediately:
1. Document the known vulnerabilities
2. Ensure they don't affect production (esbuild is dev-only)
3. Plan upgrade after testing in staging
4. Monitor for exploits

---

## 🚀 Deployment Security Checklist

### Environment Variables
Ensure these are set in Supabase Dashboard:

**Stripe:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

**RevenueCat:**
- `REVENUECAT_WEBHOOK_SECRET`

**Supabase (Auto-configured):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

### CORS Configuration
**File:** All edge functions have CORS headers

Verify allowed origins in production:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // ⚠️ Consider restricting to your domain
};
```

For production, consider:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com',
};
```

### HTTPS Only
- [ ] Enforce HTTPS in production (Supabase does this by default)
- [ ] Set Secure cookie flags
- [ ] Enable HSTS headers

### Content Security Policy
Add CSP headers to prevent XSS:
```typescript
'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
```

---

## 🛡️ Ongoing Security Maintenance

### Monthly Tasks
- [ ] Review Supabase access logs for suspicious activity
- [ ] Check for npm dependency updates: `npm outdated`
- [ ] Run security audit: `npm audit`
- [ ] Review RLS policies for new tables/columns

### Quarterly Tasks
- [ ] Rotate API keys and webhook secrets
- [ ] Review and update rate limits based on traffic
- [ ] Penetration testing or security audit
- [ ] Update security documentation

### Annual Tasks
- [ ] Comprehensive security audit by external firm
- [ ] Review and update privacy policy
- [ ] Compliance review (GDPR, CCPA if applicable)
- [ ] Update SSL certificates (if using custom domain)

---

## 📞 Security Incident Response

### If you suspect a security breach:

1. **Immediately:**
   - Rotate all API keys (Stripe, RevenueCat, Supabase)
   - Check Supabase logs for unauthorized access
   - Disable affected webhooks if compromised

2. **Within 24 hours:**
   - Assess scope of breach
   - Document affected users
   - Notify affected users if personal data compromised
   - File incident report

3. **Within 72 hours:**
   - Implement fixes for vulnerability
   - Deploy security patches
   - Conduct post-mortem analysis
   - Update security procedures

**Contact:**
- Supabase Support: support@supabase.io
- Stripe Support: https://support.stripe.com
- RevenueCat Support: https://www.revenuecat.com/support

---

## ✅ Security Checklist Summary

**Before Production:**
- [x] JWT verification enabled for all non-webhook functions
- [x] Webhook signature verification implemented
- [x] Rate limiting implemented
- [x] RLS policies on all tables
- [ ] Real Stripe price IDs configured
- [ ] Real RevenueCat API keys configured
- [ ] npm vulnerabilities resolved
- [ ] Security testing completed
- [ ] Environment variables set in production
- [ ] CORS restricted to production domain
- [ ] Email delivery tested
- [ ] Backup and recovery plan documented

**After Production:**
- [ ] Monitor rate limit logs
- [ ] Review webhook failure logs weekly
- [ ] Monthly security audits scheduled
- [ ] Incident response plan documented
