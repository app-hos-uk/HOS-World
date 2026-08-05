/**
 * HOS → Xero ledger entry types (daily summary journals only).
 * Lightspeed's native Xero connector owns in-store POS sales — never post POSSale here.
 */
export enum LedgerEntryType {
  ONLINE_SALES = 'ONLINE_SALES',
  REFUNDS = 'REFUNDS',
  POINTS_LIABILITY = 'POINTS_LIABILITY',
  GC_BRIDGE_RECLASS = 'GC_BRIDGE_RECLASS',
  HOS_GIFT_CARDS = 'HOS_GIFT_CARDS',
}

export const ALLOWED_LEDGER_ENTRY_TYPES = new Set<string>(Object.values(LedgerEntryType));

export enum LedgerOutboxStatus {
  PENDING = 'PENDING',
  POSTING = 'POSTING',
  POSTED = 'POSTED',
  FAILED = 'FAILED',
  DEAD = 'DEAD',
}

/** Chart-of-accounts mapping stub (account codes editable via admin). */
export interface ChartOfAccountsMapping {
  onlineRevenue: string;
  onlineTax: string;
  stripeReceivable: string;
  stripeFees: string;
  refunds: string;
  pointsLiability: string;
  pointsBreakage: string;
  giftCardLiability: string;
  giftCardExpiryRevenue: string;
  loyaltyDiscount: string;
  currency: string;
}

export const DEFAULT_COA_MAPPING: ChartOfAccountsMapping = {
  onlineRevenue: '200',
  onlineTax: '820',
  stripeReceivable: '610',
  stripeFees: '404',
  refunds: '210',
  pointsLiability: '850',
  pointsBreakage: '260',
  giftCardLiability: '855',
  giftCardExpiryRevenue: '265',
  loyaltyDiscount: '215',
  currency: 'GBP',
};

export interface XeroJournalLine {
  accountCode: string;
  description: string;
  /** Debit amount (positive). Either debit or credit must be set, not both. */
  debit?: number;
  credit?: number;
  taxType?: string;
}

export interface XeroManualJournalPayload {
  narration: string;
  date: string; // YYYY-MM-DD
  lineAmountTypes?: 'NoTax' | 'Exclusive' | 'Inclusive';
  status?: 'DRAFT' | 'POSTED';
  journalLines: XeroJournalLine[];
  /** Provenance metadata — must never include POSSale ids */
  meta: {
    entryType: LedgerEntryType;
    periodDate: string;
    source: 'HOS_ONLINE' | 'HOS_LOYALTY' | 'HOS_GIFT_CARDS';
  };
}

/**
 * Xero OAuth2 granular scopes (required for apps created after 2026-03-02).
 * - offline_access: refresh tokens
 * - accounting.manualjournals: POST/GET ManualJournals
 * - accounting.settings.read: GET /Accounts for CoA seeding
 * Do NOT request accounting.journals.read (Advanced-tier gated).
 */
export const XERO_OAUTH_SCOPES = [
  'offline_access',
  'accounting.manualjournals',
  'accounting.settings.read',
] as const;

export const XERO_INTEGRATION_CATEGORY = 'ACCOUNTING';
export const XERO_INTEGRATION_PROVIDER = 'xero';

export interface XeroTokenCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  tokenType?: string;
  scope?: string;
  tenantId?: string;
}
