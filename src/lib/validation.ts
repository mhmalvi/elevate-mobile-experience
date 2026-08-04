/**
 * Form Validation Utilities
 *
 * SECURITY: Provides comprehensive client-side validation
 * Note: Always perform server-side validation as well
 */

import { getCountry } from './countries';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Email validation with RFC 5322 compliance
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email address is too long (max 254 characters)' };
  }

  return { valid: true };
}

/**
 * Phone number validation.
 *
 * The previous implementation required exactly 10 digits starting with `0` and
 * one of the AU area codes 02/03/04/07/08 — it rejected every non-Australian
 * number outright, including numbers users were already saving.
 *
 * Phone numbering plans vary too much to validate strictly and safely across
 * countries, and a false rejection is worse than a permissive accept here: the
 * number is for a human to dial, not for the app to parse. So this checks
 * plausibility (length, characters) and only applies strict national rules for
 * the country in question when we're confident about them.
 *
 * @param countryCode ISO 3166-1 alpha-2. Omit for a permissive international check.
 */
export function validatePhone(phone: string, countryCode?: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Phone number is required' };
  }

  const trimmed = phone.trim();

  // Allow digits, spaces, and the usual separators plus a leading +.
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) {
    return { valid: false, error: 'Phone number contains invalid characters' };
  }

  const digitsOnly = trimmed.replace(/\D/g, '');

  // E.164 caps the total at 15 digits; nothing real is shorter than about 5.
  if (digitsOnly.length < 5) {
    return { valid: false, error: 'Phone number is too short' };
  }
  if (digitsOnly.length > 15) {
    return { valid: false, error: 'Phone number is too long' };
  }

  // National rules, applied only to locally-formatted numbers (no + prefix).
  // An international number for any country is accepted by the checks above.
  if (!trimmed.startsWith('+') && countryCode) {
    switch (countryCode.toUpperCase()) {
      case 'AU': {
        if (digitsOnly.length !== 10 || !digitsOnly.startsWith('0')) {
          return { valid: false, error: 'Australian numbers are 10 digits starting with 0' };
        }
        const validAreaCodes = ['02', '03', '04', '07', '08'];
        if (!validAreaCodes.includes(digitsOnly.substring(0, 2))) {
          return { valid: false, error: 'Invalid Australian area code' };
        }
        break;
      }
      case 'US':
      case 'CA': {
        // 10 digits, or 11 with the leading country code 1.
        const national = digitsOnly.length === 11 && digitsOnly.startsWith('1')
          ? digitsOnly.slice(1)
          : digitsOnly;
        if (national.length !== 10) {
          return { valid: false, error: 'Phone number must be 10 digits' };
        }
        // Area code and exchange cannot start with 0 or 1.
        if (/^[01]/.test(national) || /^[01]/.test(national.slice(3))) {
          return { valid: false, error: 'Invalid area code' };
        }
        break;
      }
      case 'NZ': {
        if (digitsOnly.length < 8 || digitsOnly.length > 11) {
          return { valid: false, error: 'New Zealand numbers are 8–11 digits' };
        }
        break;
      }
      case 'GB': {
        if (digitsOnly.length < 10 || digitsOnly.length > 11) {
          return { valid: false, error: 'UK numbers are 10 or 11 digits' };
        }
        break;
      }
      case 'IN': {
        if (digitsOnly.length !== 10 || !/^[6-9]/.test(digitsOnly)) {
          return { valid: false, error: 'Indian mobile numbers are 10 digits starting 6–9' };
        }
        break;
      }
      // Everything else falls through to the permissive check above.
    }
  }

  return { valid: true };
}

/**
 * @deprecated Use `validatePhone(phone, 'AU')`. Kept so existing call sites and
 * tests keep working while they migrate.
 */
export function validateAustralianPhone(phone: string): ValidationResult {
  return validatePhone(phone, 'AU');
}

/**
 * Bank routing identifier validation.
 *
 * Every country calls this something different and formats it differently:
 * BSB (AU, 6 digits), sort code (GB, 6 digits), routing number (US, 9 digits),
 * transit number (CA, 5), IFSC (IN, 11 alphanumeric), IBAN (EU, up to 34).
 *
 * @param countryCode ISO 3166-1 alpha-2. Omit for a permissive check.
 */
