/**
 * OAuth State Parameter Security
 * Implements HMAC-SHA256 signing to prevent CSRF attacks
 *
 * SECURITY: Protects against OAuth state hijacking by:
 * 1. Signing state parameter with server secret
 * 2. Adding timestamp for expiration (10 min)
 * 3. Preventing state parameter tampering
 */

const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * OAuth State Data Interface
 */
export interface OAuthStateData {
  userId: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Signed State Result Interface
 */
export interface SignedState {
  state: string;
  signature: string;
  combined: string; // Base64 encoded state.signature for URL param
}

/**
 * Verification Result Interface
 */
export interface VerificationResult {
  valid: boolean;
  data?: OAuthStateData;
  error?: string;
}

/**
 * Gets the signing key from environment
 */
function getSigningKey(): string {
  const key = Deno.env.get('ENCRYPTION_KEY');

  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be set and at least 32 characters long for OAuth state signing');
  }

  return key;
}

/**
 * Generates HMAC-SHA256 signature for OAuth state
 * @param data - State data to sign
 * @returns Base64 signature
 */
async function generateSignature(data: string): Promise<string> {
  const key = getSigningKey();
  const encoder = new TextEncoder();

  // Import signing key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Generate signature
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(data)
  );

  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Signs OAuth state parameter with HMAC-SHA256
 * @param data - OAuth state data (userId, etc.)
 * @returns Signed state parameter for OAuth redirect
 */
export async function signState(data: OAuthStateData): Promise<string> {
  // Add timestamp if not present
  if (!data.timestamp) {
    data.timestamp = Date.now();
  }

  // Convert data to JSON string
  const stateJson = JSON.stringify(data);

  // Base64 encode the state
  const stateB64 = btoa(stateJson);

  // Generate signature
  const signature = await generateSignature(stateB64);

  // Combine state and signature with delimiter
  const combined = `${stateB64}.${signature}`;

  // Return base64 encoded combined value for URL safety
  return btoa(combined);
}

/**
 * Verifies and extracts OAuth state parameter
 * @param stateParam - The state parameter from OAuth callback
 * @returns Verification result with extracted data if valid
 */
export async function verifyState(stateParam: string): Promise<VerificationResult> {
  try {
    // Decode the base64 outer layer
    const combined = atob(stateParam);

    // Split state and signature
    const parts = combined.split('.');
    if (parts.length !== 2) {
      return {
        valid: false,
        error: 'Invalid state format: missing signature'
      };
    }

    const [stateB64, providedSignature] = parts;

    // Verify signature
    const expectedSignature = await generateSignature(stateB64);

    if (providedSignature !== expectedSignature) {
      return {
        valid: false,
        error: 'Invalid state signature: possible CSRF attack'
      };
    }

    // Decode state data
    const stateJson = atob(stateB64);
    const data: OAuthStateData = JSON.parse(stateJson);

    // Verify timestamp (prevent replay attacks)
    if (data.timestamp) {
      const age = Date.now() - data.timestamp;

      if (age > STATE_EXPIRY_MS) {
        return {
          valid: false,
          error: `State expired: ${Math.round(age / 1000 / 60)} minutes old (max 10 minutes)`
        };
      }

      if (age < 0) {
        return {
          valid: false,
          error: 'State timestamp is in the future: possible clock skew or tampering'
        };
      }
    }

    return {
      valid: true,
      data
    };

  } catch (error) {
    return {
      valid: false,
      error: `State verification failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Checks if OAuth state signing is properly configured
 */
export function isOAuthSecurityConfigured(): boolean {
  try {
    const key = Deno.env.get('ENCRYPTION_KEY');
    return !!(key && key.length >= 32);
  } catch {
    return false;
  }
}
