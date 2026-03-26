import { describe, it, expect } from 'vitest';
import {
  checkPasswordStrength,
  isCommonPassword,
  getPasswordStrengthLabel,
  validatePassword,
} from './passwordSecurity';

// ---------------------------------------------------------------------------
// isCommonPassword
// ---------------------------------------------------------------------------

describe('isCommonPassword', () => {
  it('returns true for exact matches against the common-password list', () => {
    expect(isCommonPassword('password')).toBe(true);
    expect(isCommonPassword('123456')).toBe(true);
    expect(isCommonPassword('qwerty')).toBe(true);
    expect(isCommonPassword('admin')).toBe(true);
    expect(isCommonPassword('letmein')).toBe(true);
  });

  it('is case-insensitive — PASSWORD is also common', () => {
    expect(isCommonPassword('PASSWORD')).toBe(true);
    expect(isCommonPassword('Qwerty')).toBe(true);
  });

  it('returns true for common-password base with trailing digits', () => {
    // "password1" is in the list directly, but "password22" should also match
    // via the base-removal logic (strip trailing digits → "password" which is common)
    expect(isCommonPassword('password22')).toBe(true);
    expect(isCommonPassword('qwerty99')).toBe(true);
  });

  it('returns false for a strong, unique password', () => {
    expect(isCommonPassword('Xq7$mR!pL9@vZ')).toBe(false);
  });

  it('returns false for an arbitrary random string', () => {
    expect(isCommonPassword('correctHorseBatteryStaple')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkPasswordStrength
// ---------------------------------------------------------------------------

describe('checkPasswordStrength', () => {
  it('gives score 0 for a very short password', () => {
    const result = checkPasswordStrength('abc');
    expect(result.score).toBe(0);
    expect(result.isWeak).toBe(true);
    expect(result.meetsMinimumRequirements).toBe(false);
  });

  it('gives score 0 and isCommon=true for a known common password', () => {
    const result = checkPasswordStrength('password');
    expect(result.score).toBe(0);
    expect(result.isCommon).toBe(true);
    expect(result.isWeak).toBe(true);
  });

  it('includes feedback about minimum length for short passwords', () => {
    const result = checkPasswordStrength('hi');
    expect(result.feedback).toContain('Password should be at least 8 characters long');
  });

  it('adds feedback when uppercase letters are missing', () => {
    const result = checkPasswordStrength('alllowercase1');
    expect(result.feedback).toContain('Use both uppercase and lowercase letters');
  });

  it('adds feedback when no numbers are present', () => {
    const result = checkPasswordStrength('NoNumbers!Here');
    expect(result.feedback).toContain('Include at least one number');
  });

  it('adds feedback when no special characters are present', () => {
    const result = checkPasswordStrength('NoSpecials123');
    expect(result.feedback).toContain('Include at least one special character (!@#$%^&*)');
  });

  it('penalises sequential character patterns', () => {
    const result = checkPasswordStrength('123456');
    expect(result.feedback.some(f => f.includes('sequential'))).toBe(true);
  });

  it('penalises repeated-character passwords', () => {
    const result = checkPasswordStrength('aaaaaaaa');
    expect(result.feedback.some(f => f.includes('repeating'))).toBe(true);
  });

  it('penalises keyboard patterns like qwerty', () => {
    const result = checkPasswordStrength('qwertyABC1');
    expect(result.feedback.some(f => f.includes('keyboard'))).toBe(true);
  });

  it('gives a higher score for a longer mixed-case password with numbers', () => {
    const result = checkPasswordStrength('Tradie99secure');
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it('gives the maximum score (4) for a long, complex, unique password', () => {
    const result = checkPasswordStrength('Kx#9pM!qR7@vZw2T');
    expect(result.score).toBe(4);
    expect(result.isWeak).toBe(false);
  });

  it('score is always in the 0-4 range', () => {
    const passwords = [
      '',
      'a',
      'aaaaaaaaaa',
      '123456',
      'Password1!',
      'Kx#9pM!qR7@vZw2T',
      'a'.repeat(100),
    ];
    passwords.forEach(pw => {
      const { score } = checkPasswordStrength(pw);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    });
  });

  it('meetsMinimumRequirements is true only when length>=8, has upper+lower+digit, not common', () => {
    expect(checkPasswordStrength('Tradie99secure').meetsMinimumRequirements).toBe(true);
    // Missing uppercase
    expect(checkPasswordStrength('tradie99secure').meetsMinimumRequirements).toBe(false);
    // Missing digit
    expect(checkPasswordStrength('TradieSecurity').meetsMinimumRequirements).toBe(false);
    // Too short
    expect(checkPasswordStrength('Tr1!').meetsMinimumRequirements).toBe(false);
    // Common password
    expect(checkPasswordStrength('Password1').meetsMinimumRequirements).toBe(false);
  });

  it('handles an empty string without throwing', () => {
    expect(() => checkPasswordStrength('')).not.toThrow();
    const result = checkPasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.isWeak).toBe(true);
  });

  it('handles a very long password without throwing', () => {
    const longPassword = 'Aa1!' + 'x'.repeat(200);
    expect(() => checkPasswordStrength(longPassword)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getPasswordStrengthLabel
// ---------------------------------------------------------------------------

describe('getPasswordStrengthLabel', () => {
  it('returns "Very Weak" for score 0', () => {
    expect(getPasswordStrengthLabel(0)).toBe('Very Weak');
  });

  it('returns "Weak" for score 1', () => {
    expect(getPasswordStrengthLabel(1)).toBe('Weak');
  });

  it('returns "Fair" for score 2', () => {
    expect(getPasswordStrengthLabel(2)).toBe('Fair');
  });

  it('returns "Good" for score 3', () => {
    expect(getPasswordStrengthLabel(3)).toBe('Good');
  });

  it('returns "Strong" for score 4', () => {
    expect(getPasswordStrengthLabel(4)).toBe('Strong');
  });

  it('returns "Unknown" for an out-of-range score', () => {
    expect(getPasswordStrengthLabel(99)).toBe('Unknown');
    expect(getPasswordStrengthLabel(-1)).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe('validatePassword', () => {
  it('returns valid=true for a password meeting all requirements', () => {
    const result = validatePassword('Tradie99secure');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns an error when password is too short', () => {
    const result = validatePassword('Sh0rt!');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('8 characters'))).toBe(true);
  });

  it('returns an error when there is no lowercase letter', () => {
    const result = validatePassword('ALLCAPS123');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
  });

  it('returns an error when there is no uppercase letter', () => {
    const result = validatePassword('alllower123');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
  });

  it('returns an error when there is no number', () => {
    const result = validatePassword('NoDigitsHere');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('number'))).toBe(true);
  });

  it('returns an error for a common password even if it looks strong enough', () => {
    // "password123" meets length/case requirements but is common
    const result = validatePassword('password123');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('common'))).toBe(true);
  });

  it('accumulates multiple errors at once', () => {
    // Short + no uppercase + no number
    const result = validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('handles an empty string without throwing', () => {
    expect(() => validatePassword('')).not.toThrow();
    const result = validatePassword('');
    expect(result.valid).toBe(false);
  });

  it('handles unicode in password without throwing', () => {
    expect(() => validatePassword('Ünïcödé1')).not.toThrow();
  });
});
