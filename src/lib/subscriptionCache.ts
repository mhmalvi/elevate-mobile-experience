/**
 * Offline Subscription Cache
 *
 * Caches subscription status locally so tradies working on job sites
 * with poor connectivity can still access paid features.
 *
 * Uses Capacitor Preferences (or localStorage fallback) to persist
 * subscription state with a configurable grace period.
 */

import { Preferences } from '@capacitor/preferences';

const CACHE_KEY = 'tradiemate_subscription_cache';
const CACHE_VERSION = 1;

/** Maximum time (in hours) to trust cached subscription data */
const OFFLINE_GRACE_HOURS = 72; // 3 days offline grace

export interface CachedSubscription {
    version: number;
    tier: string;
    provider: string | null;
    expiresAt: string | null;
    cachedAt: string;
    userId: string;
}

/**
 * Save subscription state to local storage for offline use.
 * Should be called after every successful subscription check.
 */
export async function cacheSubscription(
    userId: string,
    tier: string,
    provider: string | null,
    expiresAt: string | null
): Promise<void> {
    try {
        const cached: CachedSubscription = {
            version: CACHE_VERSION,
            tier,
            provider,
            expiresAt,
            cachedAt: new Date().toISOString(),
            userId,
        };

        await Preferences.set({
            key: CACHE_KEY,
            value: JSON.stringify(cached),
        });
    } catch (error) {
        // Fallback to localStorage
        try {
            const cached: CachedSubscription = {
                version: CACHE_VERSION,
                tier,
                provider,
                expiresAt,
                cachedAt: new Date().toISOString(),
                userId,
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
        } catch {
            console.warn('[SubscriptionCache] Failed to cache subscription');
        }
    }
}

/**
 * Get cached subscription state.
 * Returns null if cache is missing, expired, or invalid.
 */
export async function getCachedSubscription(
    userId: string
): Promise<CachedSubscription | null> {
    try {
        let raw: string | null = null;

        try {
            const result = await Preferences.get({ key: CACHE_KEY });
            raw = result.value;
        } catch {
            // Fallback to localStorage
            raw = localStorage.getItem(CACHE_KEY);
        }

        if (!raw) return null;

        const cached: CachedSubscription = JSON.parse(raw);

        // Version check
        if (cached.version !== CACHE_VERSION) return null;

        // User mismatch check
        if (cached.userId !== userId) return null;

        // Check offline grace period
        const cachedAt = new Date(cached.cachedAt).getTime();
        const now = Date.now();
        const graceMs = OFFLINE_GRACE_HOURS * 60 * 60 * 1000;

        if (now - cachedAt > graceMs) {
            console.warn('[SubscriptionCache] Cache expired (beyond grace period)');
            return null;
        }

        return cached;
    } catch (error) {
        console.warn('[SubscriptionCache] Error reading cache:', error);
        return null;
    }
}

/**
 * Clear the subscription cache (e.g., on logout).
 */
export async function clearSubscriptionCache(): Promise<void> {
    try {
        await Preferences.remove({ key: CACHE_KEY });
    } catch {
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch {
            // Ignore
        }
    }
}

/**
 * Check if user has an active subscription, with offline fallback.
 *
 * @param userId - The user's ID
 * @param onlineChecker - Function that checks subscription status from the server
 * @returns The subscription tier, falling back to cached data if offline
 */
export async function getSubscriptionWithOfflineFallback(
    userId: string,
    onlineChecker: () => Promise<{ tier: string; provider: string | null; expiresAt: string | null } | null>
): Promise<{ tier: string; provider: string | null; source: 'online' | 'cache' | 'default' }> {
    // Try online first
    try {
        const onlineResult = await onlineChecker();

        if (onlineResult) {
            // Cache the fresh result
            await cacheSubscription(
                userId,
                onlineResult.tier,
                onlineResult.provider,
                onlineResult.expiresAt
            );

            return {
                tier: onlineResult.tier,
                provider: onlineResult.provider,
                source: 'online',
            };
        }
    } catch (error) {
        console.warn('[SubscriptionCache] Online check failed, using cache:', error);
    }

    // Fall back to cache
    const cached = await getCachedSubscription(userId);
    if (cached) {
        // Check if the cached subscription is still within its expiry
        if (cached.expiresAt) {
            const expiresAt = new Date(cached.expiresAt).getTime();
            if (Date.now() > expiresAt) {
                console.warn('[SubscriptionCache] Cached subscription has expired');
                return { tier: 'free', provider: null, source: 'cache' };
            }
        }

        return {
            tier: cached.tier,
            provider: cached.provider,
            source: 'cache',
        };
    }

    // No cache, no online — return free tier
    return { tier: 'free', provider: null, source: 'default' };
}