export function validateBankRouting(value: string, countryCode?: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: false, error: 'This field is required' };
  }

  const cleaned = value.replace(/[-\s]/g, '').toUpperCase();

  switch (countryCode?.toUpperCase()) {
    case 'AU':
      // Distinguish "wrong characters" from "wrong length" — telling someone
      // their 6-character entry "must be 6 digits" is not actionable.
      if (/\D/.test(cleaned)) {
        return { valid: false, error: 'BSB must contain only numbers' };
      }
      if (cleaned.length !== 6) {
        return { valid: false, error: 'BSB must be 6 digits (format: XXX-XXX)' };
      }
      return { valid: true };
    case 'GB':
      if (/\D/.test(cleaned)) {
        return { valid: false, error: 'Sort code must contain only numbers' };
      }
      if (cleaned.length !== 6) {
        return { valid: false, error: 'Sort code must be 6 digits (format: XX-XX-XX)' };
      }
      return { valid: true };
    case 'US':
      if (!/^\d{9}$/.test(cleaned)) {
        return { valid: false, error: 'Routing number must be 9 digits' };
      }
      return { valid: true };
    case 'CA':
      if (!/^\d{5}$/.test(cleaned) && !/^\d{8}$/.test(cleaned)) {
        return { valid: false, error: 'Transit number must be 5 digits (or 8 with institution)' };
      }
      return { valid: true };
    case 'IN':
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned)) {
        return { valid: false, error: 'IFSC code must be 11 characters (e.g. HDFC0001234)' };
      }
      return { valid: true };
    case 'IE':
    case 'DE':
    case 'FR':
    case 'NL':
    case 'AE':
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned)) {
        return { valid: false, error: 'Enter a valid IBAN' };
      }
      return { valid: true };
    default:
      if (cleaned.length < 4 || cleaned.length > 34) {
        return { valid: false, error: 'Enter a valid bank routing code' };
      }
      return { valid: true };
  }
}

/** @deprecated Use `validateBankRouting(value, 'AU')`. */
export function validateBSB(bsb: string): ValidationResult {
  return validateBankRouting(bsb, 'AU');
}

/**
 * Bank account number validation.
 *
 * Account number lengths vary widely (AU 4–10, US 4–17, GB 8, IN up to 18), and
 * some countries use an IBAN in place of a separate account number. Accept a
 * broad alphanumeric range rather than rejecting valid foreign accounts.
 */
export function validateBankAccountNumber(
  accountNumber: string,
  countryCode?: string,
): ValidationResult {
  if (!accountNumber || accountNumber.trim() === '') {
    return { valid: false, error: 'Account number is required' };
  }

  const cleaned = accountNumber.replace(/[-\s]/g, '');

  if (countryCode?.toUpperCase() === 'AU') {
    if (!/^\d{4,10}$/.test(cleaned)) {
      return { valid: false, error: 'Account number must be 4-10 digits' };
    }
    return { valid: true };
  }

  if (!/^[A-Za-z0-9]{4,34}$/.test(cleaned)) {
    return { valid: false, error: 'Enter a valid account number' };
  }

  return { valid: true };
}

/**
 * Password validation with strong security requirements
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  // Check for at least one special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  // Check for common weak passwords
  const weakPasswords = [
    'password123!', 'Password123!', 'Admin123!', 'Welcome123!',
    'P@ssword123', 'Password1!', 'Qwerty123!', '12345678!Aa'
  ];

  if (weakPasswords.includes(password)) {
    return { valid: false, error: 'This password is too common. Please choose a stronger password' };
  }

  return { valid: true };
}

/**
 * Postcode / ZIP / postal code validation.
 *
 * Previously hardcoded to Australia's 4 digits in the range 0200–9999, which
 * rejected UK `SW1A 1AA`, US `90210-1234`, Canadian `M5V 3L9` and India's
 * 6-digit PIN codes. The per-country patterns live in `@/lib/countries` so the
 * label, placeholder and validation stay in one place.
 *
 * @param countryCode ISO 3166-1 alpha-2. Unknown countries accept any non-empty value.
 */
