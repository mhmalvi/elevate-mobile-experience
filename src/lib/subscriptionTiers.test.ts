import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_TIERS, getTierById, getTierByStripePriceId } from './subscriptionTiers';

describe('subscriptionTiers', () => {
  describe('SUBSCRIPTION_TIERS', () => {
    it('should have 4 tiers', () => {
      expect(SUBSCRIPTION_TIERS).toHaveLength(4);
    });

    it('should have free, solo, crew, pro in order', () => {
      expect(SUBSCRIPTION_TIERS.map(t => t.id)).toEqual(['free', 'solo', 'crew', 'pro']);
    });

    it('free tier should have price 0', () => {
      const free = SUBSCRIPTION_TIERS[0];
      expect(free.price).toBe(0);
      expect(free.annualPrice).toBe(0);
      expect(free.stripePriceId).toBeNull();
      expect(free.annualStripePriceId).toBeNull();
    });

    it('solo tier should have correct pricing', () => {
      const solo = SUBSCRIPTION_TIERS[1];
      expect(solo.price).toBe(29);
      expect(solo.annualPrice).toBe(24);
      expect(solo.userLimit).toBe(1);
    });

    it('crew tier should be highlighted', () => {
      const crew = SUBSCRIPTION_TIERS[2];
      expect(crew.highlighted).toBe(true);
      expect(crew.price).toBe(49);
      expect(crew.userLimit).toBe(3);
    });

    it('pro tier should have highest user limit', () => {
      const pro = SUBSCRIPTION_TIERS[3];
      expect(pro.price).toBe(79);
      expect(pro.userLimit).toBe(10);
    });

    it('each paid tier should have Google Play and Apple product IDs', () => {
      const paidTiers = SUBSCRIPTION_TIERS.filter(t => t.id !== 'free');
      paidTiers.forEach(tier => {
        expect(tier.googlePlayProductId).toBeTruthy();
        expect(tier.annualGooglePlayProductId).toBeTruthy();
        expect(tier.appleProductId).toBeTruthy();
        expect(tier.annualAppleProductId).toBeTruthy();
      });
    });

    it('each tier should have at least one feature', () => {
      SUBSCRIPTION_TIERS.forEach(tier => {
        expect(tier.features.length).toBeGreaterThan(0);
      });
    });

    it('annual prices should be less than monthly prices for paid tiers', () => {
      const paidTiers = SUBSCRIPTION_TIERS.filter(t => t.id !== 'free');
      paidTiers.forEach(tier => {
        expect(tier.annualPrice).toBeLessThan(tier.price);
      });
    });
  });

  describe('getTierById', () => {
    it('should return tier for valid id', () => {
      expect(getTierById('free')?.id).toBe('free');
      expect(getTierById('solo')?.id).toBe('solo');
      expect(getTierById('crew')?.id).toBe('crew');
      expect(getTierById('pro')?.id).toBe('pro');
    });

    it('should return undefined for invalid id', () => {
      expect(getTierById('enterprise')).toBeUndefined();
      expect(getTierById('')).toBeUndefined();
    });
  });

  describe('getTierByStripePriceId', () => {
    it('should return undefined for null price id', () => {
      expect(getTierByStripePriceId('')).toBeUndefined();
    });

    it('should match monthly Stripe price IDs', () => {
      const solo = SUBSCRIPTION_TIERS[1];
      if (solo.stripePriceId) {
        expect(getTierByStripePriceId(solo.stripePriceId)?.id).toBe('solo');
      }
    });

    it('should match annual Stripe price IDs', () => {
      const crew = SUBSCRIPTION_TIERS[2];
      if (crew.annualStripePriceId) {
        expect(getTierByStripePriceId(crew.annualStripePriceId)?.id).toBe('crew');
      }
    });

    it('should return undefined for unknown price id', () => {
      expect(getTierByStripePriceId('price_nonexistent')).toBeUndefined();
    });
  });
});
