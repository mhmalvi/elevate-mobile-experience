import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money and locale formatting live in `@/lib/money` — these re-exports keep the
 * existing `@/lib/utils` import sites working while the implementation became
 * currency- and locale-aware. `formatCurrency` used to hardcode `$` and
 * 'en-AU'; it now follows the signed-in business's settings.
 *
 * Prefer importing from '@/lib/money' directly in new code.
 */
export {
  safeNumber,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  currencySymbol,
  calculateTax,
  taxLineLabel,
} from './money';
