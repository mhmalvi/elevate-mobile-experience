import { describe, it, expect } from 'vitest';
import { getCorsHeaders } from './cors';

/**
 * Build a request carrying the given Origin header.
 * @param origin - value for the Origin header
 * @returns a Request suitable for getCorsHeaders
 */
function requestFrom(origin: string): Request {
  return new Request('https://example.supabase.co/functions/v1/x', { headers: { origin } });
}

describe('getCorsHeaders', () => {
  it.each([
    'https://tradiemate.aethonautomation.com',
    'https://localhost', // Capacitor Android (androidScheme: 'https')
    'capacitor://localhost', // Capacitor iOS
    'https://elevate-mobile-experience.vercel.app',
  ])('allows the production origin %s', (origin) => {
    // Arrange
    const req = requestFrom(origin);

    // Act
    const headers = getCorsHeaders(req);

    // Assert
    expect(headers['Access-Control-Allow-Origin']).toBe(origin);
  });

  it('no longer lists the unowned tradiemate.com.au domain', async () => {
    // Arrange
    const { readFileSync } = await import('fs');
    const source = readFileSync(`${__dirname}/cors.ts`, 'utf8');

    // Act
    const mentionsDeadDomain = /tradiemate\.com\.au/.test(source);

    // Assert
    expect(mentionsDeadDomain).toBe(false);
  });
});
