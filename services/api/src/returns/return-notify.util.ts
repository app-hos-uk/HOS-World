/** Shared copy for return notification emails and in-app messages. */

export type ReturnNotifyLine = {
  name: string;
  quantity: number;
  unitPrice?: number;
  currency?: string;
};

export type ReturnNotifyPayload = {
  sourceLabel: string;
  storeName?: string;
  reason: string;
  notes?: string;
  refundMethod?: string;
  items: ReturnNotifyLine[];
  isInStore: boolean;
};

function formatMoney(amount: number, currency?: string): string {
  const c = currency || 'USD';
  return `${c} ${amount.toFixed(2)}`;
}

export function buildReturnItemsTableHtml(
  items: ReturnNotifyLine[],
  currency?: string,
): string {
  if (!items.length) {
    return '<p><em>Entire purchase</em></p>';
  }
  const rows = items
    .map((item) => {
      const price =
        item.unitPrice != null ? formatMoney(item.unitPrice, item.currency || currency) : '—';
      return `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${price}</td></tr>`;
    })
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0">
    <thead><tr style="background:#edf2f7;text-align:left">
      <th style="padding:8px;border:1px solid #e2e8f0">Item</th>
      <th style="padding:8px;border:1px solid #e2e8f0">Qty</th>
      <th style="padding:8px;border:1px solid #e2e8f0">Unit price</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function buildReturnItemsPlainText(
  items: ReturnNotifyLine[],
  currency?: string,
): string {
  if (!items.length) return 'Items: entire purchase';
  const lines = items.map(
    (item) =>
      `• ${item.name} × ${item.quantity}${
        item.unitPrice != null
          ? ` (${formatMoney(item.unitPrice, item.currency || currency)} each)`
          : ''
      }`,
  );
  return `Items:\n${lines.join('\n')}`;
}

export function buildReturnNotifyPlainBody(payload: ReturnNotifyPayload): string {
  const parts = [
    `Source: ${payload.sourceLabel}`,
    payload.storeName ? `Store: ${payload.storeName}` : null,
    `Reason: ${payload.reason}`,
    payload.notes ? `Notes: ${payload.notes}` : null,
    payload.refundMethod
      ? `Refund method: ${payload.refundMethod === 'IN_STORE' ? 'In-store refund at till' : payload.refundMethod}`
      : payload.isInStore
        ? 'Refund method: In-store refund at till'
        : null,
    buildReturnItemsPlainText(payload.items),
    payload.isInStore
      ? 'Please bring the item(s) back to the store after approval if inspection is required.'
      : null,
  ].filter(Boolean);
  return parts.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
