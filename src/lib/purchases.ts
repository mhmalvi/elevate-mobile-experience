// RevenueCat integration for native in-app subscriptions (iOS/Android only)
// - iOS/Android: Native in-app purchases via App Stores using RevenueCat
// - Web: Stripe payments handled directly via edge functions (no RevenueCat needed)

import { Purchases as NativePurchases, LOG_LEVEL, PurchasesPackage, CustomerInfo as NativeCustomerInfo } from '@revenuecat/purchases-capacitor';
import { isNativeApp, getPlatform } from './platformPayments';
import { supabase } from '@/integrations/supabase/client';

type CustomerInfo = NativeCustomerInfo;

// Product identifiers configured in RevenueCat/App Stores
export const REVENUECAT_PRODUCTS = {
  solo: {
    identifier: 'solo_monthly',
    annualIdentifier: 'solo_annual',
    tier: 'solo',
  },
  crew: {
    identifier: 'crew_monthly',
    annualIdentifier: 'crew_annual',
    tier: 'crew',
  },
  pro: {
    identifier: 'pro_monthly',
    annualIdentifier: 'pro_annual',
    tier: 'pro',
  },
} as const;

let isInitialized = false;

/**
 * Get the RevenueCat API key based on native platform (iOS/Android only)
 * Web subscriptions use Stripe directly via edge functions.
 */
function getRevenueCatApiKey(): string {
  const platform = getPlatform();

  if (platform === 'android') {
    const key = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;
    if (!key) {
      throw new Error('VITE_REVENUECAT_ANDROID_API_KEY not configured. Please add it to your .env file.');
    }
    return key;
  } else if (platform === 'ios') {
    const key = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
    if (!key) {
      throw new Error('VITE_REVENUECAT_IOS_API_KEY not configured. Please add it to your .env file.');
    }
    return key;
  }

  throw new Error('RevenueCat is only supported on native platforms (iOS/Android)');
}

/**
 * Initialize RevenueCat SDK (native platforms only)
 * Web subscriptions are handled via Stripe edge functions directly.
 */
export async function initializePurchases(userId?: string): Promise<void> {
  if (isInitialized) {
    return;
  }

  // Skip RevenueCat on web - web uses Stripe directly via edge functions
  if (!isNativeApp()) {
    console.log('[RevenueCat] Skipped on web - using Stripe directly');
    return;
  }

  try {
    const platform = getPlatform();
    const apiKey = getRevenueCatApiKey();

    await NativePurchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

    if (userId) {
      await NativePurchases.configure({
        apiKey,
        appUserID: userId,
      });
    } else {
      await NativePurchases.configure({ apiKey });
    }

    isInitialized = true;
    console.log('[RevenueCat] Initialized successfully on', platform);
  } catch (error) {
    console.error('[RevenueCat] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Get available subscription packages from RevenueCat (native only)
 */
export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  if (!isNativeApp()) return [];

  try {
    const offerings = await NativePurchases.getOfferings();
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
 * Get current customer info including subscription status (native only)
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isNativeApp()) return null;

  try {
    const { customerInfo } = await NativePurchases.getCustomerInfo();
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
 * Purchase a subscription package (native only - web uses Stripe edge functions)
 */
export async function purchasePackage(productId: string): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!isNativeApp()) {
    return { success: false, error: 'Web purchases use Stripe checkout' };
  }

  try {
    const packages = await getAvailablePackages();
    const packageToPurchase = packages.find(pkg =>
      pkg.product.identifier === productId
    );

    if (!packageToPurchase) {
      return { success: false, error: 'Product not found' };
    }

    const { customerInfo } = await NativePurchases.purchasePackage({ aPackage: packageToPurchase });
    await syncSubscriptionToSupabase(customerInfo);

    return { success: true, customerInfo };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
    console.error('[RevenueCat] Purchase failed:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Restore previous purchases (native only - useful when reinstalling app)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!isNativeApp()) {
    return { success: false, error: 'Restore is only available on mobile' };
  }

  try {
    const { customerInfo } = await NativePurchases.restorePurchases();
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

    let provider: string;
    if (platform === 'android') {
      provider = 'google_play';
    } else if (platform === 'ios') {
      provider = 'apple_iap';
    } else {
      provider = 'stripe';
    }

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
        subscription_id: active ? (customerInfo as any).originalAppUserId : null,
        subscription_expires_at: expiresAt,
      })
      .eq('user_id', user.id);

    console.log('[RevenueCat] Synced subscription to Supabase:', { tier, provider });
  } catch (error) {
    console.error('[RevenueCat] Failed to sync to Supabase:', error);
  }
}

/**
 * Set the RevenueCat user ID (call after user login, native only)
 */
export async function setRevenueCatUserId(userId: string): Promise<void> {
  if (!isInitialized || !isNativeApp()) return;

  try {
    await NativePurchases.logIn({ appUserID: userId });
    console.log('[RevenueCat] User ID set:', userId);
  } catch (error) {
    console.error('[RevenueCat] Failed to set user ID:', error);
  }
}

/**
 * Log out the RevenueCat user (call on app logout, native only)
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!isInitialized || !isNativeApp()) return;

  try {
    await NativePurchases.logOut();
    console.log('[RevenueCat] User logged out');
  } catch (error) {
    console.error('[RevenueCat] Failed to log out:', error);
  }
}
