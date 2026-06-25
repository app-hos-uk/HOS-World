/** Default message when upstream CMS fails or exposes internal wording */
export const CMS_PORTAL_LOAD_FAILURE =
  'Content management is being configured. Please try again later.';

export function cmsLoadingErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message.trim() : '';
  if (!raw || /\bstrapi\b/i.test(raw)) return CMS_PORTAL_LOAD_FAILURE;
  return raw;
}

/** Use safe fallbacks when API ever returns vendor-specific jargon */
export function cmsActionToastMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message.trim() : '';
  if (!raw || /\bstrapi\b/i.test(raw)) return fallback;
  return raw;
}
