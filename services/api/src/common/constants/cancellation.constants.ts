import { CancellationStatus } from '@prisma/client';

/**
 * Cancellation requests still awaiting a decision. While one of these is open the order
 * sits in CANCELLATION_REQUESTED and its real fulfilment progress lives on the request's
 * previousStatus.
 *
 * Shared because OrdersService needs it too, and importing CancellationsService there
 * would close an import cycle.
 */
export const ACTIVE_CANCELLATION_STATUSES: CancellationStatus[] = [
  'PENDING_SELLER',
  'SELLER_APPROVED',
  'PENDING_FINANCE',
  'FINANCE_APPROVED',
  'ESCALATED',
];
