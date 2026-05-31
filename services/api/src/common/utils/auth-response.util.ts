import type { AuthResponse } from '@hos-marketplace/shared-types';

/** Strip JWT tokens from API responses — tokens are delivered via HttpOnly cookies only. */
export function sanitizeAuthResponse(result: AuthResponse): AuthResponse {
  const { token: _token, refreshToken: _refresh, ...safe } = result as AuthResponse & {
    token?: string;
    refreshToken?: string;
  };
  return safe as AuthResponse;
}
