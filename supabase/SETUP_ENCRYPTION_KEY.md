git# Encryption Key Setup for Xero Token Security

## Overview

Xero OAuth tokens are now encrypted before being stored in the database for enhanced security. This requires setting up an encryption key in Supabase Edge Function Secrets.

## Why Encryption is Important

- **Security:** Prevents plaintext credentials from being exposed in database backups or breaches
- **Compliance:** Meets GDPR, PCI-DSS, and other data protection requirements
- **Best Practice:** Industry standard for storing sensitive API tokens

## Setup Instructions

### Step 1: Generate a Strong Encryption Key

Generate a random 32-character encryption key. You can use one of these methods:

**Option A: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B: Using OpenSSL**
```bash
openssl rand -hex 32
```

**Option C: Using Python**
```python
import secrets
print(secrets.token_hex(32))
```

**Option D: Online Tool**
Visit: https://generate-random.org/encryption-key-generator?count=1&bytes=32&cipher=aes-256-cbc

### Step 2: Set the Secret in Supabase

**Using Supabase CLI:**
```bash
cd supabase
supabase secrets set ENCRYPTION_KEY="your-generated-key-here"
```

**Using Supabase Dashboard:**
1. Go to your Supabase project dashboard
2. Click **Edge Functions** in the left sidebar
3. Click **Manage secrets**
4. Add new secret:
   - Name: `ENCRYPTION_KEY`
   - Value: Your generated 32-character key
5. Click **Save**

### Step 3: Verify Setup

Test that encryption is working:

```bash
# Deploy the Edge Functions
supabase functions deploy xero-oauth
supabase functions deploy xero-sync-clients
supabase functions deploy xero-sync-invoices

# Test by connecting Xero (from your app UI)
# Check logs to ensure no encryption errors:
supabase functions logs xero-oauth
```

## Important Security Notes

⚠️ **DO NOT:**
- Commit the encryption key to version control
- Share the key in plain text (Slack, email, etc.)
- Use the same key for development and production
- Store the key in `.env` file (only for Edge Function secrets)

✅ **DO:**
- Use different keys for dev/staging/production
- Store the key securely (password manager, secrets vault)
- Rotate the key periodically (every 6-12 months)
- Keep a backup of the key in a secure location

## Key Rotation (Advanced)

If you need to rotate the encryption key:

1. Generate a new encryption key
2. Create a migration script to decrypt existing tokens with old key and re-encrypt with new key
3. Set the new key in Supabase secrets
4. Run the migration
5. Securely delete the old key

**Note:** Token rotation is complex. Contact your security team before proceeding.

## Troubleshooting

**Error: "ENCRYPTION_KEY must be set and at least 32 characters long"**
- The secret is not set in Supabase
- Run: `supabase secrets set ENCRYPTION_KEY="your-key"`

**Error: "Failed to decrypt token"**
- Encryption key was changed after tokens were encrypted
- User needs to reconnect Xero
- Or, use the old key to decrypt and re-encrypt with new key

**Error: "Failed to encrypt token"**
- Encryption key is invalid or too short
- Verify key length: `echo -n "your-key" | wc -c` (should be >= 32)

## Files Modified

The following Edge Functions now use encryption:
- `supabase/functions/xero-oauth/index.ts` - Encrypts tokens on OAuth callback
- `supabase/functions/xero-sync-clients/index.ts` - Decrypts tokens before API calls
- `supabase/functions/xero-sync-invoices/index.ts` - Decrypts tokens before API calls
- `supabase/functions/_shared/encryption.ts` - Encryption utility functions

## Migration for Existing Tokens

If you have existing unencrypted tokens in your database:

1. Set the encryption key first (Step 2 above)
2. Run this SQL to clear existing tokens:
   ```sql
   UPDATE profiles
   SET xero_access_token = NULL,
       xero_refresh_token = NULL,
       xero_sync_enabled = FALSE
   WHERE xero_access_token IS NOT NULL;
   ```
3. Users will need to reconnect their Xero accounts
4. New tokens will be automatically encrypted

## Support

If you encounter issues:
1. Check Edge Function logs: `supabase functions logs xero-oauth`
2. Verify secret is set: `supabase secrets list`
3. Test encryption manually with a small script
4. Contact your development team for assistance
