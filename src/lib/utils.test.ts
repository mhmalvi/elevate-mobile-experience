import { describe, it, expect } from 'vitest';
import { cn, safeNumber, formatCurrency, formatNumber } from './utils';

describe('utils', () => {
  describe('safeNumber', () => {
    it('should return the number for valid numbers', () => {
      expect(safeNumber(123)).toBe(123);
      expect(safeNumber(0)).toBe(0);
      expect(safeNumber(-456.78)).toBe(-456.78);
    });

    it('should return default value for null/undefined', () => {
      expect(safeNumber(null)).toBe(0);
      expect(safeNumber(undefined)).toBe(0);
      expect(safeNumber(null, 100)).toBe(100);
    });

    it('should return default value for NaN', () => {
      expect(safeNumber(NaN)).toBe(0);
      expect(safeNumber('not a number')).toBe(0);
    });

    it('should convert string numbers', () => {
      expect(safeNumber('123')).toBe(123);
      expect(safeNumber('45.67')).toBe(45.67);
    });

    it('should return default value for empty string', () => {
      expect(safeNumber('')).toBe(0);
    });

    it('should return default value for Infinity', () => {
      expect(safeNumber(Infinity)).toBe(0);
      expect(safeNumber(-Infinity)).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format valid numbers as currency', () => {
      expect(formatCurrency(1234)).toBe('$1,234');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0');
    });

    it('should handle null/undefined/NaN gracefully', () => {
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
      expect(formatCurrency(NaN)).toBe('$0');
    });

    it('should handle string numbers', () => {
      expect(formatCurrency('999.99')).toBe('$999.99');
    });
  });

  describe('formatNumber', () => {
    it('should format valid numbers with locale', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should handle null/undefined/NaN gracefully', () => {
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
      expect(formatNumber(NaN)).toBe('0');
    });
  });

  describe('cn (className merger)', () => {
    it('should merge class names correctly', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('foo', false && 'bar', 'baz');
      expect(result).toBe('foo baz');
    });

    it('should handle undefined and null values', () => {
      const result = cn('foo', undefined, null, 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['foo', 'bar'], 'baz');
      expect(result).toBe('foo bar baz');
    });

    it('should merge tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4');
      // Should keep last px value due to tailwind-merge
      expect(result).toContain('px-4');
      expect(result).toContain('py-1');
    });
  });
});
