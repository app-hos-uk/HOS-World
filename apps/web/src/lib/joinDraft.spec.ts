import {
  JOIN_DRAFT_TTL_MS,
  JOIN_DRAFT_VERSION,
  clearJoinDraft,
  hasJoinDraftContent,
  joinDraftResumeLabel,
  parseJoinDraft,
  readJoinDraft,
  writeJoinDraft,
} from './joinDraft';

describe('joinDraft', () => {
  const now = Date.parse('2026-10-05T12:00:00.000Z');

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('rejects empty, expired, and future-dated payloads', () => {
    expect(parseJoinDraft(null, now)).toBeNull();
    expect(parseJoinDraft({ v: JOIN_DRAFT_VERSION, savedAt: now, firstName: '' }, now)).toBeNull();
    expect(
      parseJoinDraft(
        { v: JOIN_DRAFT_VERSION, savedAt: now - JOIN_DRAFT_TTL_MS - 1, firstName: 'Hermione' },
        now,
      ),
    ).toBeNull();
    expect(
      parseJoinDraft({ v: JOIN_DRAFT_VERSION, savedAt: now + 120_000, firstName: 'Hermione' }, now),
    ).toBeNull();
  });

  it('never keeps password or fandom fields even if they were written', () => {
    const parsed = parseJoinDraft(
      {
        v: JOIN_DRAFT_VERSION,
        savedAt: now,
        firstName: 'Hermione',
        lastName: 'Granger',
        email: 'hermione@example.com',
        phone: '555',
        referralCode: 'HOS-FRIEND-A7F2',
        password: 'Secret1!',
        fandomChallengeToken: 'tok',
        fandomChallengeAnswer: 2,
        gdprConsent: true,
      },
      now,
    );
    expect(parsed).toEqual({
      v: JOIN_DRAFT_VERSION,
      savedAt: now,
      firstName: 'Hermione',
      lastName: 'Granger',
      email: 'hermione@example.com',
      phone: '555',
      referralCode: 'HOS-FRIEND-A7F2',
      storeId: undefined,
      step: 'form',
    });
    expect(parsed && 'password' in parsed).toBe(false);
  });

  it('round-trips through localStorage and can be cleared', () => {
    expect(hasJoinDraftContent({ firstName: '', lastName: '', email: '', phone: '' })).toBe(false);
    const written = writeJoinDraft(
      { firstName: 'Ron', email: 'ron@example.com', step: 'verify' },
      now,
    );
    expect(written?.firstName).toBe('Ron');
    expect(readJoinDraft(now)?.email).toBe('ron@example.com');
    expect(joinDraftResumeLabel(written!)).toBe('Ron');
    clearJoinDraft();
    expect(readJoinDraft(now)).toBeNull();
  });
});
