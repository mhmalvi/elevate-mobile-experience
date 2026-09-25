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
  ])('allows the production origin %s', (origin) => {
    // Arrange
    const req = requestFrom(origin);

    // Act
    const headers = getCorsHeaders(req);

    // Assert
    expect(headers['Access-Control-Allow-Origin']).toBe(origin);
  });

  it.each([/tradiemate\.com\.au/, /vercel\.app/])(
    'no longer lists retired or unowned origins (%s)',
    async (retired) => {
      // Arrange
      const { readFileSync } = await import('fs');
      const source = readFileSync(`${__dirname}/cors.ts`, 'utf8');

      // Act
      const listsRetiredOrigin = retired.test(source);

      // Assert
      expect(listsRetiredOrigin).toBe(false);
    },
  );
});
