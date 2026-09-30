export type FandomChallenge = {
  token: string;
  question: string;
  options: string[];
  fandom: string;
  expiresAt: string;
};

export function isFandomChallengeExpired(challenge: FandomChallenge, now = Date.now()): boolean {
  const expiresAt = Date.parse(challenge.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
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
    return 'The fandom challenge expired. Answer the new question, then try again.';
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
