---
name: secure-coding
description: Security guidelines and checks. Use when modifying sensitive logic, auth flows, or database policies.
---

# Secure Coding Skill

Ensure code complies with these security standards:

## 1. Supabase Row Level Security (RLS)
- **Check**: Every new table MUST have RLS enabled.
- **Policy**: Define explicit policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
  - *Good*: `auth.uid() = user_id`
  - *Bad*: `true` (Public access)

## 2. Input Validation
- Use **Zod** for schema validation on both client (forms) and server (Edge Functions).
- Sanitize user inputs to prevent injection attacks (though React handles most XSS automatically).

## 3. Authentication & Authorization
- Never hardcode API keys or secrets in client code.
- Use `useAuth` hook to verify user session before rendering protected routes.
- Verify permissions (e.g., `role === 'admin'`) for sensitive actions.

## 4. Local Data Encryption
- Sensitive offline data (PII, financial info) stored in Dexie/localStorage must be encrypted.
- Use `src/lib/offline/encryption.ts` utilities:
  - `encryptData(data)`
  - `decryptData(data)`
