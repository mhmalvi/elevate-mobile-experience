import { describe, it, expect, afterEach } from 'vitest';
import { PUBLIC_APP_URL, publicAppUrl } from './publicUrl';

/**
 * Pretend to run inside Capacitor on the given platform.
 * @param platform - 'android' | 'ios'
 */
function mockNative(platform: 'android' | 'ios') {
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => platform };
}

describe('publicAppUrl', () => {
  afterEach(() => {
    delete window.Capacitor;
  });

  it.each(['android', 'ios'] as const)('uses the public web app on %s, never localhost', (platform) => {
    // Arrange
    mockNative(platform);

    // Act
    const url = publicAppUrl();

    // Assert
    expect(url).toBe(PUBLIC_APP_URL);
    expect(url).not.toContain('localhost');
  });

  it('uses the current origin on the web', () => {
    // Arrange (jsdom, no Capacitor)

    // Act
    const url = publicAppUrl();

    // Assert
    expect(url).toBe(window.location.origin);
  });
});