export function validatePostcode(postcode: string, countryCode?: string): ValidationResult {
  if (!postcode || postcode.trim() === '') {
    return { valid: false, error: 'Postcode is required' };
  }

  const country = getCountry(countryCode);
  const normalised = postcode.trim().toUpperCase();

  if (!country.postcodePattern) {
    // We hold no pattern for this country — accept anything plausible rather
    // than inventing a rule and blocking a legitimate address.
    return normalised.length <= 12
      ? { valid: true }
      : { valid: false, error: `${country.postcodeLabel} is too long` };
  }

  if (!country.postcodePattern.test(normalised)) {
    return {
      valid: false,
      error: `Enter a valid ${country.postcodeLabel} (e.g. ${country.postcodePlaceholder})`,
    };
  }

  // AU postcodes are 4 digits but not every 4-digit number is one.
  if (country.code === 'AU') {
    const code = parseInt(normalised, 10);
    if (code < 200 || code > 9999) {
      return { valid: false, error: 'Invalid Australian postcode' };
    }
  }

  return { valid: true };
}

/**
 * Government business identifier validation.
 *
 * Only Australia gets a checksum here — the ABN algorithm is well defined and
 * catches typos. Other countries' identifiers are format-checked at most,
 * because a wrong-but-plausible rule would block real businesses from
 * onboarding, which is a far worse failure than accepting a typo in a field
 * that only ever gets printed on a document.
 *
 * @param countryCode ISO 3166-1 alpha-2.
 */
export function validateBusinessNumber(
  value: string,
  countryCode?: string,
): ValidationResult {
  const country = getCountry(countryCode);

  if (!value || value.trim() === '') {
    return { valid: false, error: `${country.businessNumberLabel} is required` };
  }

  const cleaned = value.replace(/[\s-]/g, '').toUpperCase();

  switch (country.code) {
    case 'AU': {
      const digitsOnly = cleaned.replace(/\D/g, '');
      if (digitsOnly.length !== 11) {
        return { valid: false, error: 'ABN must be 11 digits' };
      }
      // ABN checksum: subtract 1 from the first digit, apply weights, mod 89.
      const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
      let sum = 0;
      for (let i = 0; i < 11; i++) {
        const digit = parseInt(digitsOnly[i], 10);
        sum += (i === 0 ? digit - 1 : digit) * weights[i];
      }
      if (sum % 89 !== 0) {
        return { valid: false, error: 'Invalid ABN checksum' };
      }
      return { valid: true };
    }
    case 'US':
      // EIN: 9 digits, conventionally written XX-XXXXXXX.
      if (!/^\d{9}$/.test(cleaned)) {
        return { valid: false, error: 'EIN must be 9 digits (e.g. 12-3456789)' };
      }
      return { valid: true };
    case 'GB':
      // Companies House numbers: 8 chars, either 8 digits or 2 letters + 6 digits.
      if (!/^(\d{8}|[A-Z]{2}\d{6})$/.test(cleaned)) {
        return { valid: false, error: 'Company number must be 8 characters' };
      }
      return { valid: true };
    case 'IN':
      // GSTIN: 15 chars, state code + PAN + entity + Z + checksum.
      if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(cleaned)) {
        return { valid: false, error: 'GSTIN must be 15 characters (e.g. 22AAAAA0000A1Z5)' };
      }
      return { valid: true };
    case 'NZ':
      if (!/^\d{13}$/.test(cleaned)) {
        return { valid: false, error: 'NZBN must be 13 digits' };
      }
      return { valid: true };
    default:
      if (cleaned.length < 4 || cleaned.length > 20) {
        return { valid: false, error: `Enter a valid ${country.businessNumberLabel}` };
      }
      return { valid: true };
  }
}

/** @deprecated Use `validateBusinessNumber(value, 'AU')`. */
export function validateABN(abn: string): ValidationResult {
  return validateBusinessNumber(abn, 'AU');
}

/**
 * Required field validation
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  return { valid: true };
}

/**
 * Numeric validation
 */
export function validateNumeric(value: string, fieldName: string, min?: number, max?: number): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = parseFloat(value);

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, error: `${fieldName} must be at most ${max}` };
  }

  return { valid: true };
}

/**
 * URL validation
 */
export function validateURL(url: string): ValidationResult {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);

    // Ensure it's http or https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Please enter a valid URL' };
  }
}

/**
 * Date validation (not in the past)
 */
export function validateFutureDate(date: string, fieldName: string): ValidationResult {
  if (!date || date.trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    return { valid: false, error: `${fieldName} cannot be in the past` };
  }

  return { valid: true };
}

/**
 * Text length validation
 */
export function validateLength(value: string, fieldName: string, min: number, max: number): ValidationResult {
  if (!value) {
    value = '';
  }

  if (value.length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters` };
  }

  if (value.length > max) {
    return { valid: false, error: `${fieldName} must be at most ${max} characters` };
  }

  return { valid: true };
}
