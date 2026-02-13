import { describe, it, expect, vi, beforeEach } from 'vitest';
import { REVENUECAT_PRODUCTS } from './purchases';

// Mock Capacitor and RevenueCat before importing functions that use them
vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: {
    setLogLevel: vi.fn(),
    configure: vi.fn(),
    getOfferings: vi.fn(),
    getCustomerInfo: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

vi.mock('./platformPayments', () => ({
  isNativeApp: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn() })),
    })),
  },
}));

describe('purchases', () => {
  describe('REVENUECAT_PRODUCTS', () => {
    it('should have solo, crew, pro products', () => {
      expect(REVENUECAT_PRODUCTS.solo).toBeDefined();
      expect(REVENUECAT_PRODUCTS.crew).toBeDefined();
      expect(REVENUECAT_PRODUCTS.pro).toBeDefined();
    });

    it('each product should have identifier, annualIdentifier, and tier', () => {
      Object.values(REVENUECAT_PRODUCTS).forEach(product => {
        expect(product.identifier).toBeTruthy();
        expect(product.annualIdentifier).toBeTruthy();
        expect(product.tier).toBeTruthy();
      });
    });

    it('product identifiers should follow naming convention', () => {
      expect(REVENUECAT_PRODUCTS.solo.identifier).toBe('solo_monthly');
      expect(REVENUECAT_PRODUCTS.solo.annualIdentifier).toBe('solo_annual');
      expect(REVENUECAT_PRODUCTS.crew.identifier).toBe('crew_monthly');
      expect(REVENUECAT_PRODUCTS.crew.annualIdentifier).toBe('crew_annual');
      expect(REVENUECAT_PRODUCTS.pro.identifier).toBe('pro_monthly');
      expect(REVENUECAT_PRODUCTS.pro.annualIdentifier).toBe('pro_annual');
    });

    it('tiers should match product keys', () => {
      expect(REVENUECAT_PRODUCTS.solo.tier).toBe('solo');
      expect(REVENUECAT_PRODUCTS.crew.tier).toBe('crew');
      expect(REVENUECAT_PRODUCTS.pro.tier).toBe('pro');
    });
  });

  describe('initializePurchases', () => {
    it('should skip initialization on web', async () => {
      const { initializePurchases } = await import('./purchases');
      // isNativeApp mocked to return false
      await initializePurchases();
      // Should not throw, just skip silently
    });
  });

  describe('getAvailablePackages', () => {
    it('should return empty array on web', async () => {
      const { getAvailablePackages } = await import('./purchases');
      const packages = await getAvailablePackages();
      expect(packages).toEqual([]);
    });
  });

  describe('getCustomerInfo', () => {
    it('should return null on web', async () => {
      const { getCustomerInfo } = await import('./purchases');
      const info = await getCustomerInfo();
      expect(info).toBeNull();
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return inactive with no tier on web', async () => {
      const { hasActiveSubscription } = await import('./purchases');
      const result = await hasActiveSubscription();
      expect(result).toEqual({ active: false, tier: null });
    });
  });

  describe('purchasePackage', () => {
    it('should return error on web', async () => {
      const { purchasePackage } = await import('./purchases');
      const result = await purchasePackage('solo_monthly');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Stripe');
    });
  });

  describe('restorePurchases', () => {
    it('should return error on web', async () => {
      const { restorePurchases } = await import('./purchases');
      const result = await restorePurchases();
      expect(result.success).toBe(false);
      expect(result.error).toContain('mobile');
    });
  });
});
