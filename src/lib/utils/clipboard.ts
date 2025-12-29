/**
 * Safely copy text to clipboard with fallback for insecure contexts
 * The Clipboard API requires HTTPS or localhost, so we need a fallback for HTTP
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first (requires HTTPS or localhost)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error);
    }
  }

  // Fallback for insecure contexts (HTTP) - use execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    textArea.remove();

    return successful;
  } catch (error) {
    console.error('Clipboard fallback failed:', error);
    return false;
  }
}

/**
 * Check if clipboard API is available
 */
export function isClipboardAvailable(): boolean {
  return !!(navigator.clipboard && navigator.clipboard.writeText);
}
