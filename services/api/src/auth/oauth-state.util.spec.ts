import { decodeOAuthInvite, encodeOAuthState } from './oauth-state.util';

describe('oauth-state.util', () => {
  describe('encodeOAuthState / decodeOAuthInvite', () => {
    it('round-trips invite code through encoded state', () => {
      const state = encodeOAuthState('INVITE123');
      expect(decodeOAuthInvite(state)).toBe('INVITE123');
    });

    it('returns undefined when invite omitted', () => {
      const state = encodeOAuthState();
      expect(decodeOAuthInvite(state)).toBeUndefined();
    });

    it('falls back to plain state for legacy invite values', () => {
      expect(decodeOAuthInvite('LEGACY-CODE')).toBe('LEGACY-CODE');
    });

    it('returns undefined for empty state', () => {
      expect(decodeOAuthInvite('')).toBeUndefined();
      expect(decodeOAuthInvite(undefined)).toBeUndefined();
    });
  });
});
