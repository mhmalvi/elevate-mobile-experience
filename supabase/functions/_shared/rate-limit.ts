/**
 * Rate Limiting for Edge Functions
 *
 * Uses a sliding window approach with Supabase as the backing store.
 * Falls back to allowing requests if the rate limit table doesn't exist.
 *
 * Usage:
 *   import { checkRateLimit } from '../_shared/rate-limit.ts';
 *   const limited = await checkRateLimit(supabase, userId, 'create-payment', 10, 60);
 *   if (limited) return createErrorResponse(req, 'Too many requests', 429);
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Check if a request should be rate-limited.
 *
 * @param supabase  - Supabase client (service role)
 * @param key       - Unique key (e.g. userId, IP, or combo)
 * @param action    - The action/function name
 * @param maxRequests - Max requests allowed in the window
 * @param windowSeconds - Sliding window size in seconds
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  action: string,
  maxRequests: number = 30,
  windowSeconds: number = 60,
): Promise<RateLimitResult> {
  try {
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const compositeKey = `${action}:${key}`;

    // Count requests in the current window
    const { count, error: countError } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', compositeKey)
      .gte('created_at', windowStart);

    if (countError) {
      // Table may not exist — fail open (allow the request)
      console.warn('[RateLimit] Count query failed, allowing request:', countError.message);
      return { limited: false, remaining: maxRequests };
    }

    const currentCount = count || 0;

    if (currentCount >= maxRequests) {
      return {
        limited: true,
        remaining: 0,
        retryAfterSeconds: windowSeconds,
      };
    }

    // Record this request
    const { error: insertError } = await supabase
      .from('rate_limits')
      .insert({ key: compositeKey });

    if (insertError) {
      console.warn('[RateLimit] Insert failed, allowing request:', insertError.message);
    }

    return {
      limited: false,
      remaining: maxRequests - currentCount - 1,
    };
  } catch (error) {
    // Fail open — don't block requests if rate limiting breaks
    console.error('[RateLimit] Error:', error);
    return { limited: false, remaining: maxRequests };
  }
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult, maxRequests: number): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
  };
  if (result.retryAfterSeconds) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}
