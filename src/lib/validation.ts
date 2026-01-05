/**
 * Form Validation Utilities
 *
 * SECURITY: Provides comprehensive client-side validation
 * Note: Always perform server-side validation as well
 */

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
 * Australian phone number validation
 * Accepts: 04XX XXX XXX, 02 XXXX XXXX, etc.
 */
export function validateAustralianPhone(phone: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');

  // Australian phone numbers: 10 digits starting with 0
  if (digitsOnly.length !== 10) {
    return { valid: false, error: 'Phone number must be 10 digits' };
  }

  if (!digitsOnly.startsWith('0')) {
    return { valid: false, error: 'Australian phone numbers start with 0' };
  }

  // Validate area codes
  const validAreaCodes = ['02', '03', '04', '07', '08'];
  const areaCode = digitsOnly.substring(0, 2);

  if (!validAreaCodes.includes(areaCode)) {
    return { valid: false, error: 'Invalid Australian area code' };
  }

  return { valid: true };
}

/**
 * Australian BSB validation
 * Format: XXX-XXX (6 digits)
 */
export function validateBSB(bsb: string): ValidationResult {
  if (!bsb || bsb.trim() === '') {
    return { valid: false, error: 'BSB is required' };
  }

  // Remove hyphens and spaces
  const digitsOnly = bsb.replace(/[-\s]/g, '');

  if (digitsOnly.length !== 6) {
    return { valid: false, error: 'BSB must be 6 digits (format: XXX-XXX)' };
  }

  if (!/^\d{6}$/.test(digitsOnly)) {
    return { valid: false, error: 'BSB must contain only numbers' };
  }

  return { valid: true };
}

/**
 * Bank account number validation
 * Australian accounts: 4-10 digits
 */
export function validateBankAccountNumber(accountNumber: string): ValidationResult {
  if (!accountNumber || accountNumber.trim() === '') {
    return { valid: false, error: 'Account number is required' };
  }

  const digitsOnly = accountNumber.replace(/\D/g, '');

  if (digitsOnly.length < 4 || digitsOnly.length > 10) {
    return { valid: false, error: 'Account number must be 4-10 digits' };
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
 * Australian postcode validation
 */
export function validatePostcode(postcode: string): ValidationResult {
  if (!postcode || postcode.trim() === '') {
    return { valid: false, error: 'Postcode is required' };
  }

  const digitsOnly = postcode.replace(/\D/g, '');

  if (digitsOnly.length !== 4) {
    return { valid: false, error: 'Postcode must be 4 digits' };
  }

  const code = parseInt(digitsOnly, 10);

  // Australian postcodes range from 0200 to 9999
  if (code < 200 || code > 9999) {
    return { valid: false, error: 'Invalid Australian postcode' };
  }

  return { valid: true };
}

/**
 * ABN (Australian Business Number) validation
 */
export function validateABN(abn: string): ValidationResult {
  if (!abn || abn.trim() === '') {
    return { valid: false, error: 'ABN is required' };
  }

  // Remove spaces and non-digits
  const digitsOnly = abn.replace(/\D/g, '');

  if (digitsOnly.length !== 11) {
    return { valid: false, error: 'ABN must be 11 digits' };
  }

  // ABN checksum validation algorithm
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    const digit = parseInt(digitsOnly[i], 10);
    const weight = weights[i];

    // Subtract 1 from the first digit
    const value = (i === 0 ? digit - 1 : digit) * weight;
    sum += value;
  }

  if (sum % 89 !== 0) {
    return { valid: false, error: 'Invalid ABN checksum' };
  }

  return { valid: true };
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
