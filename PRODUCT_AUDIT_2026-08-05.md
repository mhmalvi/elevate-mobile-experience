# Product Audit — Design, UX, Internationalisation, Voice, Naming

**Date:** 2026-08-05
**Scope:** Visual design system, UI/UX, global-market readiness, voice features, supporting logic, and rebranding.
**Companion doc:** `BACKEND_REBUILD_2026-08-04.md` (backend/infrastructure state).

---

## ✅ STATUS: 15 of 16 defects fixed (2026-08-05)

Everything in §5's defect table is resolved except the brand/package name, which is
your decision to make. See **§9 Remediation log** at the end of this document for what
changed, how each fix was verified, and what remains open.

**Verified after the work:** 489/489 unit tests pass (was 472/489 — 17 pre-existing
failures also fixed), production build succeeds, 40/40 design-token contrast checks
pass, and a Playwright run against the live app confirms login, currency localisation
and navigation with zero page errors.

**Correction to this document:** §5 originally said the test suites were "genuinely well
tested" and cited `tsc --noEmit` as passing. Both claims were wrong. The root
`tsconfig.json` is a solution-style config (`"files": []` + `references`), so
`tsc --noEmit` against it typechecks **nothing** — the real command is
`tsc -p tsconfig.app.json`, which reported 68 app-source errors. And 17 tests were
failing. The corrected figures are in §9.

> **The single most time-critical item in this document** is the Android `applicationId`
> (`com.tradiemate.app`). It is **permanent once the app is published to Play Store** and
> cannot be changed for the life of the listing. If a rebrand is going to happen, it has to
> happen *before* the first release. See §6.

---

## 1. Visual design system

### 1.1 Primary buttons fail contrast — app-wide

`src/index.css` defines the brand orange and pairs it with white text:

```css
--primary: 33 100% 50%;            /* #FF8C00 */
--primary-foreground: 0 0% 100%;   /* white   */
```

Measured WCAG contrast ratios for the current tokens:

| Pair | Ratio | WCAG AA (4.5 body / 3.0 large+UI) |
|---|---:|---|
| white on `--primary` (**every primary button**) | **2.33:1** | ❌ FAIL |
| **black** on `--primary` (proposed) | **9.02:1** | ✅ PASS |
| white on `--success` | 2.82:1 | ❌ FAIL |
| white on `--destructive` | 3.72:1 | ⚠️ large text only |
| `--primary` as text on light bg | **2.13:1** | ❌ FAIL |
| `--primary` as text on dark bg | 7.10:1 | ✅ PASS |
| `--primary` as text on dark card | 4.25:1 | ⚠️ large text only |
| body text (both themes) | 15.14:1 | ✅ PASS |

Body text is fine. The problem is confined to the **semantic colour tokens**, which is good
news: changing `--primary-foreground` to near-black takes white-on-orange from 2.33:1 to
9.02:1 across the entire app in one line. Same treatment for `--success-foreground`.

This is worth fixing regardless of market. Orange with white text is the classic
low-contrast trap — it looks fine to a designer on a bright monitor and becomes unreadable
in sunlight, which is exactly the operating environment for this app's users.

### 1.2 Three tokens, one colour

```css
--primary: 33 100% 50%;
--accent:  33 100% 50%;   /* identical */
--warning: 33 100% 50%;   /* identical */
```

`primary`, `accent` and `warning` are the same orange. Consequences:

- The `.status-sent` (primary) and `.status-pending` (warning) badges are visually
  identical, so two distinct document states look the same at a glance.
- There is no accent colour, so the palette has effectively **one hue** plus teal.
- A warning cannot be visually distinguished from a normal call to action.

### 1.3 The stated design system does not match the implemented one

`src/index.css:7-11` documents the system as:

```
Design System v3.0 - "Industrial Premium"
Deep Navy + Metallic Gold + Turquoise
```

