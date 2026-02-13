import { describe, it, expect } from 'vitest';
import { TIER_LIMITS, TIER_NAMES, getLimit, isUnlimited, formatLimit } from './tierLimits';
import type { SubscriptionTier, UsageType } from './tierLimits';

describe('tierLimits', () => {
  describe('TIER_LIMITS', () => {
    it('should have all 4 tiers defined', () => {
      expect(Object.keys(TIER_LIMITS)).toEqual(['free', 'solo', 'crew', 'pro']);
    });

    it('free tier should have strict limits', () => {
      expect(TIER_LIMITS.free.quotes).toBe(5);
      expect(TIER_LIMITS.free.invoices).toBe(5);
      expect(TIER_LIMITS.free.jobs).toBe(3);
      expect(TIER_LIMITS.free.sms).toBe(5);
      expect(TIER_LIMITS.free.emails).toBe(10);
      expect(TIER_LIMITS.free.clients).toBe(10);
    });

    it('solo tier should have unlimited core features', () => {
      expect(TIER_LIMITS.solo.quotes).toBe(-1);
      expect(TIER_LIMITS.solo.invoices).toBe(-1);
      expect(TIER_LIMITS.solo.jobs).toBe(-1);
      expect(TIER_LIMITS.solo.clients).toBe(-1);
      expect(TIER_LIMITS.solo.sms).toBe(50);
    });

    it('SMS limits should increase with tier', () => {
      expect(TIER_LIMITS.free.sms).toBeLessThan(TIER_LIMITS.solo.sms);
      expect(TIER_LIMITS.solo.sms).toBeLessThan(TIER_LIMITS.crew.sms);
      expect(TIER_LIMITS.crew.sms).toBeLessThan(TIER_LIMITS.pro.sms);
    });

    it('pro tier should have highest SMS limit', () => {
      expect(TIER_LIMITS.pro.sms).toBe(500);
    });
  });

  describe('TIER_NAMES', () => {
    it('should have display names for all tiers', () => {
      expect(TIER_NAMES.free).toBe('Free');
      expect(TIER_NAMES.solo).toContain('Solo');
      expect(TIER_NAMES.crew).toContain('Crew');
      expect(TIER_NAMES.pro).toContain('Pro');
    });

    it('paid tier names should include price', () => {
      expect(TIER_NAMES.solo).toContain('$29');
      expect(TIER_NAMES.crew).toContain('$49');
      expect(TIER_NAMES.pro).toContain('$79');
    });
  });

  describe('getLimit', () => {
    it('should return correct limit for valid tier and usage type', () => {
      expect(getLimit('free', 'quotes')).toBe(5);
      expect(getLimit('solo', 'sms')).toBe(50);
      expect(getLimit('pro', 'jobs')).toBe(-1);
    });

    it('should fall back to free tier for unknown tier', () => {
      expect(getLimit('unknown' as SubscriptionTier, 'quotes')).toBe(5);
    });
  });

  describe('isUnlimited', () => {
    it('should return true for -1', () => {
      expect(isUnlimited(-1)).toBe(true);
    });

    it('should return false for positive numbers', () => {
      expect(isUnlimited(5)).toBe(false);
      expect(isUnlimited(0)).toBe(false);
      expect(isUnlimited(100)).toBe(false);
    });
  });

  describe('formatLimit', () => {
    it('should return "Unlimited" for -1', () => {
      expect(formatLimit(-1)).toBe('Unlimited');
    });

    it('should return string number for positive values', () => {
      expect(formatLimit(5)).toBe('5');
      expect(formatLimit(100)).toBe('100');
      expect(formatLimit(0)).toBe('0');
    });
  });
});
