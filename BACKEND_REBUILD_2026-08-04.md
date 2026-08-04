# Backend Rebuild & Play Store Readiness — 2026-08-04

Status of the TradieMate backend after the original Supabase project was lost,
plus the outstanding items for a Play Store release.

---

## 1. What happened

The Supabase project the app pointed at (`rucuomtojzifrvplhwja`) **no longer exists**.

| Check | Result |
|---|---|
| DNS for `rucuomtojzifrvplhwja.supabase.co` | `NXDOMAIN` — subdomain released |
| HTTPS to that host | no connection |
| `SUPABASE_ACCESS_TOKEN` (`sbp_08470…`) vs Management API | `Unauthorized` — revoked |

A deleted Supabase project releases its subdomain; a *paused* one keeps DNS and
returns an error page. `NXDOMAIN` is the deletion signature.

**Likely cause — neglect, not sabotage.** Last commit 2026-01-09. Supabase free
tier auto-pauses after ~7 days idle (~2026-01-16) and permanently deletes
projects left paused past ~90 days (~April 2026).

**Ownership.** The whole stack was set up under a different account:

- GitHub remote: `github.com/mhmalvi/elevate-mobile-experience`
- All 26 human commits: `hello@muhammadhmalvi.com`
- Scaffolded by Lovable / `gpt-engineer-app[bot]`, 2025-12-27

The dead project was not present in the currently authenticated Supabase account,
confirming it was never accessible to us and could not be restored.

---

## 2. New Supabase project

| | |
|---|---|
| Ref | `ovadozckflqtqyttthwv` |
| Region | `ap-southeast-2` (Sydney) |
| Org | `bgztbelzvfnqbimfhtgm` — Advance-Think-Tank's Org |
| Dashboard | https://supabase.com/dashboard/project/ovadozckflqtqyttthwv |

