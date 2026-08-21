export function buildShareUrl(roomId: string, accessCode: string | undefined, locale: string): string {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
  const url = new URL(`/${locale}/game/${encodeURIComponent(roomId)}`, origin || 'http://localhost');
  if (accessCode) url.searchParams.set('code', accessCode);
  return origin ? url.toString() : url.toString().replace('http://localhost', '');
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy browser API.
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body?.appendChild(textarea);
  textarea.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  textarea.remove();
  return copied;
}
