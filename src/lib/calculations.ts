/**
 * Financial calculation utilities for quotes and invoices.
 * All monetary values are in AUD. GST rate is 10%.
 */

const GST_RATE = 0.1;

/**
 * Calculate the GST (10%) on a given amount, rounded to 2 decimal places.
 */
export function calculateGST(amount: number): number {
  return Math.round(amount * GST_RATE * 100) / 100;
}

/**
 * Calculate the grand total (subtotal + GST), rounded to 2 decimal places.
 */
export function calculateTotal(subtotal: number, gst: number): number {
  return Math.round((subtotal + gst) * 100) / 100;
}

/**
 * Calculate the line item total (quantity × rate), rounded to 2 decimal places.
 */
export function calculateLineTotal(quantity: number, rate: number): number {
  return Math.round(quantity * rate * 100) / 100;
}

/**
 * Calculate the outstanding invoice balance (total − amount paid),
 * rounded to 2 decimal places. Negative values indicate overpayment.
 */
export function calculateBalance(total: number, amountPaid: number): number {
  return Math.round((total - amountPaid) * 100) / 100;
}

/**
 * Apply a percentage discount to an amount, rounded to 2 decimal places.
 */
export function applyDiscount(amount: number, discountPercent: number): number {
  const discount = (amount * discountPercent) / 100;
  return Math.round((amount - discount) * 100) / 100;
}

/**
 * Calculate an hourly total (hours × rate), rounded to 2 decimal places.
 */
export function calculateHourlyTotal(hours: number, rate: number): number {
  return Math.round(hours * rate * 100) / 100;
}

/**
 * Calculate a deposit amount from a total and a deposit percentage,
 * rounded to 2 decimal places.
 */
export function calculateDeposit(total: number, depositPercent: number): number {
  return Math.round((total * depositPercent) / 100 * 100) / 100;
}

/**
 * Add a number of days to a date and return the resulting Date.
 */
export function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
