const ROLE_DASHBOARD_MAP: Record<string, string> = {
  CUSTOMER: '/customer/dashboard',
  WHOLESALER: '/wholesaler/dashboard',
  B2C_SELLER: '/seller/dashboard',
  SELLER: '/seller/dashboard',
  ADMIN: '/admin/dashboard',
  INFLUENCER: '/influencer/dashboard',
  PROCUREMENT: '/procurement/dashboard',
  FULFILLMENT: '/fulfillment/dashboard',
  CATALOG: '/catalog/dashboard',
  MARKETING: '/marketing/dashboard',
  FINANCE: '/finance/dashboard',
  CMS_EDITOR: '/cms/dashboard',
};

/** Accept only same-origin relative paths to prevent open redirects. */
export function getSafeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const path = decodeURIComponent(raw.trim());
    if (!path.startsWith('/') || path.startsWith('//')) return null;
    if (path.startsWith('/login') || path.startsWith('/register')) return null;
    return path;
  } catch {
    return null;
  }
}

export function resolvePostAuthRedirect(
  role: string | undefined,
  returnUrl: string | null | undefined,
): string {
  const safeReturn = getSafeReturnUrl(returnUrl);
  if (safeReturn) return safeReturn;
  if (role && ROLE_DASHBOARD_MAP[role]) return ROLE_DASHBOARD_MAP[role];
  return '/';
}

export function resolvePostRegisterRedirect(
  role: string | undefined,
  returnUrl: string | null | undefined,
): string {
  const safeReturn = getSafeReturnUrl(returnUrl);
  if (safeReturn) return safeReturn;
  if (role && ['SELLER', 'B2C_SELLER', 'WHOLESALER'].includes(role)) {
    return '/seller/onboarding';
  }
  return resolvePostAuthRedirect(role, null);
}

export const AUTH_RETURN_URL_KEY = 'hos_auth_return_url';

/** Persist returnUrl for OAuth flows that round-trip through the provider. */
export function stashAuthReturnUrl(raw: string | null | undefined): void {
  const safe = getSafeReturnUrl(raw);
  if (!safe) return;
  try {
    sessionStorage.setItem(AUTH_RETURN_URL_KEY, safe);
  } catch {
    // ignore storage errors
  }
}

/** Read and clear a stashed post-auth redirect path. */
export function consumeAuthReturnUrl(): string | null {
  try {
    const stored = sessionStorage.getItem(AUTH_RETURN_URL_KEY);
    if (stored) sessionStorage.removeItem(AUTH_RETURN_URL_KEY);
    return getSafeReturnUrl(stored);
  } catch {
    return null;
  }
}
