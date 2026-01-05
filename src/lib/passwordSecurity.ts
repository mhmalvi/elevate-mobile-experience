/**
 * Password Security Utilities
 *
 * Implements password strength checking and common password detection
 * as an alternative to Supabase Pro's HIBP integration
 */

// Common passwords list (top 1000 most common)
// Source: https://github.com/danielmiessler/SecLists
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', '123123', '654321', 'superman',
  'qazwsx', 'michael', 'football', 'welcome', 'jesus', 'ninja', 'mustang',
  'password1', '123456789', 'starwars', 'admin', 'password123', 'solo', 'welcome1',
  // Add more common passwords as needed
]);

// Common patterns
const SEQUENTIAL_PATTERNS = /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789)+$/i;
const REPEATED_CHARS = /^(.)\1+$/; // All same character
const KEYBOARD_PATTERNS = /(qwerty|asdfgh|zxcvbn|qwertyuiop|asdfghjkl|zxcvbnm)/i;

export interface PasswordStrength {
  score: number; // 0-4 (0=very weak, 4=very strong)
  feedback: string[];
  isCommon: boolean;
  isWeak: boolean;
  meetsMinimumRequirements: boolean;
}

/**
 * Check if password is in common passwords list
 */
export function isCommonPassword(password: string): boolean {
  const lowerPassword = password.toLowerCase();

  // Check exact match
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    return true;
  }

  // Check common variations (with numbers at end)
  const basePassword = lowerPassword.replace(/\d+$/, '');
  if (COMMON_PASSWORDS.has(basePassword)) {
    return true;
  }

  return false;
}

/**
 * Check password strength and provide feedback
 */
export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    feedback.push('Password should be at least 8 characters long');
  } else if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Character diversity checks
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLowerCase && hasUpperCase) {
    score += 1;
  } else {
    feedback.push('Use both uppercase and lowercase letters');
  }

  if (hasNumbers) {
    score += 0.5;
  } else {
    feedback.push('Include at least one number');
  }

  if (hasSpecialChars) {
    score += 0.5;
  } else {
    feedback.push('Include at least one special character (!@#$%^&*)');
  }

  // Pattern checks
  if (SEQUENTIAL_PATTERNS.test(password)) {
    score -= 1;
    feedback.push('Avoid sequential characters (abc, 123, etc.)');
  }

  if (REPEATED_CHARS.test(password)) {
    score -= 2;
    feedback.push('Avoid repeating the same character');
  }

  if (KEYBOARD_PATTERNS.test(password)) {
    score -= 1;
    feedback.push('Avoid keyboard patterns (qwerty, asdfgh, etc.)');
  }

  // Common password check
  const isCommon = isCommonPassword(password);
  if (isCommon) {
    score = 0; // Force to weakest score
    feedback.push('⚠️ This is a commonly used password. Choose something unique!');
  }

  // Normalize score to 0-4 range
  score = Math.max(0, Math.min(4, Math.floor(score)));

  // Minimum requirements (for form validation)
  const meetsMinimumRequirements =
    password.length >= 8 &&
    hasLowerCase &&
    hasUpperCase &&
    hasNumbers &&
    !isCommon;

  // Determine if weak
  const isWeak = score < 2 || isCommon;

  return {
    score,
    feedback,
    isCommon,
    isWeak,
    meetsMinimumRequirements,
  };
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very Weak';
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Strong';
    default:
      return 'Unknown';
  }
}

/**
 * Get password strength color (for UI indicators)
 */
export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
      return 'red';
    case 1:
      return 'orange';
    case 2:
      return 'yellow';
    case 3:
      return 'lightgreen';
    case 4:
      return 'green';
    default:
      return 'gray';
  }
}

/**
 * Validate password against security requirements
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (isCommonPassword(password)) {
    errors.push('This password is too common. Please choose a more unique password');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
