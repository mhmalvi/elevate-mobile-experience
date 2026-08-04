/**
 * Country reference data.
 *
 * The app was Australia-only: 10% GST, AUD, ABN, 4-digit postcodes and
 * `0X XXXX XXXX` phone numbers were all hardcoded. Country is the single input
 * everything else derives from, so it lives here rather than being scattered.
 *
 * SCOPE NOTE — sales tax is genuinely not a single number in some countries:
 *   * US   sales tax varies by state AND county, and most states do not tax
 *          services at all. The rate below is 0 and the user is expected to
 *          set their own; treating it as one national rate would be wrong.
 *   * IN   GST is banded (5/12/18/28%) by category of supply.
 *   * CA   GST is federal, PST/HST is provincial.
 * For those, `taxRate` is a starting point the user can override in Settings,
 * not an authority. `taxRateIsAdvisory` marks them so the UI can say so.
 */

export interface CountryConfig {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** ISO 4217 */
  currency: string;
  /** BCP-47, used for number/date formatting and speech recognition defaults */
  locale: string;
  /** Decimal fraction, e.g. 0.2 = 20% */
  taxRate: number;
  /** What this country calls sales tax */
  taxLabel: string;
  /** True when taxRate cannot be a single national number — UI should prompt the user */
  taxRateIsAdvisory?: boolean;
  /** Whether entered prices conventionally include tax */
  taxInclusivePricing: boolean;
  /** Local name for the government business identifier */
  businessNumberLabel: string;
  businessNumberPlaceholder: string;
  /** Local name for the bank routing identifier */
  bankRoutingLabel: string;
  phonePlaceholder: string;
  /** E.164 calling code, used to normalise stored numbers */
  callingCode: string;
  postcodeLabel: string;
  postcodePlaceholder: string;
  /** Validates a postcode after whitespace/case normalisation. Omit to accept anything non-empty. */
  postcodePattern?: RegExp;
}

export const COUNTRIES: CountryConfig[] = [
  {
    code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU',
    taxRate: 0.1, taxLabel: 'GST', taxInclusivePricing: false,
    businessNumberLabel: 'ABN', businessNumberPlaceholder: '12 345 678 901',
    bankRoutingLabel: 'BSB',
    phonePlaceholder: '0412 345 678', callingCode: '+61',
    postcodeLabel: 'Postcode', postcodePlaceholder: '2000',
    postcodePattern: /^\d{4}$/,
  },
  {
    code: 'NZ', name: 'New Zealand', currency: 'NZD', locale: 'en-NZ',
    taxRate: 0.15, taxLabel: 'GST', taxInclusivePricing: false,
    businessNumberLabel: 'NZBN', businessNumberPlaceholder: '9429000000000',
    bankRoutingLabel: 'Bank/Branch',
    phonePlaceholder: '021 123 4567', callingCode: '+64',
    postcodeLabel: 'Postcode', postcodePlaceholder: '1010',
    postcodePattern: /^\d{4}$/,
  },
  {
    code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB',
    taxRate: 0.2, taxLabel: 'VAT', taxInclusivePricing: false,
    businessNumberLabel: 'Company number', businessNumberPlaceholder: '12345678',
    bankRoutingLabel: 'Sort code',
    phonePlaceholder: '07700 900123', callingCode: '+44',
    postcodeLabel: 'Postcode', postcodePlaceholder: 'SW1A 1AA',
    postcodePattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/,
  },
  {
    code: 'IE', name: 'Ireland', currency: 'EUR', locale: 'en-IE',
    taxRate: 0.23, taxLabel: 'VAT', taxInclusivePricing: false,
    businessNumberLabel: 'VAT number', businessNumberPlaceholder: 'IE1234567X',
    bankRoutingLabel: 'IBAN',
    phonePlaceholder: '085 123 4567', callingCode: '+353',
    postcodeLabel: 'Eircode', postcodePlaceholder: 'D02 AF30',
  },
  {
    code: 'US', name: 'United States', currency: 'USD', locale: 'en-US',
    // Varies by state and county; most states don't tax services at all.
    taxRate: 0, taxLabel: 'Sales Tax', taxRateIsAdvisory: true,
    taxInclusivePricing: false,
    businessNumberLabel: 'EIN', businessNumberPlaceholder: '12-3456789',
    bankRoutingLabel: 'Routing number',
    phonePlaceholder: '(555) 123-4567', callingCode: '+1',
    postcodeLabel: 'ZIP code', postcodePlaceholder: '90210',
    postcodePattern: /^\d{5}(-\d{4})?$/,
  },
  {
    code: 'CA', name: 'Canada', currency: 'CAD', locale: 'en-CA',
    // 5% federal GST; provinces add PST/HST on top.
    taxRate: 0.05, taxLabel: 'GST/HST', taxRateIsAdvisory: true,
    taxInclusivePricing: false,
    businessNumberLabel: 'Business Number', businessNumberPlaceholder: '123456789RT0001',
    bankRoutingLabel: 'Transit number',
    phonePlaceholder: '(555) 123-4567', callingCode: '+1',
    postcodeLabel: 'Postal code', postcodePlaceholder: 'M5V 3L9',
    postcodePattern: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
  },
  {
    code: 'IN', name: 'India', currency: 'INR', locale: 'en-IN',
    // Banded 5/12/18/28% by category of supply; 18% is the common services band.
    taxRate: 0.18, taxLabel: 'GST', taxRateIsAdvisory: true,
    taxInclusivePricing: false,
    businessNumberLabel: 'GSTIN', businessNumberPlaceholder: '22AAAAA0000A1Z5',
    bankRoutingLabel: 'IFSC code',
    phonePlaceholder: '98765 43210', callingCode: '+91',
    postcodeLabel: 'PIN code', postcodePlaceholder: '400001',
    postcodePattern: /^\d{6}$/,
  },
  {
    code: 'ZA', name: 'South Africa', currency: 'ZAR', locale: 'en-ZA',
    taxRate: 0.15, taxLabel: 'VAT', taxInclusivePricing: false,
    businessNumberLabel: 'VAT number', businessNumberPlaceholder: '4123456789',
    bankRoutingLabel: 'Branch code',
    phonePlaceholder: '082 123 4567', callingCode: '+27',
    postcodeLabel: 'Postal code', postcodePlaceholder: '8001',
    postcodePattern: /^\d{4}$/,
  },
  {
    code: 'SG', name: 'Singapore', currency: 'SGD', locale: 'en-SG',
    taxRate: 0.09, taxLabel: 'GST', taxInclusivePricing: false,
    businessNumberLabel: 'UEN', businessNumberPlaceholder: '201234567A',
    bankRoutingLabel: 'Bank code',
    phonePlaceholder: '8123 4567', callingCode: '+65',
    postcodeLabel: 'Postal code', postcodePlaceholder: '018956',
    postcodePattern: /^\d{6}$/,
  },
  {
    code: 'AE', name: 'United Arab Emirates', currency: 'AED', locale: 'en-AE',
    taxRate: 0.05, taxLabel: 'VAT', taxInclusivePricing: false,
    businessNumberLabel: 'TRN', businessNumberPlaceholder: '100123456700003',
    bankRoutingLabel: 'IBAN',
    phonePlaceholder: '050 123 4567', callingCode: '+971',
    postcodeLabel: 'PO Box', postcodePlaceholder: '12345',
  },
  {
    code: 'DE', name: 'Germany', currency: 'EUR', locale: 'de-DE',
    taxRate: 0.19, taxLabel: 'MwSt.', taxInclusivePricing: false,
    businessNumberLabel: 'USt-IdNr.', businessNumberPlaceholder: 'DE123456789',
    bankRoutingLabel: 'IBAN',
    phonePlaceholder: '0151 23456789', callingCode: '+49',
    postcodeLabel: 'PLZ', postcodePlaceholder: '10115',
    postcodePattern: /^\d{5}$/,
  },
  {
    code: 'FR', name: 'France', currency: 'EUR', locale: 'fr-FR',
    taxRate: 0.2, taxLabel: 'TVA', taxInclusivePricing: false,
    businessNumberLabel: 'SIRET', businessNumberPlaceholder: '12345678900012',
    bankRoutingLabel: 'IBAN',
    phonePlaceholder: '06 12 34 56 78', callingCode: '+33',
    postcodeLabel: 'Code postal', postcodePlaceholder: '75001',
    postcodePattern: /^\d{5}$/,
  },
  {
    code: 'NL', name: 'Netherlands', currency: 'EUR', locale: 'nl-NL',
    taxRate: 0.21, taxLabel: 'BTW', taxInclusivePricing: false,
    businessNumberLabel: 'BTW-nummer', businessNumberPlaceholder: 'NL123456789B01',
    bankRoutingLabel: 'IBAN',
    phonePlaceholder: '06 12345678', callingCode: '+31',
    postcodeLabel: 'Postcode', postcodePlaceholder: '1012 AB',
    postcodePattern: /^\d{4}\s?[A-Z]{2}$/,
  },
];

