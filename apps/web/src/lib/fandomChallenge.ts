export type FandomChallenge = {
  token: string;
  question: string;
  options: string[];
  fandom: string;
  expiresAt: string;
};

/** Refresh an unanswered challenge this far before expiry so submit never uses a dead token. */
export const FANDOM_CHALLENGE_REFRESH_BUFFER_MS = 20_000;

export function fandomChallengeExpiryMs(challenge: FandomChallenge): number {
  return Date.parse(challenge.expiresAt);
}

export function isFandomChallengeExpired(challenge: FandomChallenge, now = Date.now()): boolean {
  const expiresAt = fandomChallengeExpiryMs(challenge);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function shouldRefreshUnansweredChallenge(
  challenge: FandomChallenge,
  hasAnswer: boolean,
  now = Date.now(),
): boolean {
  if (hasAnswer) return false;
  const expiresAt = fandomChallengeExpiryMs(challenge);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt - now <= FANDOM_CHALLENGE_REFRESH_BUFFER_MS;
}

/** Client-side gate so register cannot be submitted without a live trivia answer. */
export function getFandomChallengeSubmitError(params: {
  challenge: FandomChallenge | null;
  answer: number | null;
  loadFailed?: boolean;
  now?: number;
}): string | null {
  if (!params.challenge) {
    return params.loadFailed
      ? 'Could not load the fandom challenge. Tap retry, then try again.'
      : 'The fandom challenge is still loading. Please wait a moment.';
  }
  if (params.answer == null) {
    return 'Answer the fandom question to prove you are a true fan!';
  }
  if (isFandomChallengeExpired(params.challenge, params.now)) {
    return 'This question timed out. Answer the new one to finish joining.';
  }
  return null;
}

export function fandomChallengeRegisterFields(
  challenge: FandomChallenge | null,
  answer: number | null,
): { fandomChallengeToken?: string; fandomChallengeAnswer?: number } {
  if (!challenge || answer == null) return {};
  return {
    fandomChallengeToken: challenge.token,
    fandomChallengeAnswer: answer,
  };
}

/** Disable Create Account while the trivia is loading or failed — Retry stays on the widget. */
export function isRegisterSubmitBlockedByChallenge(challenge: FandomChallenge | null): boolean {
  return challenge == null;
}
