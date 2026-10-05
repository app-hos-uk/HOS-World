export const JOIN_DRAFT_STORAGE_KEY = 'hos_join_draft';
export const JOIN_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const JOIN_DRAFT_VERSION = 1;

export type JoinDraftStep = 'form' | 'verify';

export type JoinDraft = {
  v: typeof JOIN_DRAFT_VERSION;
  savedAt: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  referralCode: string;
  storeId?: string;
  step: JoinDraftStep;
};

const EMPTY: Omit<JoinDraft, 'v' | 'savedAt'> = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  referralCode: '',
  storeId: undefined,
  step: 'form',
};

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function hasJoinDraftContent(draft: Pick<JoinDraft, 'firstName' | 'lastName' | 'email' | 'phone'>): boolean {
  return Boolean(draft.firstName.trim() || draft.lastName.trim() || draft.email.trim() || draft.phone.trim());
}

export function parseJoinDraft(raw: unknown, now = Date.now()): JoinDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== JOIN_DRAFT_VERSION) return null;
  const savedAt = typeof rec.savedAt === 'number' ? rec.savedAt : Number(rec.savedAt);
  if (!Number.isFinite(savedAt) || now - savedAt > JOIN_DRAFT_TTL_MS || savedAt > now + 60_000) {
    return null;
  }
  const storeId = typeof rec.storeId === 'string' ? rec.storeId.trim() : '';
  const step: JoinDraftStep = rec.step === 'verify' ? 'verify' : 'form';
  const draft: JoinDraft = {
    v: JOIN_DRAFT_VERSION,
    savedAt,
    firstName: clip(rec.firstName, 50),
    lastName: clip(rec.lastName, 50),
    email: clip(rec.email, 255),
    phone: clip(rec.phone, 32),
    referralCode: clip(rec.referralCode, 80),
    storeId: storeId || undefined,
    step,
  };
  if (!hasJoinDraftContent(draft) && step !== 'verify') return null;
  return draft;
}

export function readJoinDraft(now = Date.now()): JoinDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(JOIN_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseJoinDraft(JSON.parse(raw), now);
    if (!parsed) {
      window.localStorage.removeItem(JOIN_DRAFT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeJoinDraft(
  input: Partial<Omit<JoinDraft, 'v' | 'savedAt'>>,
  now = Date.now(),
): JoinDraft | null {
  if (typeof window === 'undefined') return null;
  const draft = parseJoinDraft(
    {
      v: JOIN_DRAFT_VERSION,
      savedAt: now,
      ...EMPTY,
      ...input,
    },
    now,
  );
  if (!draft) {
    clearJoinDraft();
    return null;
  }
  try {
    window.localStorage.setItem(JOIN_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return draft;
  } catch {
    return draft;
  }
}

export function clearJoinDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(JOIN_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function joinDraftResumeLabel(draft: JoinDraft): string {
  const name = [draft.firstName, draft.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (draft.email.trim()) return draft.email.trim();
  return 'your details';
}
