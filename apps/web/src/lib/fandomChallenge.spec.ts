import {
  fandomChallengeRegisterFields,
  getFandomChallengeSubmitError,
  isFandomChallengeExpired,
  isRegisterSubmitBlockedByChallenge,
  shouldRefreshUnansweredChallenge,
} from './fandomChallenge';

const challenge = {
  token: 'tok',
  question: 'Q?',
  options: ['A', 'B', 'C', 'D'],
  fandom: 'Harry Potter',
  expiresAt: '2026-09-30T18:00:00.000Z',
};

describe('fandom challenge helpers', () => {
  it('blocks submit until the challenge is loaded', () => {
    expect(getFandomChallengeSubmitError({ challenge: null, answer: null })).toMatch(/still loading/i);
    expect(
      getFandomChallengeSubmitError({ challenge: null, answer: null, loadFailed: true }),
    ).toMatch(/retry/i);
  });

  it('requires an answer on a live challenge', () => {
    expect(getFandomChallengeSubmitError({ challenge, answer: null })).toMatch(/true fan/i);
    expect(getFandomChallengeSubmitError({ challenge, answer: 1, now: Date.parse(challenge.expiresAt) - 1 })).toBeNull();
  });

  it('rejects expired tokens so the form can refresh', () => {
    expect(isFandomChallengeExpired(challenge, Date.parse(challenge.expiresAt) + 1)).toBe(true);
    expect(
      getFandomChallengeSubmitError({
        challenge,
        answer: 1,
        now: Date.parse(challenge.expiresAt) + 1,
      }),
    ).toMatch(/timed out/i);
  });

  it('refreshes unanswered challenges near expiry but keeps answered ones', () => {
    const now = Date.parse(challenge.expiresAt) - 10_000;
    expect(shouldRefreshUnansweredChallenge(challenge, false, now)).toBe(true);
    expect(shouldRefreshUnansweredChallenge(challenge, true, now)).toBe(false);
    expect(shouldRefreshUnansweredChallenge(challenge, false, Date.parse(challenge.expiresAt) - 60_000)).toBe(
      false,
    );
  });

  it('only attaches register fields when both token and answer exist', () => {
    expect(fandomChallengeRegisterFields(null, 1)).toEqual({});
    expect(fandomChallengeRegisterFields(challenge, null)).toEqual({});
    expect(fandomChallengeRegisterFields(challenge, 2)).toEqual({
      fandomChallengeToken: 'tok',
      fandomChallengeAnswer: 2,
    });
  });

  it('disables submit while the challenge is missing, including failed load', () => {
    expect(isRegisterSubmitBlockedByChallenge(null)).toBe(true);
    expect(isRegisterSubmitBlockedByChallenge(challenge)).toBe(false);
  });
});
