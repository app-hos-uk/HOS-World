#!/usr/bin/env ts-node
/**
 * Remove duplicate product submissions: same seller + same product name + status SUBMITTED.
 * Keeps the oldest submission per (sellerId, productName) and deletes the rest.
 *
 * Usage (from repo root or services/api):
 *   cd services/api && pnpm exec ts-node scripts/remove-duplicate-submissions.ts
 *   cd services/api && pnpm exec ts-node scripts/remove-duplicate-submissions.ts --dry-run
 *
 * Requires DATABASE_URL (e.g. from .env in services/api).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

interface SubmissionRow {
  id: string;
  sellerId: string;
  productData: unknown;
  status: string;
  createdAt: Date;
}

function productName(data: unknown): string {
  if (data && typeof data === 'object' && 'name' in data && typeof (data as { name: unknown }).name === 'string') {
    return ((data as { name: string }).name ?? '').trim();
  }
  return '';
}

async function main() {
  console.log('Fetching SUBMITTED product submissions...\n');

  const submissions = await prisma.productSubmission.findMany({
    where: { status: 'SUBMITTED' },
    select: { id: true, sellerId: true, productData: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const byKey = new Map<string, SubmissionRow[]>();
  for (const row of submissions as SubmissionRow[]) {
    const name = productName(row.productData);
    const key = `${row.sellerId}\t${name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }

  const toDelete: SubmissionRow[] = [];
  for (const [, group] of byKey) {
    if (group.length <= 1) continue;
    // Keep the first (oldest), delete the rest
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i]);
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicate submissions found.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${toDelete.length} duplicate submission(s) to remove (keeping oldest per seller+name).\n`);

  for (const row of toDelete) {
    const name = productName(row.productData);
    console.log(`  - ${row.id} (seller ${row.sellerId}, "${name}", ${row.createdAt.toISOString()})`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Run without --dry-run to delete.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nDeleting...');
  const ids = toDelete.map((r) => r.id);
  const result = await prisma.productSubmission.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`Deleted ${result.count} duplicate submission(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
