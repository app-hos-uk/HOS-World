/** Optional field: empty is valid; otherwise must be parseable http(s) URL. */
export function validateOptionalHttpUrl(value: string, fieldLabel: string): string | null {
  const t = value.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `${fieldLabel} must use http:// or https://`;
    }
    return null;
  } catch {
    return `${fieldLabel} must be a valid URL`;
  }
}

export function validateInfluencerProfileUrls(input: {
  profileImage: string;
  bannerImage: string;
  socialLinks: Record<string, string>;
  socialLabels: Record<string, string>;
}): string | null {
  const err =
    validateOptionalHttpUrl(input.profileImage, 'Profile image URL') ||
    validateOptionalHttpUrl(input.bannerImage, 'Banner image URL');
  if (err) return err;

  for (const [key, value] of Object.entries(input.socialLinks)) {
    if (!value?.trim()) continue;
    const label = input.socialLabels[key] || key;
    const e = validateOptionalHttpUrl(value, label);
    if (e) return e;
  }
  return null;
}

export { isValidHttpPublicUrl } from '@hos-marketplace/utils';

/**
 * Returns a safe href for external URLs, or `undefined` if the URL
 * is invalid/dangerous (javascript:, data:, non-http(s), etc.).
 * Bare domains like "example.com" are prefixed with https://.
 */
export function toSafeExternalHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Block dangerous schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('//')
  ) {
    return undefined;
  }

  const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return normalized;
  } catch {
    return undefined;
  }
}
