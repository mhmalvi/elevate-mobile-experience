#!/usr/bin/env node
/**
 * Billing configuration: Google Play subscriptions + RevenueCat offering.
 *
 * Brings three layers into agreement. They currently disagree, which is why
 * every purchase attempt returns "Product not found":
 *
 *   src/lib/purchases.ts  expects solo/crew/pro x monthly/annual
 *   RevenueCat            had 3 orphaned products (TradieMate_Solo/Crew/Pro)
 *                         pointing at store IDs that do not exist in Play
 *   Play Console          had zero subscriptions
 *
 * Play is the source of truth: products are created there first, then mirrored
 * into RevenueCat and bound to an offering and entitlement.
 *
 * ⚠️  Play subscription product IDs are PERMANENT. They can be deactivated but
 *     never deleted or reused. This script is idempotent — it skips anything
 *     that already exists — but a typo in PRODUCTS burns that ID for the life
 *     of the app.
 *
 * Usage:
 *   node scripts/setup-billing.mjs --dry-run    # print planned calls, change nothing
 *   node scripts/setup-billing.mjs --commit     # apply
 */

import { execFileSync } from 'node:child_process';

const PACKAGE_NAME = 'com.tradiemate.app';
const PLAY_SERVICE_ACCOUNT = 'tradiemate@tradiemate-488213.iam.gserviceaccount.com';

// The app's default Play listing language. Play rejects any subscription that
// lacks a listing in this exact language — it is en-GB here, not en-AU.
const DEFAULT_LANGUAGE = 'en-GB';

const RC_PROJECT_ID = 'proj17fd6a1c';
const RC_APP_ID = 'app361e589fdf'; // "TradieMate", play_store
const RC_API = 'https://api.revenuecat.com/v2';
const RC_KEY = process.env.RC_SECRET_KEY;

const PLAY_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

// AUD is the seed price; usd/eur are the anchors Play converts every other
// market from, so the app sells worldwide rather than in Australia only.
const PRODUCTS = [
  { id: 'solo_monthly', tier: 'Solo', plan: 'monthly', period: 'P1M', price: '29',  usd: '19',  eur: '18',  desc: 'For solo tradies. Unlimited quotes, invoices and jobs.' },
  { id: 'solo_annual',  tier: 'Solo', plan: 'annual',  period: 'P1Y', price: '288', usd: '190', eur: '179', desc: 'For solo tradies. Unlimited quotes, invoices and jobs. Billed yearly.' },
  { id: 'crew_monthly', tier: 'Crew', plan: 'monthly', period: 'P1M', price: '49',  usd: '39',  eur: '36',  desc: 'For small crews. Team access, scheduling and timesheets.' },
  { id: 'crew_annual',  tier: 'Crew', plan: 'annual',  period: 'P1Y', price: '468', usd: '390', eur: '365', desc: 'For small crews. Team access, scheduling and timesheets. Billed yearly.' },
  { id: 'pro_monthly',  tier: 'Pro',  plan: 'monthly', period: 'P1M', price: '79',  usd: '59',  eur: '55',  desc: 'Everything in Crew, plus accounting sync and priority support.' },
  { id: 'pro_annual',   tier: 'Pro',  plan: 'annual',  period: 'P1Y', price: '780', usd: '590', eur: '549', desc: 'Everything in Crew, plus accounting sync and priority support. Billed yearly.' },
];

/**
 * Regions where the trial runs.
 *
 * An offer can only target regions its parent base plan lists EXPLICITLY —
 * regions covered implicitly by otherRegionsConfig are not inheritable. So the
 * base plan gets explicit configs for these, and the offer mirrors them.
 * Subscriptions still sell everywhere via the USD/EUR anchors; only the free
 * trial is limited to this list.
 *
 * ⚠ Play quirk: setting otherRegionsConfig makes Play auto-materialise MN
 *   (Mongolia) as an explicit region with an MNT price, because MNT cannot be
 *   derived from the anchors. It then REJECTS MN on every subsequent write
 *   ("not billable at regions version …") at both 2022/02 and 2025/01, and
 *   rejects offers targeting it outright. Strip MN from any base-plan payload
 *   before patching — Play re-adds it server-side — and never include it in an
 *   offer. This is an inconsistency in Play's API, not a config error.
 */
const TRIAL_REGIONS = ['AU', 'US', 'GB', 'CA', 'NZ', 'IE'];

const ENTITLEMENT = { lookup_key: 'premium', display_name: 'Premium Access' };
const OFFERING = { lookup_key: 'default', display_name: 'Default Offering' };

