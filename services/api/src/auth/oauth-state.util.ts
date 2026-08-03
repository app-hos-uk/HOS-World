import { randomBytes } from 'crypto';

type OAuthStatePayload = {
  n: string;
  i?: string;
};

/** Encode invite into OAuth state without using the raw invite as the CSRF token. */
export function encodeOAuthState(invite?: string): string {
  const payload: OAuthStatePayload = {
    n: randomBytes(16).toString('hex'),
    ...(invite?.trim() ? { i: invite.trim() } : {}),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeOAuthInvite(state?: string): string | undefined {
  if (!state?.trim()) return undefined;
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as OAuthStatePayload;
    return typeof parsed?.i === 'string' && parsed.i.trim() ? parsed.i.trim() : undefined;
  } catch {
    // Backward compat: treat plain state as invite code
    return state.trim() || undefined;
  }
}
