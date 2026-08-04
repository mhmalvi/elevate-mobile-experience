/**
 * Currency, tax and locale-aware formatting.
 *
 * Replaces the previous `formatCurrency`, which hardcoded both the symbol and
 * the locale:
 *
 *     return `$${num.toLocaleString('en-AU', …)}`;
 *
 * so a UK, German or Indian user saw their revenue denominated in `$`, and the
 * separate `create-payment` edge function charged their clients in AUD.
 *
 * WHY A MODULE-LEVEL SETTINGS OBJECT
 * ----------------------------------
 * Formatting is called from ~25 sites, many of them deep in presentational
 * components with no access to the profile. Threading currency through all of
 * them would be a large, noisy change for no benefit: exactly one business is
 * ever active in a session. So the settings are published once when the profile
 * loads (see `useLocaleSettings`) and read synchronously here.
 *
 * The defaults below are deliberately neutral rather than Australian — if the
 * profile hasn't loaded yet we'd rather show a plain number than assert the
 * wrong currency.
 */

import { getCountry, type CountryConfig } from './countries';

export interface LocaleSettings {
  /** ISO 4217, e.g. 'AUD', 'GBP' */
  currency: string;
  /** BCP-47, e.g. 'en-AU'. Drives grouping, decimal separator and date order. */
  locale: string;
  /** Decimal fraction, e.g. 0.2 = 20% */
  taxRate: number;
  /** 'GST' | 'VAT' | 'Sales Tax' | … */
  taxLabel: string;
  /** Whether entered prices already include tax */
  taxInclusive: boolean;
  countryCode: string;
}

const DEFAULTS: LocaleSettings = {
  currency: 'AUD',
  locale: 'en-AU',
  taxRate: 0.1,
  taxLabel: 'GST',
  taxInclusive: false,
  countryCode: 'AU',
};

let active: LocaleSettings = { ...DEFAULTS };

/** Publish the signed-in business's settings. Called once the profile loads. */
export function setLocaleSettings(next: Partial<LocaleSettings>): void {
  active = { ...active, ...next };
}

export function getLocaleSettings(): LocaleSettings {
  return active;
}

/** Reset to defaults — used on sign-out and in tests. */
export function resetLocaleSettings(): void {
  active = { ...DEFAULTS };
}

/** Derive settings from a country config, for onboarding previews. */
export function settingsFromCountry(country: CountryConfig): LocaleSettings {
  return {
    currency: country.currency,
    locale: country.locale,
    taxRate: country.taxRate,
    taxLabel: country.taxLabel,
    taxInclusive: country.taxInclusivePricing,
    countryCode: country.code,
  };
}

export function settingsFromCountryCode(code: string | null | undefined): LocaleSettings {
  return settingsFromCountry(getCountry(code));
}

// -------------------------------------------------------------------- numbers

/**
 * Safely convert any value to a number, defaulting to 0 for invalid values.
 * Handles: null, undefined, NaN, empty strings, non-numeric strings.
 */
export function safeNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return num;
}

/**
 * Format a monetary value in the active currency and locale.
 *
 * Uses Intl so the symbol, its position and the separators are all correct for
 * the locale — `1.234,56 €` in German, `₹1,23,456.78` in Indian English.
 */
export function formatCurrency(
  value: unknown,
  opts: { defaultValue?: number; currency?: string; locale?: string } = {},
): string {
  const num = safeNumber(value, opts.defaultValue ?? 0);
  const currency = opts.currency ?? active.currency;
  const locale = opts.locale ?? active.locale;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // Whole amounts read better without trailing zeros on a phone, but any
      // fractional part must survive.
      minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    // Unknown currency or locale — never throw inside a render.
    return `${currency} ${num.toFixed(2)}`;
  }
}

/** Format a plain number in the active locale. */
export function formatNumber(value: unknown, defaultValue = 0): string {
  const num = safeNumber(value, defaultValue);
  try {
    return new Intl.NumberFormat(active.locale).format(num);
  } catch {
    return String(num);
  }
}

/** The bare currency symbol, for compact contexts like input adornments. */
export function currencySymbol(currency = active.currency, locale = active.locale): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

// ------------------------------------------------------------------------ tax

export interface TaxBreakdown {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Split a set of line-item amounts into subtotal / tax / total.
 *
 * Replaces `const gst = subtotal * 0.1` duplicated across InvoiceForm,
 * QuoteForm, QuoteEdit and JobDetail.
 *
 * Handles both conventions, which differ by market and materially change the
 * arithmetic:
 *   * tax-INCLUSIVE (AU, UK, EU): the entered price already contains tax, so
 *     tax = gross - gross / (1 + rate)
 *   * tax-EXCLUSIVE (US, CA):     tax is added on top, so tax = net * rate
 */
export function calculateTax(
  lineItemsTotal: unknown,
  opts: { rate?: number; inclusive?: boolean } = {},
): TaxBreakdown {
  const gross = safeNumber(lineItemsTotal);
  const rate = opts.rate ?? active.taxRate;
  const inclusive = opts.inclusive ?? active.taxInclusive;

  if (!rate || rate <= 0) {
    return { subtotal: round2(gross), tax: 0, total: round2(gross) };
  }

  if (inclusive) {
    const subtotal = gross / (1 + rate);
    return {
      subtotal: round2(subtotal),
      tax: round2(gross - subtotal),
      total: round2(gross),
    };
  }

  const tax = gross * rate;
  return {
    subtotal: round2(gross),
    tax: round2(tax),
    total: round2(gross + tax),
  };
}

/** e.g. "GST (10%)" — the label shown next to a tax line. */
export function taxLineLabel(opts: { rate?: number; label?: string } = {}): string {
  const rate = opts.rate ?? active.taxRate;
  const label = opts.label ?? active.taxLabel;
  if (!rate || rate <= 0) return label;
  // Trim trailing zeros: 0.1 -> "10%", 0.175 -> "17.5%"
  const pct = parseFloat((rate * 100).toFixed(2));
  return `${label} (${pct}%)`;
}

function round2(n: number): number {
  // Money must not accumulate binary float error across subtotal/tax/total.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ----------------------------------------------------------------------- dates

/**
 * Format a date in the active locale.
 *
 * The codebase mixed day-first (`dd MMM yyyy`, 11 sites) and month-first
 * (`MMM d, yyyy`, 3 sites) formats, so two dates on the same screen could
 * disagree about what 03/04 means. Intl removes the choice.
 */
export function formatDate(
  value: string | Date | null | undefined,
  style: 'short' | 'medium' | 'long' = 'medium',
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'long'
        ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric' };

  try {
    return new Intl.DateTimeFormat(active.locale, options).format(date);
  } catch {
    return date.toDateString();
  }
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(active.locale, {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
