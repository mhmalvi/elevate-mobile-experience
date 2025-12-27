// RevenueCat integration for native in-app purchases
// This module handles Google Play and Apple App Store subscriptions

import { Purchases, LOG_LEVEL, PurchasesPackage, CustomerInfo } from '@revenuecat/purchases-capacitor';
import { isNativeApp, getPlatform } from './platformPayments';
import { supabase } from '@/integrations/supabase/client';

// Product identifiers configured in RevenueCat/App Stores
export const REVENUECAT_PRODUCTS = {
  solo: {
    identifier: 'solo_monthly',
    tier: 'solo',
  },
  crew: {
    identifier: 'crew_monthly', 
    tier: 'crew',
  },
  pro: {
    identifier: 'pro_monthly',
    tier: 'pro',
  },
} as const;

let isInitialized = false;

/**
 * Initialize RevenueCat SDK
 * Call this once when the app starts (only on native platforms)
 */
export async function initializePurchases(userId?: string): Promise<void> {
  if (!isNativeApp() || isInitialized) {
    return;
  }

  try {
    const platform = getPlatform();
    
    // RevenueCat API keys are configured per platform in RevenueCat dashboard
    // The actual key should be set in capacitor.config.json or fetched from a secure source
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    
    // Configure with the app user ID for proper subscription tracking
    if (userId) {
      await Purchases.configure({
        apiKey: getRevenueCatApiKey(),
        appUserID: userId,
      });
    } else {
      await Purchases.configure({
        apiKey: getRevenueCatApiKey(),
      });
    }

    isInitialized = true;
    console.log('[RevenueCat] Initialized successfully on', platform);
  } catch (error) {
    console.error('[RevenueCat] Failed to initialize:', error);
  }
}

/**
 * Get the RevenueCat API key based on platform
 * In production, these should be securely stored
 */
function getRevenueCatApiKey(): string {
  const platform = getPlatform();
  
  // These are placeholder keys - replace with actual keys from RevenueCat dashboard
  // Android and iOS have separate API keys in RevenueCat
  if (platform === 'android') {
    return 'goog_PLACEHOLDER_ANDROID_API_KEY';
  } else if (platform === 'ios') {
    return 'appl_PLACEHOLDER_IOS_API_KEY';
  }
  
  throw new Error('RevenueCat is only available on native platforms');
}

/**
 * Get available subscription packages from RevenueCat
 */
export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  if (!isNativeApp()) {
    return [];
  }

  try {
    const offerings = await Purchases.getOfferings();
    const currentOffering = offerings.current;
    
    if (!currentOffering) {
      console.log('[RevenueCat] No current offering found');
      return [];
    }

    return currentOffering.availablePackages;
  } catch (error) {
    console.error('[RevenueCat] Failed to get offerings:', error);
    return [];
  }
}

/**
 * Get current customer info including subscription status
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isNativeApp()) {
    return null;
  }

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('[RevenueCat] Failed to get customer info:', error);
    return null;
  }
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(): Promise<{ active: boolean; tier: string | null }> {
  const customerInfo = await getCustomerInfo();
  
  if (!customerInfo) {
    return { active: false, tier: null };
  }

  // Check for active entitlements
  const activeEntitlements = customerInfo.entitlements.active;
  
  // Map entitlements to tiers
  if (activeEntitlements['pro']) {
    return { active: true, tier: 'pro' };
  } else if (activeEntitlements['crew']) {
    return { active: true, tier: 'crew' };
  } else if (activeEntitlements['solo']) {
    return { active: true, tier: 'solo' };
  }

  return { active: false, tier: null };
}

/**
 * Purchase a subscription package
 */
export async function purchasePackage(productId: string): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!isNativeApp()) {
    return { success: false, error: 'In-app purchases are only available in the mobile app' };
  }

  try {
    // Get the package to purchase
    const packages = await getAvailablePackages();
    const packageToPurchase = packages.find(pkg => 
      pkg.product.identifier === productId
    );

    if (!packageToPurchase) {
      return { success: false, error: 'Product not found' };
    }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });

    // Sync with Supabase after successful purchase
    await syncSubscriptionToSupabase(customerInfo);

    return { success: true, customerInfo };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
    console.error('[RevenueCat] Purchase failed:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Restore previous purchases (useful when reinstalling app)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!isNativeApp()) {
    return { success: false, error: 'In-app purchases are only available in the mobile app' };
  }

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    
    // Sync with Supabase after restore
    await syncSubscriptionToSupabase(customerInfo);

    return { success: true, customerInfo };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Restore failed';
    console.error('[RevenueCat] Restore failed:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync subscription status from RevenueCat to Supabase
 */
async function syncSubscriptionToSupabase(customerInfo: CustomerInfo): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { active, tier } = await hasActiveSubscription();
    const platform = getPlatform();
    const provider = platform === 'android' ? 'google_play' : 'apple_iap';

    // Get expiration date from active subscription
    let expiresAt: string | null = null;
    const activeEntitlements = customerInfo.entitlements.active;
    const firstEntitlement = Object.values(activeEntitlements)[0];
    if (firstEntitlement?.expirationDate) {
      expiresAt = firstEntitlement.expirationDate;
    }

    await supabase
      .from('profiles')
      .update({
        subscription_tier: active ? tier : 'free',
        subscription_provider: active ? provider : null,
        subscription_id: active ? customerInfo.originalAppUserId : null,
        subscription_expires_at: expiresAt,
      })
      .eq('user_id', user.id);

    console.log('[RevenueCat] Synced subscription to Supabase:', { tier, provider });
  } catch (error) {
    console.error('[RevenueCat] Failed to sync to Supabase:', error);
  }
}

/**
 * Set the RevenueCat user ID (call after user login)
 */
export async function setRevenueCatUserId(userId: string): Promise<void> {
  if (!isNativeApp() || !isInitialized) {
    return;
  }

  try {
    await Purchases.logIn({ appUserID: userId });
    console.log('[RevenueCat] User ID set:', userId);
  } catch (error) {
    console.error('[RevenueCat] Failed to set user ID:', error);
  }
}

/**
 * Log out the RevenueCat user (call on app logout)
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!isNativeApp() || !isInitialized) {
    return;
  }

  try {
    await Purchases.logOut();
    console.log('[RevenueCat] User logged out');
  } catch (error) {
    console.error('[RevenueCat] Failed to log out:', error);
  }
}
