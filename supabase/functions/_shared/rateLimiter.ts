/**
 * Simple in-memory rate limiter for Supabase Edge Functions
 *
 * Note: This is a basic implementation suitable for development and moderate traffic.
 * For production with high traffic or multiple edge function instances, consider:
 * - Upstash Redis for distributed rate limiting
 * - Supabase Realtime for distributed state
 * - Cloudflare Workers KV for edge-level rate limiting
 */

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets when function cold-starts)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Check if a request should be rate limited
 * @param identifier Unique identifier for the requester (user ID, IP, API key, etc.)
 * @param config Rate limit configuration
 * @returns Object with isLimited flag and remaining count
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { isLimited: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return {
      isLimited: false,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  // Increment count
  entry.count += 1;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    return {
      isLimited: true,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    isLimited: false,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Middleware to add rate limiting headers to responses
 */
export function addRateLimitHeaders(
  headers: HeadersInit,
  limit: number,
  remaining: number,
  resetTime: number
): HeadersInit {
  return {
    ...headers,
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
  };
}

/**
 * Standard rate limit configs for different endpoint types
 */
export const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes

  // API endpoints - moderate limits
  api: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 requests per minute

  // Webhooks - lenient limits (external services)
  webhook: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute

  // Email/SMS sending - strict limits to prevent spam
  messaging: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 per hour

  // PDF generation - moderate limits (CPU intensive)
  pdf: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute
};

/**
 * Get client identifier from request
 * Tries multiple methods in order of preference
 */
export function getClientIdentifier(req: Request, userId?: string): string {
  // 1. Use authenticated user ID if available (best)
  if (userId) {
    return `user:${userId}`;
  }

  // 2. Use API key if present
  const apiKey = req.headers.get('apikey');
  if (apiKey) {
    return `apikey:${apiKey.substring(0, 16)}`;
  }

  // 3. Use IP address (least reliable but better than nothing)
  const ip = req.headers.get('x-forwarded-for') ||
             req.headers.get('x-real-ip') ||
             'unknown';
  return `ip:${ip}`;
}

/**
 * Create a rate-limited response
 */
export function createRateLimitResponse(resetTime: number, corsHeaders: HeadersInit = {}): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
