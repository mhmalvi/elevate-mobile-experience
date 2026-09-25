import { getPlatform } from './platformPayments';

/** Public web address customers open (quotes, invoices, invites, auth emails). */
export const PUBLIC_APP_URL = 'https://tradiemate.aethonautomation.com';

/**
 * Base URL for links that leave the device.
 *
 * Inside the Android/iOS app `window.location.origin` is `https://localhost`
 * (Capacitor's WebView), so shared links and auth redirects must use the public
 * web app instead. On the web the current origin is correct.
 * @returns origin without a trailing slash, e.g. `https://tradiemate.aethonautomation.com`
 */
export function publicAppUrl(): string {
  if (getPlatform() !== 'web') return PUBLIC_APP_URL;
  return window.location.origin;
}