/**
 * Fallback used when a profile has no country yet, or names one we don't carry
 * reference data for. Deliberately tax-free and advisory so we never invent a
 * tax rate for a country we know nothing about.
 */
export const FALLBACK_COUNTRY: CountryConfig = {
  code: 'ZZ', name: 'Other', currency: 'USD', locale: 'en-US',
  taxRate: 0, taxLabel: 'Tax', taxRateIsAdvisory: true,
  taxInclusivePricing: false,
  businessNumberLabel: 'Business number', businessNumberPlaceholder: '',
  bankRoutingLabel: 'Routing / sort code',
  phonePlaceholder: '', callingCode: '',
  postcodeLabel: 'Postal code', postcodePlaceholder: '',
};

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string | null | undefined): CountryConfig {
  if (!code) return FALLBACK_COUNTRY;
  return BY_CODE.get(code.toUpperCase()) ?? FALLBACK_COUNTRY;
}

/** Countries sorted for a picker, with the device's best guess floated to the top. */
export function countriesForPicker(preferredCode?: string | null): CountryConfig[] {
  const sorted = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
  if (!preferredCode) return sorted;
  const idx = sorted.findIndex((c) => c.code === preferredCode.toUpperCase());
  if (idx <= 0) return sorted;
  return [sorted[idx], ...sorted.slice(0, idx), ...sorted.slice(idx + 1)];
}

/**
 * Best guess at the user's country from the device locale, so onboarding can
 * preselect something sensible instead of defaulting everyone to Australia.
 */
export function guessCountryCode(): string {
  if (typeof navigator === 'undefined') return 'AU';
  const tag = navigator.language || (navigator.languages && navigator.languages[0]);
  if (!tag) return 'AU';
  // "en-GB" -> "GB". Bare "en" gives no region, so fall through.
  const parts = tag.split('-');
  const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;
  if (region && BY_CODE.has(region)) return region;
  return 'AU';
}
