// RevenueCat integration for cross-platform subscriptions
// This module handles subscriptions across iOS, Android, and Web
// - iOS/Android: Native in-app purchases via App Stores
// - Web: Stripe payments via RevenueCat Web SDK

import { Purchases as NativePurchases, LOG_LEVEL, PurchasesPackage, CustomerInfo as NativeCustomerInfo } from '@revenuecat/purchases-capacitor';
import { Purchases as WebPurchases, CustomerInfo as WebCustomerInfo } from '@revenuecat/purchases-js';
import { isNativeApp, getPlatform } from './platformPayments';
import { supabase } from '@/integrations/supabase/client';

// Type union for customer info from both SDKs
type CustomerInfo = NativeCustomerInfo | WebCustomerInfo;

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
 * Get the RevenueCat API key based on platform
 * Configure these in your .env file:
 * - VITE_REVENUECAT_ANDROID_API_KEY (for Android)
 * - VITE_REVENUECAT_IOS_API_KEY (for iOS)
 * - VITE_REVENUECAT_WEB_API_KEY (for Web)
 *
 * Get your API keys from: https://app.revenuecat.com/settings/api-keys
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
  } else {
    // Web platform
    const key = import.meta.env.VITE_REVENUECAT_WEB_API_KEY;
    if (!key) {
      throw new Error('VITE_REVENUECAT_WEB_API_KEY not configured. Please add it to your .env file.');
    }
    return key;
  }
}

/**
 * Initialize RevenueCat SDK
 * Call this once when the app starts on any platform
 */
export async function initializePurchases(userId?: string): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    const platform = getPlatform();
    const apiKey = getRevenueCatApiKey();

    if (isNativeApp()) {
      // Native initialization (iOS/Android)
      await NativePurchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

      if (userId) {
        await NativePurchases.configure({
          apiKey,
          appUserID: userId,
        });
      } else {
        await NativePurchases.configure({ apiKey });
      }
    } else {
      // Web initialization
      await WebPurchases.configure(apiKey, userId);
    }

    isInitialized = true;
    console.log('[RevenueCat] Initialized successfully on', platform);
  } catch (error) {
    console.error('[RevenueCat] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Get available subscription packages from RevenueCat
 */
export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  try {
    if (isNativeApp()) {
      const offerings = await NativePurchases.getOfferings();
      const currentOffering = offerings.current;

      if (!currentOffering) {
        console.log('[RevenueCat] No current offering found');
        return [];
      }

      return currentOffering.availablePackages;
    } else {
      // Web: Get offerings from Web SDK
      const offerings = await WebPurchases.getOfferings();
      const currentOffering = offerings.current;

      if (!currentOffering) {
        console.log('[RevenueCat] No current offering found');
        return [];
      }

      // Convert web offerings to a compatible format
      return currentOffering.availablePackages as unknown as PurchasesPackage[];
    }
  } catch (error) {
    console.error('[RevenueCat] Failed to get offerings:', error);
    return [];
  }
}

/**
 * Get current customer info including subscription status
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    if (isNativeApp()) {
      const { customerInfo } = await NativePurchases.getCustomerInfo();
      return customerInfo;
    } else {
      const customerInfo = await WebPurchases.getCustomerInfo();
      return customerInfo;
    }
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
  try {
    if (isNativeApp()) {
      // Native purchase flow
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
    } else {
      // Web purchase flow - RevenueCat handles Stripe checkout
      const packages = await getAvailablePackages();
      const packageToPurchase = packages.find(pkg =>
        (pkg as any).product.identifier === productId
      );

      if (!packageToPurchase) {
        return { success: false, error: 'Product not found' };
      }

      const { customerInfo } = await WebPurchases.purchase({ rcPackage: packageToPurchase as any });
      await syncSubscriptionToSupabase(customerInfo);

      return { success: true, customerInfo };
    }
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
  try {
    if (isNativeApp()) {
      const { customerInfo } = await NativePurchases.restorePurchases();
      await syncSubscriptionToSupabase(customerInfo);
      return { success: true, customerInfo };
    } else {
      // Web: restore is handled automatically by RevenueCat
      const customerInfo = await WebPurchases.getCustomerInfo();
      await syncSubscriptionToSupabase(customerInfo);
      return { success: true, customerInfo };
    }
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
 * Set the RevenueCat user ID (call after user login)
 */
export async function setRevenueCatUserId(userId: string): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    if (isNativeApp()) {
      await NativePurchases.logIn({ appUserID: userId });
    } else {
      await WebPurchases.logIn(userId);
    }
    console.log('[RevenueCat] User ID set:', userId);
  } catch (error) {
    console.error('[RevenueCat] Failed to set user ID:', error);
  }
}

/**
 * Log out the RevenueCat user (call on app logout)
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    if (isNativeApp()) {
      await NativePurchases.logOut();
    } else {
      await WebPurchases.logOut();
    }
    console.log('[RevenueCat] User logged out');
  } catch (error) {
    console.error('[RevenueCat] Failed to log out:', error);
  }
}