/**
 * 14-day free trial, monthly plans only.
 *
 * 14 rather than 7 because this product's payoff is getting *paid*, not
 * creating an invoice. Default payment terms are 14 days, so a 7-day trial
 * expires before the user ever sees an invoice settle — they would never
 * experience the thing they are being asked to buy.
 *
 * Annual plans deliberately get no trial: those buyers are already converted,
 * so a trial only delays revenue and widens the refund window.
 *
 * Scope is anySubscriptionInApp, not thisSubscription — otherwise someone who
 * had already subscribed to Crew could claim a fresh free trial by starting on
 * Solo. (Play rejects any other scope value outright.)
 */
const TRIAL_OFFER_ID = 'free-trial-14d';
const TRIAL_DURATION = 'P14D';

const COMMIT = process.argv.includes('--commit');
const DRY = !COMMIT;

function log(...a) { console.log(...a); }
function step(s) { console.log(`\n── ${s}`); }

/** Play access token, via the gcloud service account already credentialed locally. */
function playToken() {
  return execFileSync(
    'gcloud',
    ['auth', 'print-access-token', `--account=${PLAY_SERVICE_ACCOUNT}`,
     '--scopes=https://www.googleapis.com/auth/androidpublisher'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  ).trim();
}

async function api(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

// ── Google Play ────────────────────────────────────────────────────────────

function subscriptionBody(p) {
  return {
    packageName: PACKAGE_NAME,
    productId: p.id,
    listings: [{
      languageCode: DEFAULT_LANGUAGE,
      title: `${p.tier} ${p.plan === 'annual' ? 'Annual' : 'Monthly'}`,
      description: p.desc,
    }],
    basePlans: [{
      basePlanId: p.plan,
      autoRenewingBasePlanType: {
        billingPeriodDuration: p.period,
        gracePeriodDuration: 'P7D',
        accountHoldDuration: 'P30D',
        resubscribeState: 'RESUBSCRIBE_STATE_ACTIVE',
      },
      regionalConfigs: [{
        regionCode: 'AU',
        newSubscriberAvailability: true,
        price: { currencyCode: 'AUD', units: p.price, nanos: 0 },
      }],
      // Without this the plan is purchasable in Australia and nowhere else —
      // users elsewhere reach the paywall and find no products at all, with no
      // error to explain it.
      otherRegionsConfig: {
        usdPrice: { currencyCode: 'USD', units: p.usd, nanos: 0 },
        eurPrice: { currencyCode: 'EUR', units: p.eur, nanos: 0 },
        newSubscriberAvailability: true,
      },
    }],
  };
}

async function setupPlay(token) {
  step('Google Play — subscriptions');
  const auth = { Authorization: `Bearer ${token}` };

  const existing = await api(`${PLAY_API}/applications/${PACKAGE_NAME}/subscriptions`, { headers: auth });
  const have = new Set((existing.json?.subscriptions || []).map((s) => s.productId));
  log(`  existing: ${have.size ? [...have].join(', ') : 'none'}`);

  const created = [];
  for (const p of PRODUCTS) {
    if (have.has(p.id)) { log(`  = ${p.id} already exists, skipping`); created.push(p.id); continue; }
    if (DRY) { log(`  + would create ${p.id} (${p.period}, AUD ${p.price})`); continue; }

    const url = `${PLAY_API}/applications/${PACKAGE_NAME}/subscriptions`
      + `?productId=${encodeURIComponent(p.id)}&regionsVersion.version=2022%2F02`;
    const r = await api(url, { method: 'POST', headers: auth, body: subscriptionBody(p) });
    if (r.ok) { log(`  + created ${p.id} (${p.period}, AUD ${p.price})`); created.push(p.id); }
    else { log(`  ! FAILED ${p.id}: ${r.status} ${r.json?.error?.message || r.text.slice(0, 160)}`); }
  }

  // Play creates base plans in DRAFT. A draft base plan is not purchasable and,
  // more confusingly, the whole RevenueCat offering stays invisible to clients
  // until it is activated — with no error anywhere to explain why.
  for (const p of PRODUCTS) {
    if (!created.includes(p.id)) continue;
    if (DRY) { log(`  ~ would activate ${p.id}/${p.plan}`); continue; }
    const r = await api(
      `${PLAY_API}/applications/${PACKAGE_NAME}/subscriptions/${p.id}/basePlans/${p.plan}:activate`,
      { method: 'POST', headers: auth, body: {} },
    );
    if (!r.ok && r.status !== 400) log(`  ! activate ${p.id}: ${r.status} ${r.json?.error?.message?.slice(0, 100)}`);
  }

  await setupTrials(auth, created);
  return created;
}

/** 14-day free trial on the monthly plans. See TRIAL_OFFER_ID above for the reasoning. */
async function setupTrials(auth, created) {
  step('Google Play — free trials (monthly only)');

  for (const p of PRODUCTS.filter((x) => x.plan === 'monthly')) {
    if (!created.includes(p.id)) { log(`  - skip ${p.id} (not in Play)`); continue; }
    const offersUrl =
      `${PLAY_API}/applications/${PACKAGE_NAME}/subscriptions/${p.id}/basePlans/${p.plan}/offers`;

    // 204 means no offers at all; anything else, check for ours.
    const existing = await api(offersUrl, { headers: auth });
    const have = (existing.json?.subscriptionOffers || []).some((o) => o.offerId === TRIAL_OFFER_ID);
    if (have) { log(`  = ${p.id} already has ${TRIAL_OFFER_ID}`); continue; }
    if (DRY) { log(`  + would add ${TRIAL_DURATION} trial to ${p.id}`); continue; }

    // Mirror TRIAL_REGIONS, which the base plan must already list explicitly.
    // MN is excluded deliberately — see the note on TRIAL_REGIONS.
    const regions = TRIAL_REGIONS.filter((r) => r !== 'MN');
    const body = {
      packageName: PACKAGE_NAME,
      productId: p.id,
      basePlanId: p.plan,
      offerId: TRIAL_OFFER_ID,
      phases: [{
        duration: TRIAL_DURATION,
        recurrenceCount: 1,
        regionalConfigs: regions.map((regionCode) => ({ regionCode, free: {} })),
      }],
      targeting: { acquisitionRule: { scope: { anySubscriptionInApp: {} } } },
      regionalConfigs: regions.map((regionCode) => ({ regionCode, newSubscriberAvailability: true })),
    };

    const c = await api(
      `${offersUrl}?offerId=${TRIAL_OFFER_ID}&regionsVersion.version=2022%2F02`,
      { method: 'POST', headers: auth, body },
    );
    if (!c.ok) { log(`  ! ${p.id} offer failed: ${c.status} ${c.json?.error?.message?.slice(0, 120)}`); continue; }

    // Offers are created DRAFT too, same as base plans.
    const a = await api(`${offersUrl}/${TRIAL_OFFER_ID}:activate`, { method: 'POST', headers: auth, body: {} });
    log(a.ok ? `  + ${p.id}: ${TRIAL_DURATION} trial ACTIVE`
             : `  ! ${p.id} activate failed: ${a.status} ${a.json?.error?.message?.slice(0, 100)}`);
  }
}

// ── RevenueCat ─────────────────────────────────────────────────────────────

async function rc(path, opts = {}) {
  return api(`${RC_API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${RC_KEY}`, ...(opts.headers || {}) },
  });
}