Sydney was chosen over `ap-south-1` (where the account's other projects live)
because the product is Australian — ABN, GST, BSB — so this means lower latency
and onshore data residency. **Region cannot be changed after creation.**

> ⚠️ **Unresolved:** the project is owned by `adrianakraljev82@gmail.com`, which is
> a different account from the one used in the working session
> (`quadquetech2020@gmail.com`). It was created using a `SUPABASE_ACCESS_TOKEN`
> already present in the shell environment, which silently overrode the
> interactive `npx supabase login`. Confirm this is the intended owner. To use a
> different account, clear the env var first
> (`$env:SUPABASE_ACCESS_TOKEN = $null`) or it will keep winning.

### Credentials

`.env` (gitignored, untracked — never committed) now holds the new
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_ANON_KEY`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and
`SUPABASE_DB_PASSWORD`.

Removed as dead/unsafe:
- `SUPABASE_ACCESS_TOKEN` — revoked token for the deleted project
- `VITE_SUPABASE_SECRET_KEY` — a secret must never carry a `VITE_` prefix (see §7)

> ⚠️ `.mcp.json` **is tracked in git**, and previously contained the
> `sbp_08470…` token — so it is in the repo history. That token is revoked, so
> there is no live exposure, but consider untracking the file before putting a
> new token in it.

---

## 3. Correct app version

The working tree was running a **five-month-stale** checkout, wrong in three ways:

- local `3734f9e` on `feature/production-ready-fixes`, last touched 2026-01-09
- **13 commits behind** its own remote
- parent repo pinned the submodule at `78e6968`, matching neither

Now on **`origin/main` (`284eb1a`, 2026-06-14)**, checked out as local branch
`main-current`. That branch adds MYOB, QuickBooks, staff timesheets, job
assignment, fuzzy client search, rate limiting and invitation RPCs — 55
migrations vs 38, and 182 source files vs 160.

Note: `origin/main` and `origin/master` came back as **forced updates** on fetch —
upstream history was rewritten at some point.

### Preserved work

| Item | Location |
|---|---|
| Uncommitted changes from the old branch | `git stash` — *"pre-main-checkout: local work + claude migration fixes"* |
| `android/` (88 MB, 906 files — Play Store build) | `O:\CYBERPUNK\TradieMate\_preserved_2026-08-04\android\` |
| `e2e/production-test.spec.ts` | `O:\CYBERPUNK\TradieMate\_preserved_2026-08-04\` |

The old branch is untouched at `feature/production-ready-fixes`.

---

## 4. Four defects found and fixed

All four were **pre-existing on `origin/main`**, not introduced by the rebuild.
Together, defects 1–3 meant the migrations could never replay onto a fresh
database.

### 4.1 Missing base schema — `20251227000000_base_schema.sql` (new)

`origin/main` contains **no `CREATE TABLE`** for any of the 9 core tables
(`profiles`, `clients`, `jobs`, `quotes`, `invoices`, `quote_line_items`,
`invoice_line_items`, `quote_templates`, `usage_tracking`). Lovable created the
base schema directly in the cloud project and never wrote it to a migration, so
it died with the project. Every later migration only `ALTER`s these tables.

Reconstructed from `src/integrations/supabase/types.ts` on the *older* branch —
main's copy is a 0-byte file. Includes all 9 tables, 4 enums, foreign keys,
indexes, `updated_at` triggers, RLS enablement and baseline owner-only policies.
Timestamped `20251227000000` so it sorts before everything else.

### 4.2 `deleted_at` ordering bug

`20251228120000` builds an index on `invoices.deleted_at`, but the migration that
*adds* that column (`20251230080000`) is dated two days later. It only ever
worked because the live Lovable schema already had the column. `deleted_at` is
now part of the base schema for `clients`, `jobs`, `quotes`, `invoices`.

### 4.3 `current_date` reserved keyword — `20251228120000` (edited)

```sql
CREATE OR REPLACE FUNCTION calculate_next_due_date(
  current_date date,      -- reserved SQL keyword; fails to parse on PostgreSQL 17
  interval_type text
)
```

Renamed to `from_date`, with results cast back to `date` (since
`date + interval` yields a `timestamp`).

### 4.4 Signup broken — `20260804000000_fix_handle_new_user_insert_order.sql` (new)

**The one that affects real users.** Migration `20260131120000` added a foreign
key `team_members.user_id → profiles(user_id)` so PostgREST could infer the
relationship. But `handle_new_user()` still inserted in the order
`teams → team_members → profiles`, so the membership row referenced a profile
that did not exist yet:

```
23503: insert or update on table "team_members" violates foreign key
constraint "team_members_user_id_fkey_profiles"
```

Surfacing through the API as **"Database error creating new user"**.

Existing users were unaffected — their `profiles` row already existed — which is
why this stayed hidden on an established database and only broke *new* signups.
Latent since 2026-01-31. Order is now `teams → profiles → team_members`.

### 4.5 Also fixed: mistimestamped migration

`20240131_add_leave_team_policy.sql` was committed 2026-02-01 but timestamped
**2024**-01-31 — a two-year typo that sorted it first, creating a policy on
`team_members` before that table existed. Renamed to `20260131140000`.

---

## 5. Verification

Each fix was proven by a test that would fail if the fix were wrong.

| Defect | Verification | Result |
|---|---|---|
| Missing base schema | `tsc --noEmit` over the whole app against types regenerated from the live DB | **0 errors** |
| `20240131` typo | All 57 migrations replayed onto an empty database in filename order | applied in correct position |
| `current_date` | Same full replay on PostgreSQL 17 | parses and applies |
| Signup FK ordering | The exact SQL that previously threw `23503`, re-run | `profiles=1 teams=1 team_members=1` |

The typecheck is the strongest signal: ~180 source files compile against the
regenerated `Database` type, so a single wrong column name, nullability or enum
value would have thrown. It also confirms main's previously-broken TypeScript is
genuinely repaired.

**Each defect class was swept for recurrences — none found:**

- Migration timestamps: all 57 scanned, no other out-of-range years or malformed lengths
- Reserved-word identifiers: all migrations checked against the full SQL keyword list
- Trigger/FK ordering: all 6 trigger functions pulled from the live DB;
  `handle_new_user` is the only multi-table inserter, and it is now correctly ordered

### Database state

- **57 migrations applied** (`local == remote`)
- **20 tables** (was 9) — adds `subcontractors`, `timesheets`, `timesheet_entries`,
  `team_invitations`, `teams`, `team_members`, `rate_limits`, `branding_settings`,
  `integration_sync_log`, `webhook_events`
- 25 quote templates seeded by migration
- `types.ts` regenerated from the live database — 1567 lines
- Login verified end to end through the real UI: `/auth` → `/onboarding`, zero console errors

### Known non-issues

- **`profiles` 401 at login** — does not reproduce; returns `200 OK` with a valid
  session. A race where `useProfile` fires before the session token attaches. The
  code already falls back to cached subscription data and recovers. Cosmetic.
- **`seed.sql` is broken** — inserts `profiles.city`, `primary_color`,
  `secondary_color`, `subscription_status`, none of which exist in any migration.
  Left unseeded, which is correct for a fresh backend anyway.

---

## 6. Edge functions

**All 32 deployed** to the new project, with **13 secrets** set.

CORS preflight verified fixed:

| Check | Before | After |
|---|---|---|
| `OPTIONS /functions/v1/process-voice-command` | no HTTP ok status → blocked | **200**, `Allow-Origin: *`, `Allow-Methods: POST, OPTIONS` |
| `POST` with a real user session | `net::ERR_FAILED` | **200** with valid JSON |

**Secrets set:** `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_WEBHOOK_SECRET_PLATFORM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_PHONE_NUMBER`, `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`,
`XERO_REDIRECT_URI`, `REVENUECAT_WEBHOOK_SECRET`, `ENCRYPTION_KEY`, `APP_URL`.

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are reserved
and injected automatically — they cannot and need not be set.

Stripe is in **test mode** (`sk_test_…`), so nothing deployed touches real money.

---

## 7. Play Store release — decisions and open items

Decision: **Play-Store-only**, Google processes subscription payments.
QuickBooks and email deferred to a later version.

### ✅ `STRIPE_PRICE_ID_*` are NOT needed — confirmed safe to skip

The app has two independent money flows:

| Flow | Who pays whom | Processor |
|---|---|---|
| Subscriptions (Solo/Crew/Pro) | tradie → you | Android: **Google Play**. Web: Stripe |
| Invoice payments | tradie's client → tradie | **Stripe Connect, always** |

`getPaymentProvider()` returns `google_play` on Android, `apple_iap` on iOS,
`stripe` otherwise — so the price IDs are never touched when purchasing on Android.

The only production call to `check-subscription` (the Stripe-only function that
throws without price IDs) sits inside the `?success=true` branch in
`SubscriptionSettings.tsx` — the return leg of a Stripe checkout redirect, which
never fires on Android. **No code change required.**

> **Keep `STRIPE_SECRET_KEY`.** It powers Stripe Connect — how tradies get paid by
> their own customers. Entirely separate from Play billing.

### 🚨 BLOCKER — RevenueCat keys are the wrong type and would ship inside the APK

```
VITE_REVENUECAT_ANDROID_API_KEY="sk_RaPi…"
VITE_REVENUECAT_IOS_API_KEY="sk_IigV…"
VITE_REVENUECAT_WEB_API_KEY="sk_IigV…"    ← byte-identical to iOS
```

1. **Wrong key type.** RevenueCat public SDK keys are prefixed `goog_` (Android)
   and `appl_` (iOS). `sk_` is RevenueCat's **secret** server-side key.
   `NativePurchases.configure({ apiKey })` expects the public SDK key, so Play
   billing likely fails to initialise — meaning **nobody can subscribe**.
2. **`VITE_`-prefixed variables are inlined into the client bundle at build time.**
   A secret key here is extractable from the published Android app.
3. iOS and Web keys being identical is a third smell — they should differ.

Since Play-Store-only makes RevenueCat the *sole* revenue path, this blocks release.

**Action:** get the public SDK keys from RevenueCat → Project Settings → API Keys,
and **rotate** the `sk_` values, which have been sitting in a file.

### ⚠️ QuickBooks — UI is live but non-functional

`IntegrationsSettings.tsx` has a working "Connect QuickBooks" button calling the
deployed `quickbooks-oauth` function. Without Intuit credentials it fails in
front of users and Play reviewers.

Needs from `developer.intuit.com`: `QUICKBOOKS_CLIENT_ID`,
`QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REDIRECT_URI`,
`QUICKBOOKS_ENVIRONMENT` (`sandbox` | `production`).

**Recommended:** hide the button behind a flag until the credentials exist, so a
visibly broken feature is not in the release.

### ⚠️ Email — deferring this breaks the core product loop

Without a verified Resend domain, invoice and quote emails send from
`onboarding@resend.dev`. That shared sandbox sender generally only delivers to
your own verified address, **not to arbitrary customer inboxes** — so tradies'
invoice emails would silently go nowhere. Sending invoices is the product's main
job; shipping with it broken means every user's first real action fails.

It is also the cheapest item here: verify a domain in Resend, add the DNS
records, set one variable.

> **Naming trap.** Despite being called `EMAIL_FROM_DOMAIN`, the code assigns the
> value directly as the whole `From` header:
>
> ```
> EMAIL_FROM_DOMAIN="TradieMate <invoices@tradiemate.com.au>"   ✅
> EMAIL_FROM_DOMAIN="tradiemate.com.au"                          ❌ breaks sending
> ```

### ✅ MYOB — skipping costs nothing

`IntegrationsSettings.tsx` wires up only Xero and QuickBooks. MYOB has edge
functions and database columns but **no UI on this branch**. Nothing to hide.

### Other unset secrets

`MYOB_*` (skipped by decision), `QUICKBOOKS_*` (deferred), `EMAIL_FROM_DOMAIN`
(deferred), `OPENROUTER_API_KEY` — see below.

### Voice commands

`process-voice-command` is deployed and reachable, but `OPENROUTER_API_KEY` is
unset. The function defaults it to `""`, logs an error and continues, so the
OpenRouter call fails auth and the catch returns a generic fallback. The result:
**"I didn't catch that. Could you say it again?"** every time, regardless of
input. Add an OpenRouter key to make voice work.

---

## 8. Reproducing the rebuild

The rebuild is now reproducible from the repo — it was not before.

```bash
npx supabase login                       # or set SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref <ref>
npx supabase db reset --linked --yes     # replays all 57 migrations
npx supabase secrets set --env-file <secrets.env>
npx supabase functions deploy
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

`supabase/config.toml` `project_id` must point at the target project — checking
out a branch restores the old value and re-linking is then required.

`seed.sql` will fail (§5, Known non-issues); the schema is complete regardless.

---

## 9. Outstanding

| Priority | Item |
|---|---|
| 🚨 Blocker | RevenueCat public SDK keys (`goog_`), and rotate the leaked `sk_` keys |
| 🚨 Blocker | Confirm project owner — currently `adrianakraljev82@gmail.com` |
| ⚠️ High | Resend domain + `EMAIL_FROM_DOMAIN`, or invoice email silently fails |
| ⚠️ Medium | Hide the QuickBooks Connect button until credentials exist |
| ⚠️ Medium | Verify the signup fix (§4.4) against any other live database |
| Low | `OPENROUTER_API_KEY` for voice commands |
| Low | Fix or delete the broken `seed.sql` |
| Low | Untrack `.mcp.json` before adding a new token |
| Low | Delete the `demo@tradiemate.com.au` user before production — password is weak and public |

### Uncommitted

The fixes are applied to the database but **not committed**:

```
?? supabase/migrations/20251227000000_base_schema.sql
?? supabase/migrations/20260804000000_fix_handle_new_user_insert_order.sql
 M supabase/migrations/20251228120000_add_recurring_invoice_support.sql
R  supabase/migrations/20240131_add_leave_team_policy.sql
     -> supabase/migrations/20260131140000_add_leave_team_policy.sql
 M src/integrations/supabase/types.ts
 M supabase/config.toml
```

### Test login

`demo@tradiemate.com.au` / `TradieMate2026!` — pre-confirmed, since email
confirmation is on and Supabase's built-in mailer is limited to ~2/hour and only
sends to team members. Delete before production.
