import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateAustralianPhone,
  validateBSB,
  validateBankAccountNumber,
  validateABN,
  validatePassword,
  validatePostcode,
  validateRequired,
  validateNumeric,
  validateURL,
  validateFutureDate,
  validateLength,
} from './validation';

describe('Email Validation', () => {
  it('should validate correct email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name@example.co.uk',
      'first+last@example.com',
      'user123@test-domain.com',
      'a@b.co',
    ];

    validEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject invalid email addresses', () => {
    const invalidEmails = [
      { email: '', shouldFail: true },
      { email: '   ', shouldFail: true },
      { email: 'notanemail', shouldFail: true },
      { email: '@example.com', shouldFail: true },
      { email: 'user@', shouldFail: true },
    ];

    invalidEmails.forEach(({ email, shouldFail }) => {
      const result = validateEmail(email);
      if (shouldFail) {
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  it('should reject email addresses that are too long', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const result = validateEmail(longEmail);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should handle edge cases', () => {
    expect(validateEmail('user+tag@example.com').valid).toBe(true);
    expect(validateEmail('user.name.long@sub.example.com').valid).toBe(true);
  });
});

describe('Australian Phone Validation', () => {
  it('should validate correct mobile numbers', () => {
    const validMobiles = [
      '0400123456',
      '0412 345 678',
      '0412-345-678',
      '04 1234 5678',
    ];

    validMobiles.forEach(phone => {
      const result = validateAustralianPhone(phone);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should validate correct landline numbers', () => {
    const validLandlines = [
      '0298765432',
      '02 9876 5432',
      '03 9123 4567',
      '07 3456 7890',
      '08 8234 5678',
    ];

    validLandlines.forEach(phone => {
      const result = validateAustralianPhone(phone);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject invalid phone numbers', () => {
    const invalidPhones = [
      '',
      '123456789',      // Too short
      '01234567890',    // Invalid area code
      '1234567890',     // Doesn't start with 0
      '0412345',        // Too short
      '04123456789',    // Too long
    ];

    invalidPhones.forEach(phone => {
      const result = validateAustralianPhone(phone);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should handle formatted phone numbers', () => {
    const result = validateAustralianPhone('(04) 1234-5678');
    expect(result.valid).toBe(true);
  });
});

describe('BSB Validation', () => {
  it('should validate correct BSB formats', () => {
    const validBSBs = [
      '062000',
      '062-000',
      '123-456',
      '123 456',
    ];

    validBSBs.forEach(bsb => {
      const result = validateBSB(bsb);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject invalid BSBs', () => {
    const invalidBSBs = [
      '',
      '12345',       // Too short
      '1234567',     // Too long
    ];

    invalidBSBs.forEach(bsb => {
      const result = validateBSB(bsb);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should reject BSB with non-numeric characters', () => {
    const result = validateBSB('abc-def');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('only numbers');
  });

  it('should handle different separators', () => {
    expect(validateBSB('062-000').valid).toBe(true);
    expect(validateBSB('062 000').valid).toBe(true);
    expect(validateBSB('062000').valid).toBe(true);
  });
});

describe('Bank Account Number Validation', () => {
  it('should validate correct account numbers', () => {
    const validAccounts = [
      '12345678',
      '123456',
      '1234567890',
    ];

    validAccounts.forEach(account => {
      const result = validateBankAccountNumber(account);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject invalid account numbers', () => {
    const invalidAccounts = [
      '',
      '123',          // Too short
      '12345678901',  // Too long
    ];

    invalidAccounts.forEach(account => {
      const result = validateBankAccountNumber(account);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('ABN Validation', () => {
  it('should validate correct ABN format', () => {
    // Using valid ABN with correct checksum
    // Real example: 51 824 753 556 (Australian Taxation Office)
    const validABNs = [
      '53 004 085 616', // Valid checksum
      '51824753556',    // Valid checksum (Telstra)
    ];

    validABNs.forEach(abn => {
      const result = validateABN(abn);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject invalid ABNs', () => {
    const invalidABNs = [
      '',
      '1234567890',   // Too short
      '123456789012', // Too long
      'abc def ghi jk', // Contains letters
    ];

    invalidABNs.forEach(abn => {
      const result = validateABN(abn);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should reject ABN with invalid checksum', () => {
    const result = validateABN('12345678901');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('checksum');
  });
});

describe('Password Validation', () => {
  it('should validate strong passwords', () => {
    const strongPasswords = [
      'MySecureP@ssw0rd',  // 12+ chars with all requirements
      'Tr@d1eM@te2026!',   // 15 chars
      'V3ryStr0ng!Pass',   // 14 chars
    ];

    strongPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject weak passwords', () => {
    const weakPasswords = [
      '',
      'pass',         // Too short
      'password',     // No uppercase, no number, no special
      'PASSWORD',     // No lowercase, no number, no special
      'Password',     // No number, no special
      'Password1',    // No special character
      'password1!',   // No uppercase
    ];

    weakPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should reject password that is too long', () => {
    const longPassword = 'A1!' + 'a'.repeat(130);
    const result = validatePassword(longPassword);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should provide helpful error messages', () => {
    expect(validatePassword('short').error).toContain('12 characters');
    expect(validatePassword('nouppercase1!').error).toContain('uppercase');
    expect(validatePassword('NOLOWERCASE1!').error).toContain('lowercase');
    expect(validatePassword('NoNumbersHere!').error).toContain('number');
    expect(validatePassword('NoSpecialChar1').error).toContain('special');
  });

  it('should reject common weak passwords', () => {
    const result = validatePassword('Password123!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too common');
  });
});

describe('Postcode Validation', () => {
  it('should validate correct Australian postcodes', () => {
    const validPostcodes = [
      '2000', // Sydney
      '3000', // Melbourne
      '4000', // Brisbane
      '6000', // Perth
      '5000', // Adelaide
    ];

    validPostcodes.forEach(postcode => {
      const result = validatePostcode(postcode);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject invalid postcodes', () => {
    const invalidPostcodes = [
      '',
      '123',      // Too short
      '12345',    // Too long
      'abcd',     // Not numbers
      '0000',     // Invalid postcode
    ];

    invalidPostcodes.forEach(postcode => {
      const result = validatePostcode(postcode);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should validate boundary postcodes', () => {
    expect(validatePostcode('0200').valid).toBe(true); // Minimum valid
    expect(validatePostcode('9999').valid).toBe(true); // Maximum valid
    expect(validatePostcode('0199').valid).toBe(false); // Below minimum
  });
});

describe('Required Field Validation', () => {
  it('should validate non-empty values', () => {
    const result = validateRequired('Hello World', 'Name');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject empty values', () => {
    const result = validateRequired('', 'Name');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name is required');
  });

  it('should reject whitespace-only values', () => {
    const result = validateRequired('   ', 'Email');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is required');
  });
});

describe('Numeric Validation', () => {
  it('should validate numeric values', () => {
    const result = validateNumeric('42', 'Quantity');
    expect(result.valid).toBe(true);
  });

  it('should validate decimal values', () => {
    const result = validateNumeric('3.14', 'Price');
    expect(result.valid).toBe(true);
  });

  it('should reject empty values', () => {
    const result = validateNumeric('', 'Amount');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Amount is required');
  });

  it('should reject non-numeric values', () => {
    const result = validateNumeric('abc', 'Price');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a number');
  });

  it('should enforce minimum value', () => {
    const result = validateNumeric('5', 'Quantity', 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 10');
  });

  it('should enforce maximum value', () => {
    const result = validateNumeric('100', 'Percentage', 0, 50);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most 50');
  });

  it('should accept value within range', () => {
    const result = validateNumeric('25', 'Score', 0, 100);
    expect(result.valid).toBe(true);
  });
});

describe('URL Validation', () => {
  it('should validate correct URLs', () => {
    const validUrls = [
      'https://example.com',
      'http://localhost:3000',
      'https://www.tradiemate.com.au/about',
      'http://192.168.1.1:8080/api',
    ];

    validUrls.forEach(url => {
      const result = validateURL(url);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject empty URL', () => {
    const result = validateURL('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL is required');
  });

  it('should reject invalid URLs', () => {
    const result = validateURL('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('valid URL');
  });

  it('should reject non-http protocols', () => {
    const result = validateURL('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('HTTP or HTTPS');
  });

  it('should reject javascript protocol (XSS prevention)', () => {
    const result = validateURL('javascript:alert(1)');
    expect(result.valid).toBe(false);
  });
});

describe('Future Date Validation', () => {
  it('should validate future dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const result = validateFutureDate(futureDate.toISOString(), 'Due Date');
    expect(result.valid).toBe(true);
  });

  it('should validate today as valid', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    const result = validateFutureDate(today.toISOString(), 'Due Date');
    expect(result.valid).toBe(true);
  });

  it('should reject empty date', () => {
    const result = validateFutureDate('', 'Due Date');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Due Date is required');
  });

  it('should reject past dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    const result = validateFutureDate(pastDate.toISOString(), 'Start Date');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be in the past');
  });
});

describe('Text Length Validation', () => {
  it('should validate text within length limits', () => {
    const result = validateLength('Hello', 'Message', 1, 10);
    expect(result.valid).toBe(true);
  });

  it('should reject text that is too short', () => {
    const result = validateLength('Hi', 'Description', 5, 100);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 5 characters');
  });

  it('should reject text that is too long', () => {
    const result = validateLength('This is a very long message', 'Title', 1, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most 10 characters');
  });

  it('should handle empty or null values', () => {
    const result = validateLength('', 'Notes', 0, 1000);
    expect(result.valid).toBe(true);
  });

  it('should handle exact boundary values', () => {
    expect(validateLength('12345', 'Code', 5, 5).valid).toBe(true);
    expect(validateLength('1234', 'Code', 5, 5).valid).toBe(false);
    expect(validateLength('123456', 'Code', 5, 5).valid).toBe(false);
  });
});