async function setupRevenueCat(playProductIds) {
  step('RevenueCat — products, entitlement, offering');
  if (!RC_KEY) { log('  ! RC_SECRET_KEY not set in env — skipping RevenueCat'); return; }

  // Products — mirror the Play IDs. RevenueCat's store_identifier for a Play
  // subscription with a single base plan is "productId:basePlanId".
  const prodRes = await rc(`/projects/${RC_PROJECT_ID}/products`);
  const existingProducts = prodRes.json?.items || [];
  log(`  existing products: ${existingProducts.map((x) => x.store_identifier).join(', ') || 'none'}`);

  const productIdByStoreId = {};
  for (const x of existingProducts) productIdByStoreId[x.store_identifier] = x.id;

  for (const p of PRODUCTS) {
    if (!playProductIds.includes(p.id)) { log(`  - skip ${p.id} (not in Play)`); continue; }
    const storeId = `${p.id}:${p.plan}`;
    if (productIdByStoreId[storeId]) { log(`  = product ${storeId} exists`); continue; }
    if (DRY) { log(`  + would create product ${storeId}`); continue; }

    const r = await rc(`/projects/${RC_PROJECT_ID}/products`, {
      method: 'POST',
      body: { store_identifier: storeId, app_id: RC_APP_ID, type: 'subscription', display_name: `${p.tier} ${p.plan}` },
    });
    if (r.ok) { productIdByStoreId[storeId] = r.json.id; log(`  + product ${storeId} -> ${r.json.id}`); }
    else log(`  ! product ${storeId} failed: ${r.status} ${(r.json?.message || r.text).slice(0, 140)}`);
  }

  // Entitlement
  const entRes = await rc(`/projects/${RC_PROJECT_ID}/entitlements`);
  let ent = (entRes.json?.items || []).find((e) => e.lookup_key === ENTITLEMENT.lookup_key);
  if (ent) log(`  = entitlement "${ENTITLEMENT.lookup_key}" exists`);
  else if (DRY) log(`  + would create entitlement "${ENTITLEMENT.lookup_key}"`);
  else {
    const r = await rc(`/projects/${RC_PROJECT_ID}/entitlements`, { method: 'POST', body: ENTITLEMENT });
    if (r.ok) { ent = r.json; log(`  + entitlement -> ${ent.id}`); }
    else log(`  ! entitlement failed: ${r.status} ${(r.json?.message || r.text).slice(0, 140)}`);
  }

  // Attach every product to the entitlement
  if (ent && !DRY) {
    const ids = Object.values(productIdByStoreId);
    if (ids.length) {
      const r = await rc(`/projects/${RC_PROJECT_ID}/entitlements/${ent.id}/actions/attach_products`, {
        method: 'POST', body: { product_ids: ids },
      });
      log(r.ok ? `  + attached ${ids.length} products to entitlement`
               : `  ! attach failed: ${r.status} ${(r.json?.message || r.text).slice(0, 140)}`);
    }
  }

  // Offering
  const offRes = await rc(`/projects/${RC_PROJECT_ID}/offerings`);
  let off = (offRes.json?.items || []).find((o) => o.lookup_key === OFFERING.lookup_key);
  if (off) log(`  = offering "${OFFERING.lookup_key}" exists`);
  else if (DRY) log(`  + would create offering "${OFFERING.lookup_key}" (current)`);
  else {
    // `is_current` is read-only on create — passing it is a 400. RevenueCat
    // marks the project's first offering current automatically; additional ones
    // are promoted from the dashboard.
    const r = await rc(`/projects/${RC_PROJECT_ID}/offerings`, {
      method: 'POST', body: OFFERING,
    });
    if (r.ok) { off = r.json; log(`  + offering -> ${off.id}`); }
    else log(`  ! offering failed: ${r.status} ${(r.json?.message || r.text).slice(0, 140)}`);
  }

  // Packages, one per product, attached to the offering
  if (off && !DRY) {
    const pkgRes = await rc(`/projects/${RC_PROJECT_ID}/offerings/${off.id}/packages`);
    const havePkg = new Set((pkgRes.json?.items || []).map((x) => x.lookup_key));

    for (const p of PRODUCTS) {
      const storeId = `${p.id}:${p.plan}`;
      const prodId = productIdByStoreId[storeId];
      if (!prodId) continue;
      if (havePkg.has(p.id)) { log(`  = package ${p.id} exists`); continue; }

      const r = await rc(`/projects/${RC_PROJECT_ID}/offerings/${off.id}/packages`, {
        method: 'POST', body: { lookup_key: p.id, display_name: `${p.tier} ${p.plan}` },
      });
      if (!r.ok) { log(`  ! package ${p.id} failed: ${r.status} ${(r.json?.message || r.text).slice(0, 140)}`); continue; }

      const a = await rc(`/projects/${RC_PROJECT_ID}/packages/${r.json.id}/actions/attach_products`, {
        method: 'POST', body: { products: [{ product_id: prodId, eligibility_criteria: 'all' }] },
      });
      log(a.ok ? `  + package ${p.id} -> ${storeId}`
               : `  ! package ${p.id} attach failed: ${a.status} ${(a.json?.message || a.text).slice(0, 140)}`);
    }
  }
}

// ── main ───────────────────────────────────────────────────────────────────

log(DRY ? '=== DRY RUN — nothing will be changed ===' : '=== COMMIT — creating permanent product IDs ===');

const token = playToken();
const playIds = await setupPlay(token);
await setupRevenueCat(playIds);

step('Verify');
const check = await api(
  `https://api.revenuecat.com/v1/subscribers/billing-setup-probe/offerings`,
  { headers: { Authorization: `Bearer ${process.env.RC_PUBLIC_KEY || ''}`, 'X-Platform': 'android' } },
);
if (check.ok) {
  log(`  current_offering_id: ${JSON.stringify(check.json?.current_offering_id)}`);
  log(`  offerings returned:  ${(check.json?.offerings || []).length}`);
} else {
  log(`  (skipped — set RC_PUBLIC_KEY to verify: ${check.status})`);
}
log('');
