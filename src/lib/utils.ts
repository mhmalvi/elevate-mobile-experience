import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely convert any value to a number, defaulting to 0 for invalid values
 * Handles: null, undefined, NaN, empty strings, non-numeric strings
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const num = typeof value === 'number' ? value : Number(value);

  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }

  return num;
}

/**
 * Format a currency value safely, handling NaN/null/undefined
 * Returns a string like "$1,234.56" or "$0.00" for invalid inputs
 */
export function formatCurrency(value: unknown, defaultValue: number = 0): string {
  const num = safeNumber(value, defaultValue);
  return `$${num.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Format a number safely for display, handling NaN/null/undefined
 */
export function formatNumber(value: unknown, defaultValue: number = 0): string {
  const num = safeNumber(value, defaultValue);
  return num.toLocaleString('en-AU');
}
