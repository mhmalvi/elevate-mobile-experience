import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPlatform, getPaymentProvider, isNativeApp } from './platformPayments';

describe('platformPayments', () => {
  const originalWindow = { ...window };

  beforeEach(() => {
    // Reset Capacitor mock
    delete (window as any).Capacitor;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPlatform', () => {
    it('should return "web" when Capacitor is not available', () => {
      expect(getPlatform()).toBe('web');
    });

    it('should return "web" when Capacitor says not native', () => {
      (window as any).Capacitor = {
        isNativePlatform: () => false,
        getPlatform: () => 'web',
      };
      expect(getPlatform()).toBe('web');
    });

    it('should return "android" on native Android', () => {
      (window as any).Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
      };
      expect(getPlatform()).toBe('android');
    });

    it('should return "ios" on native iOS', () => {
      (window as any).Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
      };
      expect(getPlatform()).toBe('ios');
    });
  });

  describe('getPaymentProvider', () => {
    it('should return "google_play" for android', () => {
      expect(getPaymentProvider('android')).toBe('google_play');
    });

    it('should return "apple_iap" for ios', () => {
      expect(getPaymentProvider('ios')).toBe('apple_iap');
    });

    it('should return "stripe" for web', () => {
      expect(getPaymentProvider('web')).toBe('stripe');
    });
  });

  describe('isNativeApp', () => {
    it('should return false when Capacitor is not available', () => {
      expect(isNativeApp()).toBe(false);
    });

    it('should return false when not native platform', () => {
      (window as any).Capacitor = {
        isNativePlatform: () => false,
      };
      expect(isNativeApp()).toBe(false);
    });

    it('should return true when on native platform', () => {
      (window as any).Capacitor = {
        isNativePlatform: () => true,
      };
      expect(isNativeApp()).toBe(true);
    });
  });
});
