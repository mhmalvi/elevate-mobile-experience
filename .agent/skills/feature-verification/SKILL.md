---
name: feature-verification
description: A systematic process to verify feature implementation in the codebase.
---

# Feature Verification Skill

Use this skill to audit the codebase for specific features requested by the user.

## Process

1.  **Component & Route Discovery**
    *   Identify relevant page files in `src/pages/`.
    *   Identify key components in `src/components/`.
    *   Check `src/App.tsx` for routes.

2.  **Logic & Data Layer Analysis**
    *   Check `src/hooks/` and `src/lib/` for business logic and data access.
    *   Verify Supabase/Database schema usage (often in types or hooks).
    *   Check for external library integrations (PDF, SMS, etc.) in `package.json` or imports.

3.  **Specific Feature Checklist**
    *   For each sub-feature (e.g., "PDF Export"), look for keywords (e.g., `jspdf`, `print`, `pdf`).
    *   For "SMS", look for `navigator.share`, `twilio`, or backend functions.
    *   For "E-signature", look for canvas elements or signature libraries.

4.  **Reporting**
    *   Status: ✅ Implemented, ⚠️ Partial, ❌ Missing.
    *   Evidence: File paths and code snippets found.
    *   Gaps: What is specifically missing functionality-wise.