The implemented values are **orange (#FF8C00) + dark teal (#002420/#004D40)**. There is no
navy and no gold. `.text-premium-gold` is likewise a hardcoded orange gradient, not gold.
Anyone picking this up will design against a palette that doesn't exist.

### 1.4 Four different "dark brand colours"

| Location | Value |
|---|---|
| `index.css` `--background` (dark) | `#002420` (dark teal) |
| `index.html` `theme-color` | `#0f1419` (blue-grey) |
| `capacitor.config.ts` SplashScreen bg | `#1a1a1a` (neutral grey) |
| `capacitor.config.ts` StatusBar bg | `#1a1a1a` (neutral grey) |
| `BottomNav.tsx` FAB ring (dark) | `#121212` (near-black) |

The splash screen also uses `spinnerColor: '#3b82f6'` — **Tailwind blue**, a colour that
appears nowhere in the brand.

The practical effect on Android: the app opens on a grey splash with a blue spinner, then
snaps to a dark teal UI. That is the first three seconds of every session and the first
impression of every new install.

### 1.5 136 hardcoded palette colours bypass the token system

136 occurrences across 20 files use raw Tailwind palette classes (`bg-green-500`,
`text-yellow-600`, `bg-blue-500`, `text-red-500`, …) instead of the semantic tokens.

**Correction worth noting:** most `text-gray-900` / `bg-white` usages are in
`PublicInvoice.tsx`, `PublicQuote.tsx` and the `BrandingSettings.tsx` document preview —
those are deliberately light "paper document" surfaces and are **correct as-is**. The
genuine issue is the status/semantic colours inside the app shell, which:

- won't respond to any future rebrand or white-label theming, and
- drift from the token palette (e.g. `bg-green-500` next to `--success`).

### 1.6 Light mode is reachable but under-tested

`Settings.tsx:132` offers a real light/dark toggle, and `App.tsx:178` sets
`defaultTheme="dark" enableSystem`. But:

- `index.css:164-166` sets `html { color-scheme: dark }` **unconditionally**. In light mode
  the browser still renders native scrollbars, form controls and autofill in dark styling.
- `index.html:2` hardcodes `class="dark"` on `<html>`, which fights `enableSystem` and
  causes a flash for users whose OS is in light mode.
- Orange-on-light-grey text is 2.13:1 (§1.1), so `.text-gradient` and `.text-premium-gold`
  headings are effectively unreadable in light mode.

### 1.7 Visual noise

The body carries a 40px grid pattern (`index.css:181-184`) *underneath* a UI that uses
`backdrop-filter: blur(20px) saturate(180%)` glassmorphism, multi-layer `shadow-premium`,
`shadow-glow`, `animate-pulse-glow`, `animate-float` and `animate-shimmer`. Several of
these run **infinitely** (`pulse-glow` 2.5s, `float` 4s). On mid-range Android hardware,
continuous `backdrop-filter` plus infinite animations is a measurable battery and
jank cost, and it competes with the content for attention.

---

## 2. UI / UX

### 2.1 Bottom navigation is overloaded

`BottomNav.tsx:26-33` defines **six** destinations (Home, Quotes, Jobs, Invoices, Clients,
Settings) plus a centre FAB. Standard guidance for mobile tab bars is 3–5.

The layout is `w-[42%]` for three items on each side of a `max-w-lg` container inset by
`inset-x-4`. On a 360px-wide phone that gives roughly **137px of track for three 48px
targets (144px)** — the items have no room to breathe and collide at the low end of the
device range.

### 2.2 Navigation labels are hidden until selected

```tsx
isActive ? "opacity-100 …" : "opacity-0 -translate-y-2 pointer-events-none"
```

Inactive labels are fully transparent, so the user sees **six unlabelled icons** and can
only read the one they're already on. Two of the six — `FileText` (Quotes) and `Receipt`
(Invoices) — are similar glyphs for the app's two most easily confused concepts.

This is the highest-leverage UX fix in the app: always-visible labels, and fewer tabs.

### 2.3 A drop-shadow that silently does nothing

`BottomNav.tsx:147`:

```tsx
drop-shadow-[0_2px_8px_rgba(var(--primary),0.3)]
```

`--primary` is `33 100% 50%` — space-separated **HSL** components. Interpolated into
`rgba()` this yields `rgba(33 100% 50%, 0.3)`, which is invalid CSS and is dropped by the
browser. The intended glow on the active nav icon has never rendered.

### 2.4 Safe-area inset applied twice

`BottomNav.tsx:36-37` puts `pb-safe-bottom` on the outer wrapper **and** `mb-safe-bottom`
on the inner container. Both resolve to `env(safe-area-inset-bottom, 16px)`, so the
inset is counted twice — roughly 68px of dead space on a gesture-nav iPhone.

### 2.5 Pinch-zoom is disabled

`index.html:5` sets `user-scalable=no`. This blocks pinch-to-zoom, which fails
**WCAG 2.1 SC 1.4.4 (Resize Text)** and is called out in Play Store accessibility
guidance. For an app whose users are frequently outdoors, in gloves, or over 40, this is a
real usability cost as well as a compliance one.

### 2.6 Fonts load from an external CDN in an offline-first app

`index.html:26-28` pulls Montserrat and Open Sans from `fonts.googleapis.com`. The app
markets itself as working offline (`Onboarding.tsx:206` — "Works offline, on any device")
and ships a full Dexie/IndexedDB offline layer. On a cold start with no connectivity the
webfonts fail and the app silently falls back to `system-ui`, changing the entire
typographic identity. Fonts should be bundled into the build.

### 2.7 Offline profile fallback never fires on cold start

`src/hooks/useProfile.tsx:44`:

```tsx
const cached = await getCachedSubscription(user.id);
if (cached && profile) {          // `profile` is still null on first load
```

On a cold offline launch, `profile` is `null`, so the guard fails and the cached
subscription tier is never applied — the user drops to no profile at all rather than to
their cached state. The cache is written correctly; only the read path is gated wrong.

---

## 3. Internationalisation — the largest body of work

The app is not currently a global product. It is an Australian product with a global
ambition, and the Australian assumptions are baked in at every layer: database column
names, validation, tax logic, currency, payment processing, speech recognition, and the
brand name itself.

### 3.1 Currency is hardcoded in two independent places

**Display** — `src/lib/utils.ts:30-33`:

```ts
export function formatCurrency(value: unknown, defaultValue: number = 0): string {
  const num = safeNumber(value, defaultValue);
  return `$${num.toLocaleString('en-AU', { … })}`;
}
```

The `$` is a string literal. A user in the UK, Germany or India sees their revenue,
quotes and invoices denominated in `$`.

**Charging** — `supabase/functions/create-payment/index.ts:113`:

```ts
currency: "aud",
```

Every client-facing invoice payment is charged in **Australian dollars**, regardless of
where the tradesperson or their client is. A UK plumber invoicing £500 would have their
client charged AUD 500 — the wrong amount, in the wrong currency, with an FX conversion
the client didn't agree to.

There is **no currency field anywhere** — not in the profile, not in settings, not in the
schema. This needs a `currency` column on `profiles`, a picker in Business Settings, and
both call sites reading from it.

### 3.2 Tax is hardcoded as Australian GST at 10%

The 10% rate is duplicated across the codebase:

| File | Line |
|---|---|
| `src/pages/InvoiceForm.tsx` | 101 — `const gst = subtotal * 0.1;` |
| `src/pages/QuoteEdit.tsx` | 117 — `const gst = subtotal * 0.1;` |
| `src/pages/QuoteForm.tsx` | (same pattern) |
| `src/pages/InvoiceDetail.tsx` | 404 — label `GST (10%)` |
| `src/pages/QuoteDetail.tsx` | 325 — label `GST (10%)` |
| `src/pages/JobDetail.tsx` | 230 |

The **database column is literally named `gst`**, and it flows through the recurring
invoice generator (`generate-recurring-invoices/index.ts:121`) and the Xero/QuickBooks
integrations.

Correct rates elsewhere: UK VAT 20%, Germany 19%, India GST 5/12/18/28%, US sales tax
varies **by state and county** and is often not applied to services at all. Canada has
GST + PST per province.

This needs `tax_rate` and `tax_label` on the profile, with the schema column renamed
`tax_amount`. Note that "US sales tax" is not a simple rate — for a first global release
it is reasonable to let the user enter their own rate and label rather than trying to
derive it.

### 3.3 An entire page is Australian-tax-specific

`src/pages/BASReport.tsx` (352 lines) generates a **Business Activity Statement** — an
Australian Taxation Office filing with ATO-specific field codes (`GST Collected (1A)`,
`GST Paid (1B)`). It is meaningless in every other market.

It also carries a correctness caveat of its own, at `BASReport.tsx:119-122`:

```ts
// For now, we'll estimate GST paid as 10% of assumed expenses (simplified)
const gstPaid = estimatedExpenses * 0.1;
```

Expenses are **estimated at 30% of sales** rather than derived from real data
(disclosed in the UI at line 353). Shipping a tax-filing summary built on an assumed
expense ratio carries real risk if a user files from it. Recommend gating this page
behind country == AU and strengthening the disclaimer.

### 3.4 Validation rejects most of the world

`src/lib/validation.ts` is Australia-only by construction:

| Function | Behaviour |
|---|---|
| `validateAustralianPhone` | Requires exactly 10 digits starting `0`; area code must be one of `02/03/04/07/08`. Rejects every non-AU number. |
| `validatePostcode` | Requires exactly 4 digits, range 0200–9999. Rejects UK `SW1A 1AA`, US `90210-1234`, Canada `M5V 3L9`, India 6-digit. |
| `validateBSB` | AU bank routing format. No IBAN, no sort code, no US routing number. |
| `validateBankAccountNumber` | 4–10 digits — "Australian accounts" per the comment. |
| `validateABN` | 11 digits + AU checksum algorithm. |

Note the earlier console log from the running app showed a phone number of
`+8801710895523` (Bangladesh) being saved — this validator would reject it outright.

### 3.5 Onboarding assumes Australia and never asks for country

`src/pages/Onboarding.tsx` — step 3 asks for:

- `ABN (optional)` with placeholder `e.g. 12 345 678 901`
- `Mobile Number` with placeholder `e.g. 0412 345 678`

There is **no country selector at all**, in onboarding or in settings. Country is the
input from which currency, tax rate, tax label, phone format, postcode format, date format
and business-number label should all derive. Without it, nothing downstream can localise.

### 3.6 Date formats are inconsistent even within the app

| Style | Count | Convention |
|---|---:|---|
| `dd MMM yyyy`, `d MMM yyyy`, `EEE, d MMM` | 11 | day-first (AU/UK/EU) |
| `MMM dd, yyyy`, `MMM d, yyyy`, `MMM d, h:mm a` | 3 | month-first (US) |

Separately, bare `.toLocaleString()` (no locale) is used in `Dashboard.tsx` ×4,
`ClientDetail.tsx` ×2 and `JobDetail.tsx` — which follows the *browser* locale, while
`formatCurrency` forces `en-AU`. So number grouping is inconsistent between two figures
displayed on the same screen.

### 3.7 Other hardcoded assumptions

- `supabase/functions/quickbooks-sync-clients/index.ts:192` — `Country: "Australia"`
  written into every synced QuickBooks client record.
- `create-subscription-checkout/index.ts:105` and `customer-portal/index.ts:65` — fallback
  origin `https://tradiemate.app`.
- `src/lib/subscriptionTiers.ts` — tier pricing (needs review for per-market pricing).

---

## 4. Voice features

Voice is the app's headline differentiator — it owns the centre FAB of the bottom nav.
It has the most serious problems in the codebase.

### 4.1 🚨 Voice will not work in the Play Store build

Both voice components depend on the Web Speech API:

```tsx
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  toast({ title: "Voice not supported", description: "Use Chrome or Safari…" });
  return;
}
```

`package.json` contains **no Capacitor speech-recognition plugin** — the only Capacitor
packages are `android`, `cli`, `core`, `ios` and `preferences`.

`SpeechRecognition` is a Chrome-*browser* feature. It is **not implemented in the Android
System WebView**, which is what Capacitor runs. So on the actual Play Store app, tapping
the centre microphone — the most prominent control in the UI — produces
*"Voice not supported. Use Chrome or Safari."*

This needs a native plugin (e.g. `@capacitor-community/speech-recognition`) with the web
path kept as a fallback. **I'd treat this as a release blocker**, since the feature is the
product's main hook and its failure mode is the most visible button in the app.

### 4.2 Speech recognition and synthesis are locked to Australian English

| Location | Value |
|---|---|
| `VoiceCommandSheet.tsx:134` | `recognition.lang = 'en-AU'` |
| `MagicMic.tsx:60` | `recognition.lang = 'en-AU'` |
| `MagicMic.tsx:191` | `utterance.lang = 'en-AU'` |
| `VoiceCommandSheet.tsx:25` | voice priority `['Karen','Catherine','Tessa','Moira','Samantha','Victoria']` |

The voice priority list is macOS/iOS-specific female voice names (Karen is the Australian
voice, Moira Irish, Tessa South African). On Android none exist, so it falls through to
`en-AU` → `en-GB` female → any English.

For a global launch, recognition accuracy against a US, Indian, Scottish or Nigerian
accent under an `en-AU` model will be noticeably degraded, and non-English speakers get no
path at all. This should follow the user's device locale.

### 4.3 `MagicMic.tsx` is 513 lines of dead code

`MagicMic` is exported but **never imported anywhere**. The live component is
`VoiceCommandSheet`, wired through `BottomNav.tsx:53`. `MagicMic` is a near-duplicate
carrying its own copies of the quote/invoice/client/job creation logic — so any fix
applied to the real path silently misses it, and any reader has a 50% chance of editing
the wrong file. Recommend deleting it.

### 4.4 `mark_paid` can mark multiple invoices paid at once

`VoiceCommandSheet.tsx:404-409`:

```tsx
const query = supabase.from('invoices').update({ status: 'paid' }).eq('user_id', …);
if (data.invoice_id) {
  await query.eq('id', data.invoice_id);
} else {
  await query.ilike('invoice_number', `%${data.invoice_number}%`);
}
```

The fallback path is an unbounded `ilike` with wildcards on both sides and **no `.limit(1)`**.
Saying *"mark invoice 12 as paid"* matches `INV-012`, `INV-120`, `INV-1234` and
`INV-3120` — and marks **all of them** paid in one statement.

This is the worst defect I found: it is silent, it is triggered by a plausible voice
command, and it corrupts financial records. It also doesn't set `amount_paid` or a payment
date, so the marked invoices are internally inconsistent.

Fix: resolve to candidate invoices first, require a single match, and confirm back to the
user by name and amount before writing.

### 4.5 Voice-created quotes skip tax entirely

`MagicMic.tsx:347-360` (dead path) and the equivalent live path insert `total` but never
`subtotal` or `gst`. A quote created by voice has no tax breakdown, while the same quote
created through the form does. Downstream — PDF generation, the BAS report, Xero sync —
all read those fields.

### 4.6 "Note Added!" is not true

`MagicMic.tsx:258-269` toasts *"📝 Note Added!"* and writes to `localStorage` under
`pendingJobNotes`. Nothing ever reads that key. The code says so itself:

```tsx
// Note: In a real implementation, we would save this to the current job
```

Dead path in dead code, but the AI system prompt still advertises the capability
(`process-voice-command/index.ts:250-254`), so the assistant will happily tell users their
note was recorded.

### 4.7 Auth token read directly from storage

Both components read the Supabase session by reconstructing the storage key and going
straight to `sessionStorage` / `localStorage`, with a comment about avoiding "cross-origin
frame issues" — a Lovable-preview workaround.

`src/lib/secureStorage.ts` deliberately routes native platforms to **Capacitor
Preferences** (Keychain / EncryptedSharedPreferences), *not* web storage. So on Android and
iOS these lookups find nothing.

`VoiceCommandSheet` survives this because it falls back to `supabase.auth.getSession()`
(lines 241-246). `MagicMic` has no fallback and would fail outright on native. Since the
working fallback exists, the right fix is to delete the storage-poking entirely and just
call `getSession()`.

### 4.8 `no-speech` leaves the UI stuck

`MagicMic.tsx:87-99` ignores `no-speech` and `aborted` errors — but `no-speech` fires when
recognition has already ended. Status stays `listening`, so the button still shows green
"Tap to Send" while nothing is being captured. Tapping yields *"No voice input"*. This
matches the `Speech error: no-speech` seen in your earlier console log.

---

## 5. Logic and functions

You asked me to check these on the assumption they're fine. Mostly they are — the
calculation helpers, validation structure, tier limits, offline sync queue and query hooks
are well organised and genuinely well tested (`src/lib/__tests__`, `src/hooks/queries`,
`src/lib/offline/__tests__` — substantial suites, including a 558-line sync-queue
integrity test). `tsc --noEmit` passes clean across ~180 files.

The defects that do exist are listed above where they sit in context. Ranked by severity:

| # | Defect | Severity | Location |
|---|---|---|---|
| 1 | `mark_paid` bulk-updates via unbounded `ilike` | 🚨 Data corruption | `VoiceCommandSheet.tsx:408` |
| 2 | Voice unavailable in Capacitor WebView | 🚨 Feature dead in prod | `package.json` / both voice components |
| 3 | Payments always charge AUD | 🚨 Wrong money | `create-payment/index.ts:113` |
| 4 | Currency symbol hardcoded `$` | High | `lib/utils.ts:32` |
| 5 | GST 10% hardcoded in 6+ places | High | see §3.2 |
| 6 | Non-AU phone/postcode/bank rejected | High | `lib/validation.ts` |
| 7 | White-on-orange 2.33:1 contrast | High | `index.css` |
| 8 | Offline profile fallback never fires | Medium | `useProfile.tsx:44` |
| 9 | Nav labels invisible when inactive | Medium | `BottomNav.tsx:160-166` |
| 10 | Safe-area inset double-counted | Medium | `BottomNav.tsx:36-37` |
| 11 | `user-scalable=no` blocks zoom | Medium (WCAG) | `index.html:5` |
| 12 | Fonts from CDN in offline-first app | Medium | `index.html:28` |
| 13 | `rgba(var(--primary))` invalid CSS | Low | `BottomNav.tsx:147` |
| 14 | `color-scheme: dark` unconditional | Low | `index.css:164` |
| 15 | 513 lines of dead `MagicMic` code | Low (maintenance) | `src/components/MagicMic.tsx` |
| 16 | BAS expenses estimated at 30% | Low (AU only) | `BASReport.tsx:119` |

---

## 6. Rebranding and naming

### 6.1 Why "TradieMate" blocks a global launch

**"Tradie"** is Australian and New Zealand slang. It is not used in the US, UK, Canada,
Ireland, India or anywhere else. The equivalent terms are *contractor* or *tradesman* (US),
*tradesperson* (UK). To a US contractor searching the Play Store, "tradie" is not a word —
it is not merely unfamiliar branding, it is invisible to search.

**"Mate"** is Australian/British and reads as distinctly foreign in North America, the
largest app-store market.

So the name is doubly locked to a market that, per your decision, is no longer the target.
It also sets the wrong expectation before install: a US user who does recognise the word
will assume the app handles AUD and Australian tax — which, today, it does.

### 6.2 ⏰ The package name is permanent — decide before you publish

```ts
// capacitor.config.ts
appId: 'com.tradiemate.app',
appName: 'TradieMate',
```

The Android `applicationId` **cannot be changed after the first Play Store release**. It is
the permanent identity of the listing. Changing it later means publishing a *new app*, with
zero installs, zero reviews and zero ranking, and manually migrating every existing user.

The display name and icon can be changed freely at any time. The package name cannot.

**This is why the rebrand decision has to come before the release, not after it.** If
there's any chance you'll rename, pick the package name now — even a neutral one you're
merely comfortable with beats a permanent commitment to a name you already want to
replace.

If you'd rather not decide the *brand* under time pressure, a reasonable move is to set a
neutral, brand-agnostic package name now (something you'd never need to change) and let
the marketing name evolve independently above it.

### 6.3 Name directions

Rather than a list of inventions, here are the directions that actually fit the product,
since the name has to work in Phoenix and Manchester as well as Perth:

- **Trade-neutral + job-centric** — leans on what the app does (quote → job → invoice →
  paid) rather than who uses it. Travels well, easy to spell, no slang. Weakness: crowded
  category, harder to make distinctive.
- **Voice/speed-led** — leans on the genuine differentiator (speak it, it's done). Fits
  the mic-first UI and the "60 seconds" promise already in onboarding. Strongest angle
  *if* §4.1 is fixed and voice actually works on device.
- **Invented/short mark** — maximum trademark and domain availability, no linguistic
  baggage in any market, but requires marketing spend to attach meaning.

Whatever the shortlist, check before committing: `.com` availability, Play Store and App
Store name collisions, and trademark in your primary launch markets (a name that's clear in
AU can be taken in the US/EU). I can run those checks if you want.

### 6.4 Internal naming that should change with it

Independent of the customer-facing brand, several internal names encode AU-specific
concepts and will confuse every future contributor:

| Current | Suggested | Why |
|---|---|---|
| `gst` (DB column, ~15 refs) | `tax_amount` | GST is one country's name for it |
| `abn` (DB column, profile field) | `business_number` / `tax_id` | ABN is AU-only |
| `BASReport.tsx` | `TaxReport.tsx` (AU-gated) | BAS is an ATO filing |
| `validateAustralianPhone` | `validatePhone(country)` | — |
| `validateBSB` | `validateBankRouting(country)` | BSB is AU-only |
| `tradiemate.app` fallback origins | brand-neutral env var | hardcoded in 2 functions |
| `com.tradiemate.app` | see §6.2 | **permanent after release** |

Renaming DB columns requires a migration and a regeneration of
`src/integrations/supabase/types.ts` — mechanical, but it touches the Xero and QuickBooks
sync functions, so it wants doing in one pass rather than incrementally.

---

## 7. Suggested sequencing

Grouped by what unblocks what, rather than by area.

**Before any Play Store release (irreversible or user-facing-breaking):**

1. Decide the package name — §6.2. Permanent after publish.
2. Fix `mark_paid` bulk update — §4.4. Corrupts financial data.
3. Native speech-recognition plugin, or hide the voice FAB — §4.1. The main button
   in the app currently fails on device.
4. RevenueCat public key + rotate the exposed `sk_` keys — carried over from
   `BACKEND_REBUILD_2026-08-04.md`.

**Global-market foundation (each depends on the one above it):**

5. Add `country` to onboarding and profile — §3.5. Nothing else can localise without it.
6. Add `currency`, `tax_rate`, `tax_label` derived from country — §3.1, §3.2.
7. Rewrite `formatCurrency` and `create-payment` to read them — §3.1.
8. Replace the hardcoded 10% GST at all 6 sites — §3.2.
9. Make validation country-aware — §3.4.
10. Gate `BASReport` behind country == AU — §3.3.

**Design and UX (independent, ship any time):**

11. `--primary-foreground` → near-black; same for success — §1.1. One line, app-wide.
12. Split `primary` / `accent` / `warning` into distinct colours — §1.2.
13. Reduce bottom nav to 4–5 items with permanent labels — §2.1, §2.2.
14. Unify the four dark brand colours and the splash spinner — §1.4.
15. Remove `user-scalable=no`; bundle fonts locally — §2.5, §2.6.
16. Fix safe-area double-inset, invalid `rgba()`, `color-scheme` — §2.4, §2.3, §1.6.
17. Fix the `useProfile` offline fallback — §2.7.
18. Delete `MagicMic.tsx` — §4.3.

**Naming (after §6.2 is settled):**

19. Rename `gst` → `tax_amount`, `abn` → `business_number` in one migration — §6.4.
20. Brand-neutral env var for the fallback origins — §6.4.

---

## 8. What I did not check

Being explicit about the edges of this audit:

- **No device testing.** The Capacitor WebView speech finding (§4.1) is from dependency
  analysis and platform behaviour, not from running the APK. It should be confirmed on a
  real device before you act on it — it's the kind of thing worth ten minutes of proof.
- **No visual regression pass.** Contrast numbers are computed from the tokens; I did not
  screenshot every screen in both themes.
- **Xero / QuickBooks sync logic** reviewed only for hardcoded locale values, not for
  correctness of the sync itself.
- **Subscription tier pricing** not reviewed for per-market appropriateness.
- **The 32 edge functions** were reviewed by grep for locale assumptions, not read in full.

---

## 9. Remediation log — 2026-08-05

### 9.1 Defects fixed

| # | Defect | Fix | Verified by |
|---|---|---|---|
| 1 | `mark_paid` bulk-updated invoices via unbounded `ilike` | Resolves to exactly one invoice before writing; refuses to guess when ambiguous; sets `amount_paid`/`paid_at`; confirms by number and amount | Code path rewritten; sibling actions swept |
| 2 | Voice dead in Capacitor WebView | `@capacitor-community/speech-recognition` + `src/lib/speech.ts` abstraction with web fallback; `RECORD_AUDIO` + Android 11 `<queries>`; iOS usage descriptions | Build + typecheck; needs on-device confirmation |
| 3 | Payments always charged AUD | `create-payment` reads `profiles.currency_code`; zero-decimal currency handling added | Deployed; code reviewed |
| 4 | Currency symbol hardcoded `$` | `src/lib/money.ts` with `Intl`; **39 hardcoded `$` sites swept** across 12 files | Live browser test: UK profile renders `£0` |
| 5 | GST 10% hardcoded in 6+ places | `calculateTax()` reads profile rate + inclusive/exclusive convention | Forms/detail/PDF all updated |
| 6 | Non-AU phone/postcode/bank rejected | `validatePhone/validatePostcode/validateBankRouting/validateBusinessNumber` take a country | 74/74 validation tests pass |
| 7 | White-on-orange 2.33:1 contrast | Per-theme token tuning; `--primary-foreground` → ink (7.55:1) | `npm run check:contrast` → 40/40 |
| 8 | Offline profile fallback never fired | Functional `setProfile` update, dropped the `&& profile` guard | Code reviewed |
| 9 | Nav labels invisible when inactive | Labels always visible; FAB floated above the bar | Live test: all 6 labels at 360px, no overflow |
| 10 | Safe-area inset double-counted | Applied once on the wrapper | Code reviewed |
| 11 | `user-scalable=no` blocked zoom | Removed | `index.html` |
| 12 | Fonts from CDN in offline-first app | `@fontsource` self-hosted | 42 `.woff2` in `dist/`, zero CDN refs |
| 13 | `rgba(var(--primary))` invalid CSS | Removed in the nav rewrite | Code reviewed |
| 14 | `color-scheme: dark` unconditional | Follows `html.dark` | Live test: light mode → `colorScheme: light` |
| 15 | 513 lines of dead `MagicMic` | Deleted | File removed |
| 16 | BAS expenses estimated at 30% | Gated to AU (menu + route guard); disclaimer rewritten as a warning | Live test: UK profile → "Not available in your region" |
| — | **Brand / package name** | **NOT DONE — your decision.** See §6.2 | — |

### 9.2 Additional defects found and fixed during the work

Not in the original audit; surfaced while fixing the above.

- **`text-secondary` unreadable in dark mode (1.54:1).** The Dashboard "Pro Tip" heading
  and `IconContainer`'s secondary variant used a *surface* token as text. Caught by the
  new contrast checker, not by eye.
- **`BusinessSettings` trade list had drifted from the DB enum** in both directions: it
  offered `cleaner` (not a valid `trade_type`, so saving failed) and omitted `roofer`
  (which onboarding offers, so a roofer saw their trade blank). Now derived from the
  generated `Constants`.
- **`complete_job` silently dropped its client filter** when no client matched, so
  "complete Tom's job" with no Tom completed the most recent job for *anyone*.
- **`process-voice-command` didn't fail on a missing `OPENROUTER_API_KEY`** — it fell
  through to a call with an empty bearer token. Now returns 503 with a clear message.
- **`add_job_note` was advertised but not implemented.** The AI prompt told users
  "Noted! That's on the record." and nothing was saved. Removed from the prompt.
- **17 failing unit tests** (`useClients/useQuotes/useJobs/useInvoices`): the hooks gained
  team scoping, which both introduced an unmocked `useTeam` and moved `.eq()` after
  `.range()`. The mocks resolved on `.range()`, so the hook then called `.eq()` on a
  Promise and the queryFn rejected. Fixed with `src/__tests__/mocks/supabaseChain.ts`.
- **PDF documents hardcoded `$`, `en-AU` and "ABN"/"GST (10%)"** — these are the documents
  clients actually receive. Now follow the issuing business.
- **`tax_inclusive_pricing` default was wrong.** The first i18n migration defaulted it to
  `true` on market convention, but the app has always added tax *on top*. Left as-is it
  would have reinterpreted every existing invoice ($1,000 → $909.09 + $90.91 instead of
  $1,000 + $100). Corrected in `20260805010000`.
- **FAB overlapped page content** by ~28px after the nav rewrite; `MobileLayout` bottom
  padding raised from 128px to 176px.

### 9.3 Database changes

Two migrations, both applied to `ovadozckflqtqyttthwv`:

- `20260805000000_internationalisation.sql` — adds `country_code`, `currency_code`,
  `tax_rate`, `tax_label`, `tax_inclusive_pricing`, `locale` to `profiles` with check
  constraints; renames `invoices.gst`/`quotes.gst` → `tax_amount`, `profiles.abn` and
  `subcontractors.abn` → `business_number`, `profiles.gst_registered` → `tax_registered`;
  rebuilds the `active_recurring_invoices` view.
- `20260805010000_fix_tax_inclusive_default.sql` — corrects the default described above.

Defaults are deliberately Australian so no existing account changes behaviour.

Six edge functions redeployed to match the renamed columns: `generate-pdf`,
`generate-recurring-invoices`, `create-payment`, `process-voice-command`,
`quickbooks-sync-clients`, `myob-sync-clients`.

### 9.4 New files

| File | Purpose |
|---|---|
| `src/lib/countries.ts` | Country reference data — currency, tax, labels, formats |
| `src/lib/money.ts` | Locale-aware currency, tax and date formatting |
| `src/lib/speech.ts` | Native/web speech abstraction |
| `src/__tests__/mocks/supabaseChain.ts` | Chainable Supabase query-builder mock |
| `scripts/check-contrast.mjs` | Enforces the accessibility contract in `index.css` (`npm run check:contrast`) |

### 9.5 Verification

| Check | Before | After |
|---|---|---|
| Unit tests | 472/489 (17 failing) | **489/489** |
| Design-token contrast | 5 pairs failing AA | **40/40 pass** |
| App-source type errors (`tsc -p tsconfig.app.json`) | 68 | **54** |
| Production build | passes | passes |
| Bundled fonts | 0 (CDN) | **42 `.woff2`** |
| Live smoke test | — | login, `£0` for UK profile, 6 nav labels, 0 page errors |

The remaining 54 type errors are all pre-existing and almost entirely `TS6133`
(unused imports/variables) plus some enum-widening in the offline sync layer. None are
in code changed here, and none block the build. Worth a separate cleanup pass —
`noUnusedLocals` is on but the codebase has never been clean against it.

### 9.6 Still open

| Priority | Item | Why it needs you |
|---|---|---|
| 🚨 | **Package name `com.tradiemate.app`** | Permanent after first Play Store publish. Decide before release — §6.2 |
| 🚨 | RevenueCat `goog_` public key + rotate exposed `sk_` keys | Needs dashboard access |
| 🚨 | Confirm Supabase project owner (`adrianakraljev82@gmail.com`) | Account ownership |
| ⚠️ | Verify voice on a real Android device | Fix is dependency-level; needs hardware to confirm |
| ⚠️ | Resend domain + `EMAIL_FROM_DOMAIN` | You deferred; breaks invoice delivery |
| ⚠️ | Delete demo user `demo@tradiemate.com.au` before production | Publicly-known password |
| ○ | `OPENROUTER_API_KEY` for voice | Now fails loudly instead of silently |
| ○ | Broken `seed.sql` (references columns that don't exist) | Low impact |
| ○ | Untrack `.mcp.json` and `supabase/.temp/` | Secrets + machine state in git |
| ○ | Clean up 54 pre-existing type errors | Mostly unused imports |
