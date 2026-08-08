/**
 * Shared shape for loyalty ledger CSV exports so the platform-wide ledger and a
 * single member's ledger produce identical columns for finance.
 */

export type LedgerRow = {
  id?: string;
  createdAt?: string;
  type?: string;
  points?: number;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  source?: string | null;
  channel?: string | null;
  storeId?: string | null;
  description?: string | null;
  sourceId?: string | null;
  idempotencyKey?: string | null;
  expiresAt?: string | null;
  membershipId?: string;
  membership?: {
    id?: string;
    userId?: string;
    cardNumber?: string | null;
    user?: { email?: string; firstName?: string; lastName?: string } | null;
  } | null;
};

export const LEDGER_EXPORT_COLUMNS = [
  { key: 'createdAt', header: 'Date (UTC)' },
  { key: 'memberEmail', header: 'Member Email' },
  { key: 'memberName', header: 'Member Name' },
  { key: 'cardNumber', header: 'Card Number' },
  { key: 'membershipId', header: 'Membership ID' },
  { key: 'type', header: 'Type' },
  { key: 'points', header: 'Points' },
  { key: 'balanceBefore', header: 'Balance Before' },
  { key: 'balanceAfter', header: 'Balance After' },
  { key: 'source', header: 'Source' },
  { key: 'sourceId', header: 'Source ID' },
  { key: 'channel', header: 'Channel' },
  { key: 'storeId', header: 'Store ID' },
  { key: 'description', header: 'Description' },
  { key: 'expiresAt', header: 'Expired At' },
  { key: 'idempotencyKey', header: 'Idempotency Key' },
  { key: 'transactionId', header: 'Transaction ID' },
];

export function flattenLedgerRow(tx: LedgerRow) {
  const user = tx.membership?.user;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return {
    createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : '',
    memberEmail: user?.email || '',
    memberName: name,
    cardNumber: tx.membership?.cardNumber || '',
    membershipId: tx.membershipId || tx.membership?.id || '',
    type: tx.type || '',
    points: tx.points ?? 0,
    balanceBefore: tx.balanceBefore ?? '',
    balanceAfter: tx.balanceAfter ?? '',
    source: tx.source || '',
    sourceId: tx.sourceId || '',
    channel: tx.channel || '',
    storeId: tx.storeId || '',
    description: tx.description || '',
    expiresAt: tx.expiresAt ? new Date(tx.expiresAt).toISOString() : '',
    idempotencyKey: tx.idempotencyKey || '',
    transactionId: tx.id || '',
  };
}
