/**
 * Sender identity for outgoing Resend email.
 *
 * All transactional mail goes out from one verified address (the Resend domain
 * tradiemate.aethonautomation.com); the tradie's business name is only the display
 * name. Override the address with the EMAIL_FROM_ADDRESS secret.
 */

export const DEFAULT_FROM_ADDRESS = 'noreply@tradiemate.aethonautomation.com';

/**
 * Make a user-supplied display name safe for an RFC 5322 From header.
 * Strips characters that could break out of the header (quotes, angle brackets,
 * CR/LF) and caps the length.
 * @param name - display name, e.g. a business name typed by the user
 * @returns a sanitised name, or "TradieMate" when nothing usable is left
 */
export function sanitizeDisplayName(name: string | null | undefined): string {
  const cleaned = (name ?? '').replace(/[<>"\r\n]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64);
  return cleaned || 'TradieMate';
}

/**
 * Build the From header for an outgoing email.
 * @param displayName - name shown to the recipient (usually the business name)
 * @param address - sending address; defaults to EMAIL_FROM_ADDRESS or DEFAULT_FROM_ADDRESS
 * @returns e.g. `Acme Plumbing <noreply@tradiemate.aethonautomation.com>`
 */
export function fromHeader(displayName: string | null | undefined, address?: string): string {
  const envAddress = typeof Deno !== 'undefined' ? Deno.env.get('EMAIL_FROM_ADDRESS') : undefined;
  return `${sanitizeDisplayName(displayName)} <${address ?? envAddress ?? DEFAULT_FROM_ADDRESS}>`;
}
