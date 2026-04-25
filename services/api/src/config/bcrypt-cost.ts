/**
 * Bcrypt cost for **password** hashes (12+ per OWASP / production hardening).
 * Optional override: `BCRYPT_SALT_ROUNDS` in [10, 15].
 * Refresh tokens and non-password HMACs may use a separate fixed cost elsewhere.
 */
const parsed = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
const clamped = Number.isFinite(parsed) ? Math.min(15, Math.max(10, parsed)) : 12;
export const BCRYPT_PASSWORD_ROUNDS = clamped;
