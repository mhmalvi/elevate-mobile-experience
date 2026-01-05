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
  'https://dist-six-fawn.vercel.app',
  'https://dist-oyrj5nl90-info-quadquetechs-projects.vercel.app',
  // Add staging/preview URLs if needed
  // 'https://staging.tradiemate.com.au',
];

// Development origins (only allowed in non-production)
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'capacitor://localhost', // Capacitor mobile app
  'ionic://localhost',
];

/**
 * Get CORS headers based on request origin
 * Returns strict CORS headers that only allow whitelisted domains
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';

  // Combine allowed origins based on environment
  const allowedOrigins = isDevelopment
    ? [...ALLOWED_ORIGINS, ...DEV_ORIGINS]
    : ALLOWED_ORIGINS;

  // Check if origin is whitelisted
  const isAllowed = allowedOrigins.some(allowed => origin === allowed);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
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
