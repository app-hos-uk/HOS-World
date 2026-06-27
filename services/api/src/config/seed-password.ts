import { randomBytes } from 'crypto';

function resolveSeedPassword(
  envKey: 'SEED_ADMIN_PASSWORD' | 'TEST_SEED_PASSWORD',
  productionMessage: string,
): string {
  const raw = process.env[envKey];
  if (raw !== undefined) {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error(`${envKey} is set but empty or whitespace-only`);
    }
    return trimmed;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(productionMessage);
  }
  return randomBytes(16).toString('base64url');
}

/** Admin bootstrap password — never hardcode; set SEED_ADMIN_PASSWORD in env for scripts. */
export function getSeedAdminPassword(): string {
  return resolveSeedPassword(
    'SEED_ADMIN_PASSWORD',
    'SEED_ADMIN_PASSWORD must be set to run admin seed scripts in production',
  );
}

/** Shared dev/test user password for seed endpoints and scripts. */
export function getSeedTestPassword(): string {
  return resolveSeedPassword(
    'TEST_SEED_PASSWORD',
    'TEST_SEED_PASSWORD must be set for test user seeding in production',
  );
}
