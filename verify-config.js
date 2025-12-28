#!/usr/bin/env node

/**
 * Configuration Verification Script
 *
 * Checks if all production configuration values have been updated
 * from placeholders to actual values.
 *
 * Usage: node verify-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 TradieMate Production Configuration Verification\n');

const checks = [];
let hasErrors = false;
let hasWarnings = false;

// Helper functions
function checkFile(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    return { error: `File not found: ${filePath}` };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const results = [];

  checks.forEach(({ pattern, name, type = 'placeholder' }) => {
    const found = content.includes(pattern);
    if (type === 'placeholder' && found) {
      results.push({ name, status: 'error', message: `❌ ${name}: Still using placeholder` });
    } else if (type === 'required' && !found) {
      results.push({ name, status: 'warning', message: `⚠️  ${name}: Not found (may be okay if configured differently)` });
    } else {
      results.push({ name, status: 'ok', message: `✅ ${name}: Configured` });
    }
  });

  return results;
}

// Check 1: Stripe Price IDs in subscriptionTiers.ts
console.log('📦 Checking Stripe Configuration...\n');

const subscriptionTiersPath = path.join(__dirname, 'src', 'lib', 'subscriptionTiers.ts');
const stripeChecks = checkFile(subscriptionTiersPath, [
  { pattern: 'price_solo_monthly', name: 'Solo tier price ID' },
  { pattern: 'price_crew_monthly', name: 'Crew tier price ID' },
  { pattern: 'price_pro_monthly', name: 'Pro tier price ID' },
]);

stripeChecks.forEach(check => {
  console.log(check.message);
  if (check.status === 'error') hasErrors = true;
  if (check.status === 'warning') hasWarnings = true;
});

// Check 2: Stripe Price IDs in subscription-webhook
console.log('\n📡 Checking Subscription Webhook Configuration...\n');

const webhookPath = path.join(__dirname, 'supabase', 'functions', 'subscription-webhook', 'index.ts');
const webhookChecks = checkFile(webhookPath, [
  { pattern: "'price_solo_monthly'", name: 'Solo price ID in webhook mapping' },
  { pattern: "'price_crew_monthly'", name: 'Crew price ID in webhook mapping' },
  { pattern: "'price_pro_monthly'", name: 'Pro price ID in webhook mapping' },
]);

webhookChecks.forEach(check => {
  console.log(check.message);
  if (check.status === 'error') hasErrors = true;
  if (check.status === 'warning') hasWarnings = true;
});

// Check 3: RevenueCat iOS Key in capacitor.config.json
console.log('\n📱 Checking RevenueCat iOS Configuration...\n');

const capacitorConfigPath = path.join(__dirname, 'capacitor.config.json');
const iosChecks = checkFile(capacitorConfigPath, [
  { pattern: 'appl_PLACEHOLDER_IOS_API_KEY', name: 'iOS API Key' },
]);

iosChecks.forEach(check => {
  console.log(check.message);
  if (check.status === 'error') hasErrors = true;
  if (check.status === 'warning') hasWarnings = true;
});

// Check 4: RevenueCat Keys in purchases.ts
console.log('\n🤖 Checking RevenueCat Android Configuration...\n');

const purchasesPath = path.join(__dirname, 'src', 'lib', 'purchases.ts');
const androidChecks = checkFile(purchasesPath, [
  { pattern: 'appl_PLACEHOLDER_IOS_API_KEY', name: 'iOS API Key in purchases.ts' },
  { pattern: 'goog_PLACEHOLDER_ANDROID_API_KEY', name: 'Android API Key' },
]);

androidChecks.forEach(check => {
  console.log(check.message);
  if (check.status === 'error') hasErrors = true;
  if (check.status === 'warning') hasWarnings = true;
});

// Check 5: Environment Variables (cannot verify directly, just remind)
console.log('\n🔐 Environment Variables (Manual Verification Required)...\n');
console.log('⚠️  Please manually verify in Supabase Dashboard → Settings → Edge Functions → Secrets:');
console.log('   - STRIPE_SECRET_KEY');
console.log('   - STRIPE_WEBHOOK_SECRET');
console.log('   - REVENUECAT_WEBHOOK_SECRET');

// Check 6: Config.toml
console.log('\n⚙️  Checking Supabase Edge Functions Configuration...\n');

const configTomlPath = path.join(__dirname, 'supabase', 'config.toml');
if (fs.existsSync(configTomlPath)) {
  const configContent = fs.readFileSync(configTomlPath, 'utf8');
  const hasTeamInvitation = configContent.includes('[functions.send-team-invitation]');
  const hasAcceptInvitation = configContent.includes('[functions.accept-team-invitation]');
  const hasRecurringInvoices = configContent.includes('[functions.generate-recurring-invoices]');

  if (hasTeamInvitation && hasAcceptInvitation && hasRecurringInvoices) {
    console.log('✅ New edge functions configured in config.toml');
  } else {
    console.log('⚠️  Some edge functions may not be configured in config.toml');
    hasWarnings = true;
  }
} else {
  console.log('❌ config.toml not found');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Configuration Status Summary');
console.log('='.repeat(60) + '\n');

if (!hasErrors && !hasWarnings) {
  console.log('🎉 SUCCESS! All configuration values appear to be updated!');
  console.log('\n✅ Next steps:');
  console.log('   1. Verify environment variables in Supabase Dashboard');
  console.log('   2. Test webhook endpoints with Stripe/RevenueCat');
  console.log('   3. Deploy edge functions: npx supabase functions deploy');
  console.log('   4. Test payment flows');
  process.exit(0);
} else if (hasErrors && !hasWarnings) {
  console.log('❌ ERRORS FOUND! Please update the following configurations:');
  console.log('\n📖 See PRODUCTION_CONFIG_GUIDE.md for detailed instructions');
  console.log('📝 Use CONFIG_VALUES.template.md to track your API keys\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  WARNINGS FOUND! Please review the warnings above.');
  console.log('\n📖 See PRODUCTION_CONFIG_GUIDE.md for detailed instructions');
  console.log('📝 Some warnings may be acceptable if you configured differently\n');
  process.exit(0);
} else {
  console.log('⚠️  Configuration appears mostly complete but has some warnings.');
  console.log('\n📖 Review warnings above and check PRODUCTION_CONFIG_GUIDE.md\n');
  process.exit(0);
}
