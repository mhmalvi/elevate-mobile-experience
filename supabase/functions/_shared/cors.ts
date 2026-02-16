/**
 * Secure CORS Configuration for Edge Functions
 *
 * SECURITY: Only allows requests from whitelisted origins to prevent CSRF attacks
 *
 * Usage:
 * import { getCorsHeaders, createCorsResponse } from '../_shared/cors.ts';
 *
 * const corsHeaders = getCorsHeaders(req);
 * return new Response(data, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 */

// Whitelisted origins for production
const ALLOWED_ORIGINS = [
  'https://tradiemate.com.au',
  'https://www.tradiemate.com.au',
  'https://app.tradiemate.com.au',
  // Vercel deployment URLs
  'https://elevate-mobile-experience.vercel.app',
  'https://dist-six-fawn.vercel.app',
  'https://dist-oyrj5nl90-info-quadquetechs-projects.vercel.app',
  // Add staging/preview URLs if needed
  // 'https://staging.tradiemate.com.au',
];

// Development origins (only allowed in non-production)
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'capacitor://localhost', // Capacitor mobile app
  'ionic://localhost',
];

// Local network IP patterns for development (192.168.x.x, 10.x.x.x, etc.)
const LOCAL_NETWORK_PATTERNS = [
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:\d+$/,
];

/**
 * Get CORS headers based on request origin
 * Returns strict CORS headers that only allow whitelisted domains
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';

  // Check against whitelisted origins, dev origins, and local network patterns
  const isWhitelisted = ALLOWED_ORIGINS.includes(origin);
  const isDev = DEV_ORIGINS.includes(origin);
  const isCapacitor = origin === 'capacitor://localhost' || origin === 'ionic://localhost';
  const isLocalNetwork = LOCAL_NETWORK_PATTERNS.some(pattern => pattern.test(origin));

  const isAllowed = isWhitelisted || isDev || isCapacitor || isLocalNetwork;

  // Log for debugging CORS issues
  if (!isAllowed && origin) {
    console.warn(`[CORS] Origin not allowed: ${origin}`);
  }

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (origin || ALLOWED_ORIGINS[0]),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Create a CORS preflight response for OPTIONS requests
 */
export function createCorsResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

/**
 * Create an error response with CORS headers
 */
export function createErrorResponse(
  req: Request,
  error: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create a success response with CORS headers
 */
export function createSuccessResponse(
  req: Request,
  data: unknown,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    }
  );
}
