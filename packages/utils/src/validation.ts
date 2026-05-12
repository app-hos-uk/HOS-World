/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate phone number (basic validation)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s-()]/g, ''));
}

/**
 * Public-facing resource URL over http(s). Stricter than `new URL()`: rejects bare hostnames without
 * a domain (e.g. https://cdn), rejects user:pass@ URLs; allows localhost / IPv4 / IPv6 / normal DNS hosts.
 */
export function isValidHttpPublicUrl(urlString: string): boolean {
  const s = urlString.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (!host) return false;

    if (host === 'localhost' || host.endsWith('.localhost')) return false;

    if (host.startsWith('[') && host.endsWith(']')) return false;

    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4.test(host)) {
      const parts = host.split('.').map(Number);
      if (!parts.every((n) => n >= 0 && n <= 255)) return false;
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 127) return false;
      if (parts[0] === 0) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      return true;
    }

    if (!host.includes('.')) return false;

    const labels = host.split('.');
    if (labels.some((l) => !l || l.length > 63 || /[^a-z0-9-]/.test(l) || l.startsWith('-') || l.endsWith('-')))
      return false;
    const tld = labels[labels.length - 1];
    return (tld as string).length >= 2;
  } catch {
    return false;
  }
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate postal code (basic validation)
 */
export function isValidPostalCode(postalCode: string, country?: string): boolean {
  // Basic validation - can be extended for country-specific formats
  if (country === 'US') {
    return /^\d{5}(-\d{4})?$/.test(postalCode);
  }
  if (country === 'UK') {
    return /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(postalCode);
  }
  // Generic validation - at least 4 characters
  return postalCode.length >= 4 && /^[A-Z0-9\s-]+$/i.test(postalCode);
}


