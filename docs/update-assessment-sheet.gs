/**
 * One-time script to update Hos Dependancy assessment sheet (column C + optional F).
 *
 * How to run:
 * 1. Open the Google Sheet
 * 2. Extensions → Apps Script
 * 3. Paste this file contents into Code.gsa
 * 4. Run updateAssessmentStatuses() → Allow permissions
 */
function updateAssessmentStatuses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  if (!sheet) {
    throw new Error('Sheet1 not found');
  }

  const statuses = [
    'Incomplete — code present; pending live Stripe validation',
    'Partially Functional — unchanged',
    'Blocked by Payment Dependency — unchanged',
    'Partially Accessible — unchanged',
    'Limited Operational Data — unchanged',
    'Implemented — pending E2E validation',
    'Wired — pending live delivery test',
    'APIs expanded — limited live data',
    'Partially Operational (expanded)',
    'Partially Functional — unchanged',
    'Partially Functional — unchanged',
    'Limited Validation — unchanged',
    'Query layer ready — limited live data',
    'Jobs wired — pending prod validation',
    'Event propagation wired — pending live test',
    'Reporting APIs expanded — limited live data',
    'Pending Payment Integration — unchanged',
    'Pending Payment Integration — unchanged',
  ];

  const notes = [
    'Stripe provider wired; requires STRIPE_SECRET_KEY + production E2E checkout.',
    'finance/refunds.service.ts exists; live payment reversal not validated.',
    'Depends on completed paid orders via live payment gateway.',
    'settlements/ module exists; end-to-end payout flow not production-validated.',
    'Reporting APIs exist; accuracy depends on real paid transaction volume.',
    'FIXED: Reviews PENDING; admin /admin/reviews/*; Moderation Queue UI. Commit 2be54f4.',
    'FIXED: order + review notifications; GENERAL enum migration. Validate delivery in prod.',
    'FIXED: GET /analytics/operational, /analytics/wholesale; admin dashboard metrics.',
    'FIXED: logs on review + order events; admin recentActivityLogs.',
    'vendor-ledger + settlements present; live multi-seller reconciliation not validated.',
    'Refund APIs exist; Stripe refund execution not production-validated.',
    'Tax providers exist; depends on live payment + config.',
    'FIXED: getWholesaleMetrics() aggregates; needs real WHOLESALER paid orders.',
    'FIXED: MonitoringJobsService crons; requires Redis/BullMQ in deployed API.',
    'FIXED: events on order + review workflow; validate queue → sent in prod.',
    'FIXED: operational + wholesale endpoints; needs production-scale data.',
    'Blocked until live payment gateway validation complete.',
    'Blocked until live checkout/settlement/refund path validated in production.',
  ];

  // Column C = Current Status (rows 2–19)
  sheet.getRange(2, 3, statuses.length, 1).setValues(statuses.map((s) => [s]));

  // Optional: add header + verification notes in column F
  sheet.getRange(1, 6).setValue('Verification Notes (Jun 2026)');
  sheet.getRange(2, 6, notes.length, 1).setValues(notes.map((n) => [n]));

  SpreadsheetApp.getUi().alert('Updated column C (rows 2–19) and column F verification notes.');
}
