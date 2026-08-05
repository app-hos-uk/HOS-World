import { BadRequestException } from '@nestjs/common';
import { ALLOWED_LEDGER_ENTRY_TYPES } from './accounting.types';

/**
 * Hard guardrail: Lightspeed's native Xero connector owns in-store POS sales.
 * HOS must never post POSSale-derived amounts (prevents double-counting revenue).
 */

const FORBIDDEN_ENTRY_TYPE_PATTERNS = [
  /^POS[_-]/i,
  /POS_?SALE/i,
  /INSTORE/i,
  /IN_STORE/i,
  /REGISTER_?SALE/i,
  /LIGHTSPEED_SALE/i,
];

const FORBIDDEN_PAYLOAD_KEY_PATTERNS = [
  /^posSaleId$/i,
  /^posSaleIds$/i,
  /^pos_sale_id$/i,
  /^pos_sale_ids$/i,
  /^POSSale$/i,
  /^posSale$/i,
  /^externalSaleId$/i,
  /^registerSaleId$/i,
  /^lightspeedSaleId$/i,
];

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_PAYLOAD_KEY_PATTERNS.some((re) => re.test(key));
}

function scanValue(value: unknown, path: string): void {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, i) => scanValue(item, `${path}[${i}]`));
    return;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (isForbiddenKey(key)) {
        throw new BadRequestException(
          `POSSale guardrail: payload must not contain POS sale reference at ${childPath}`,
        );
      }
      // Reject string values that look like explicit POSSale model references
      if (typeof child === 'string' && /POSSale/i.test(child) && /prisma|model|entity/i.test(child)) {
        throw new BadRequestException(
          `POSSale guardrail: payload must not reference POSSale at ${childPath}`,
        );
      }
      scanValue(child, childPath);
    }
  }
}

export function assertNoPosSaleInLedger(
  entryType: string,
  payload: unknown,
): void {
  if (!ALLOWED_LEDGER_ENTRY_TYPES.has(entryType)) {
    throw new BadRequestException(
      `POSSale guardrail: entryType "${entryType}" is not an allowed HOS→Xero journal type`,
    );
  }

  for (const re of FORBIDDEN_ENTRY_TYPE_PATTERNS) {
    if (re.test(entryType)) {
      throw new BadRequestException(
        `POSSale guardrail: entryType "${entryType}" looks POS-derived and must never post to Xero`,
      );
    }
  }

  scanValue(payload, '');
}
