#!/usr/bin/env node
/**
 * One-off cleanup of UK-located test records ahead of the US launch.
 *
 * Deliberately NOT part of prisma/migrations. A migration saying "every GB entity becomes US"
 * would stay in the permanent history and silently corrupt real user, seller and warehouse
 * locations if it ever ran against a database with genuine UK records — which is the explicit
 * plan for the UK launch. This is a cleanup of one known test dataset, so it lives here and is
 * run deliberately, once.
 *
 * It only touches where an entity is located. Currency, timezone and region defaults are the
 * migration's job; running this does not replace applying the migration.
 *
 * Dry run by default. Pass --apply to write. All work happens in a single transaction, so a
 * failure part-way leaves nothing behind.
 */
const APPLY = process.argv.includes('--apply');

// 'UK' is not ISO 3166-1; it exists in the data because some writers never normalised it.
const UK_VALUES = ['GB', 'UK', 'GBR'];

// People only. UK warehouses and fulfilment centres are test records being deleted outright
// rather than relabelled, so relocating them here would be pointless.
const TARGETS = [
  { table: 'users', column: 'country' },
  { table: 'customers', column: 'country' },
  { table: 'sellers', column: 'country' },
  { table: 'founding_members', column: 'country' },
];

const TO_VALUE = 'US';

const q = (ident) => `"${String(ident).replace(/"/g, '""')}"`;

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const present = new Set(
      (
        await prisma.$queryRawUnsafe(
          `select table_name || '.' || column_name as ref
             from information_schema.columns
            where table_schema = 'public'
              and table_name || '.' || column_name = any($1::text[])`,
          TARGETS.map((t) => `${t.table}.${t.column}`),
        )
      ).map((r) => r.ref),
    );

    const plan = [];
    for (const { table, column } of TARGETS) {
      const ref = `${table}.${column}`;
      if (!present.has(ref)) {
        plan.push({ ref, skipped: 'column not present' });
        continue;
      }
      const rows = await prisma.$queryRawUnsafe(
        `select ${q(column)} as raw, count(*)::bigint as n
           from ${q(table)}
          where upper(btrim(${q(column)})) = any($1::text[])
          group by 1
          order by 2 desc`,
        UK_VALUES,
      );
      for (const r of rows) {
        plan.push({ ref, table, column, from: r.raw, count: Number(r.n) });
      }
    }

    const actionable = plan.filter((p) => !p.skipped);
    const total = actionable.reduce((sum, p) => sum + p.count, 0);

    console.log(`=== UK test-data location cleanup ${APPLY ? '(APPLY)' : '(DRY RUN)'} ===\n`);

    if (plan.length === 0 || total === 0) {
      console.log('Nothing to change — no UK-located records found.');
      plan.filter((p) => p.skipped).forEach((p) => console.log(`  - ${p.ref}: ${p.skipped}`));
      await prisma.$disconnect().catch(() => {});
      process.exit(0);
    }

    for (const p of actionable) {
      console.log(`  ${p.ref}: ${JSON.stringify(p.from)} -> ${JSON.stringify(TO_VALUE)} (${p.count} row(s))`);
    }
    plan.filter((p) => p.skipped).forEach((p) => console.log(`  ${p.ref}: skipped (${p.skipped})`));
    console.log(`\n  Total rows affected: ${total}`);

    if (!APPLY) {
      console.log('\nDry run — nothing was changed. Re-run with --apply to write.');
      await prisma.$disconnect().catch(() => {});
      process.exit(0);
    }

    const updated = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const p of actionable) {
        n += await tx.$executeRawUnsafe(
          `update ${q(p.table)} set ${q(p.column)} = $1
            where upper(btrim(${q(p.column)})) = any($2::text[])`,
          TO_VALUE,
          UK_VALUES,
        );
      }
      return n;
    });

    console.log(`\nApplied. ${updated} row(s) updated.`);

    const residual = [];
    for (const p of actionable) {
      const rows = await prisma.$queryRawUnsafe(
        `select count(*)::bigint as n from ${q(p.table)}
          where upper(btrim(${q(p.column)})) = any($1::text[])`,
        UK_VALUES,
      );
      const n = Number(rows[0].n);
      if (n > 0) residual.push(`${p.ref}: ${n}`);
    }

    if (residual.length > 0) {
      console.error(`\nFAILED verification — UK values remain: ${residual.join(', ')}`);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    }

    console.log('Verified: no UK-located records remain in the targeted columns.');
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  } catch (err) {
    console.error(`cleanup failed: ${err.message}`);
    await prisma.$disconnect().catch(() => {});
    process.exit(2);
  }
})();
