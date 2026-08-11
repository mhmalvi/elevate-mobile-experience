#!/usr/bin/env node
/**
 * Client-bundle secret guard.
 *
 * Vite inlines every `VITE_`-prefixed variable into the JS bundle at build time.
 * Anything with that prefix is therefore public: extractable from the published
 * APK/AAB with `unzip` and `strings`, by anyone, forever. It is not a
 * configuration mistake that degrades gracefully — it is key disclosure.
 *
 * This shipped once already. `VITE_REVENUECAT_ANDROID_API_KEY` held an `sk_`
 * RevenueCat *secret* key, which both leaked and silently broke Play billing
 * (the SDK needs the `goog_` public key, so `configure()` failed and nobody
 * could subscribe). Two failures from one wrong prefix.
 *
 * This runs before `vite build` so a leaking bundle is never produced in the
 * first place, rather than being caught by review afterwards.
 *
 * Run: node scripts/check-client-secrets.mjs
 * Exits non-zero on any finding, so it gates the build and CI.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Patterns that must never appear in a VITE_ value.
 *
 * Keyed by the credential family so the error can say what to do about it,
 * rather than just "looks secret".
 */
const SECRET_PATTERNS = [
  {
    test: /^sk_/,
    label: 'RevenueCat / Stripe secret key',
    fix: 'Use the public SDK key instead — goog_ (Android), appl_ (iOS), rcb_ (Web). Rotate the leaked secret.',
  },
  {
    test: /^sk-/,
    label: 'OpenAI-style secret key',
    fix: 'Move this to a server-side edge function secret via `supabase secrets set`.',
  },
  {
    test: /^sk-or-/,
    label: 'OpenRouter API key',
    fix: 'Move this to a server-side edge function secret via `supabase secrets set`.',
  },
  {
    test: /^AIza/,
    label: 'Google API key (Gemini / Maps / Firebase)',
    fix: 'Gemini keys are server-side only — set GEMINI_API_KEY via `supabase secrets set`, never VITE_.',
  },
  {
    test: /^sbp_/,
    label: 'Supabase personal access token',
    fix: 'This is a management-API token. It belongs in your shell or CI, never in a build.',
  },
  {
    test: /^rk_live_|^rk_test_/,
    label: 'Stripe restricted key',
    fix: 'Move this to a server-side edge function secret.',
  },
  {
    test: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    label: 'PEM private key',
    fix: 'Private keys must never reach the client. Remove it from the build entirely.',
  },
];

/**
 * Names that are legitimately public despite reading like credentials.
 *
 * The Supabase anon/publishable keys are designed to ship to clients — they are
 * constrained by row-level security, which is the actual access boundary. They
 * are signed JWTs, so they do not match the prefixes above, but listing them
 * makes the intent explicit rather than accidental.
 */
const KNOWN_PUBLIC = new Set([
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PROJECT_ID',
]);

/** Minimal .env parser: `KEY=value`, optional quotes, `#` comments, no interpolation. */
function parseEnv(text) {
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    out.push({ key, value });
  }
  return out;
}

// Later files win, matching Vite's own precedence.
const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];

const findings = [];
let scanned = 0;

for (const file of ENV_FILES) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;

  for (const { key, value } of parseEnv(readFileSync(path, 'utf8'))) {
    if (!key.startsWith('VITE_')) continue;
    scanned++;
    if (!value || KNOWN_PUBLIC.has(key)) continue;

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test.test(value)) {
        findings.push({ file, key, label: pattern.label, fix: pattern.fix });
        break;
      }
    }
  }
}

if (findings.length > 0) {
  console.error('\n  ✖ Secret detected in a VITE_ variable — build blocked.\n');
  console.error(
    '    VITE_ values are inlined into the JS bundle and are extractable from the\n' +
    '    shipped app. These must move server-side.\n',
  );
  for (const f of findings) {
    console.error(`    ${f.key}`);
    console.error(`      in:    ${f.file}`);
    console.error(`      is a:  ${f.label}`);
    console.error(`      fix:   ${f.fix}\n`);
  }
  console.error(`    ${findings.length} secret(s) found. Rotate anything already published.\n`);
  process.exit(1);
}

console.log(`✓ No secrets in VITE_ variables (${scanned} checked).`);
