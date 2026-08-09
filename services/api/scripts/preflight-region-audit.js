#!/usr/bin/env node
/**
 * Read-only pre-flight audit for the US region normalisation migration.
 *
 * Run this against a target database BEFORE applying
 * prisma/migrations/20261011120000_us_region_normalisation. It issues SELECTs only
 * and never writes.
 *
 * It answers two questions the migration itself cannot:
 *
 *   1. Which region-ish columns hold UK values, discovered from information_schema
 *      rather than from the migration's own list. A column the migration forgot is
 *      invisible to that migration's verification block, which is how the `configs`
 *      platform overrides were originally missed.
 *
 *   2. Which of those values the migration's exact-match predicates would skip.
 *      The migration matches 'GBP' / 'GB' / 'Europe/London' literally, so a stored
 *      'gbp' or ' GB ' is updated by nothing and still passes verification. Those
 *      are reported as silent misses because they fail quietly rather than loudly.
 *
 * Exit codes: 0 = nothing outstanding, 1 = findings to review, 2 = audit failed to run.
 */
const fs = require('fs');
const path = require('path');

const apiRoot = path.resolve(__dirname, '..');
const migrationFile = path.join(
  apiRoot,
  'prisma/migrations/20261011120000_us_region_normalisation/migration.sql',
);

const NAME_PATTERNS = ['%currency%', '%country%', '%timezone%', '%region%', '%locale%'];

/**
 * Columns where a UK value is correct and must not be rewritten. Without these the
 * audit reports permanent false positives, which is how a real finding gets overlooked.
 */
const INTENTIONALLY_EXCLUDED = new Map([
  ['currency_exchange_rates.targetCurrency', 'FX pair target — GBP is a valid rate destination'],
  ['currency_exchange_rates.baseCurrency', 'FX pair base — retains its own currency semantics'],
  // Where a person or a building actually is. Changing the platform's default market does not
  // relocate them, and rewriting these would corrupt tax, shipping and compliance decisions.
  ['users.country', 'Real user location'],
  ['customers.country', 'Real customer location'],
  ['sellers.country', 'Real seller location'],
  ['founding_members.country', 'Real member location'],
  ['warehouses.country', 'Physical warehouse location'],
  ['fulfillment_centers.country', 'Physical fulfilment centre location'],
]);

// Values the migration rewrites, and the exact literal each predicate compares against.
const UK_VALUES = new Map([
  ['GBP', 'GBP'],
  ['GB', 'GB'],
  ['EN-GB', 'en-GB'],
  ['EUROPE/LONDON', 'Europe/London'],
  ['UK', null],
  ['GBR', null],
]);

/** Columns the migration references, so we can separate covered from uncovered findings. */
function migrationCoverage() {
  if (!fs.existsSync(migrationFile)) return null;
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const refs = new Set();
  for (const m of sql.matchAll(/UPDATE\s+"([A-Za-z_][A-Za-z0-9_]*)"\s+SET\s+"([A-Za-z_][A-Za-z0-9_]*)"/gi)) {
    refs.add(`${m[1]}.${m[2]}`);
  }
  for (const m of sql.matchAll(
    /ALTER TABLE\s+"([A-Za-z_][A-Za-z0-9_]*)"\s+ALTER COLUMN\s+"([A-Za-z_][A-Za-z0-9_]*)"/gi,
  )) {
    refs.add(`${m[1]}.${m[2]}`);
  }
  return refs;
}

const q = (ident) => `"${String(ident).replace(/"/g, '""')}"`;

async function auditTextColumns(prisma, covered, findings) {
  const columns = await prisma.$queryRawUnsafe(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'
        and data_type in ('text', 'character varying', 'character')
        and (${NAME_PATTERNS.map((_, i) => `column_name ilike $${i + 1}`).join(' or ')})
      order by table_name, column_name`,
    ...NAME_PATTERNS,
  );

  for (const { table_name: table, column_name: column } of columns) {
    const ref = `${table}.${column}`;
    let rows;
    try {
      rows = await prisma.$queryRawUnsafe(
        `select ${q(column)} as raw, count(*)::bigint as n
           from ${q(table)}
          where ${q(column)} is not null
            and upper(btrim(${q(column)})) = any($1::text[])
          group by 1
          order by 2 desc`,
        [...UK_VALUES.keys()],
      );
    } catch (err) {
      findings.push({ kind: 'unreadable', ref, detail: err.message });
      continue;
    }

    for (const row of rows) {
      const raw = row.raw;
      const n = Number(row.n);
      const canonical = UK_VALUES.get(String(raw).trim().toUpperCase());
      const exactMatch = canonical !== null && raw === canonical;
      const excluded = INTENTIONALLY_EXCLUDED.get(ref);

      let kind;
      if (excluded) {
        kind = 'excluded';
      } else if (!covered || covered.has(ref)) {
        kind = exactMatch ? 'covered' : 'silentMiss';
      } else {
        kind = 'uncovered';
      }

      findings.push({ kind, ref, value: raw, count: n, exactMatch, detail: excluded });
    }
  }
}

/**
 * Column DEFAULTs, which the value audit cannot see. A table with no UK rows today but a
 * 'GBP' default will silently produce GBP again on the next insert.
 */
async function auditColumnDefaults(prisma, findings) {
  const rows = await prisma.$queryRawUnsafe(
    `select table_name, column_name, column_default
       from information_schema.columns
      where table_schema = 'public'
        and column_default is not null
        and (${NAME_PATTERNS.map((_, i) => `column_name ilike $${i + 1}`).join(' or ')})
        and (
          column_default ilike '%''GBP''%'
          or column_default ilike '%''GB''%'
          or column_default ilike '%''UK''%'
          or column_default ilike '%''en-GB''%'
          or column_default ilike '%Europe/London%'
        )
      order by table_name, column_name`,
    ...NAME_PATTERNS,
  );

  for (const row of rows) {
    const ref = `${row.table_name}.${row.column_name}`;
    if (INTENTIONALLY_EXCLUDED.has(ref)) continue;
    findings.push({ kind: 'ukDefault', ref, value: row.column_default });
  }
}

async function auditConfigJson(prisma, findings) {
  const exists = await prisma.$queryRawUnsafe(
    `select 1 from information_schema.tables where table_schema='public' and table_name='configs'`,
  );
  if (exists.length === 0) return;

  // Shape matters here: the migration compares value #>> '{}', which only matches a bare
  // JSON string. A row storing {"code":"GBP"} would be skipped without failing verification.
  const rows = await prisma.$queryRawUnsafe(
    `select "key", jsonb_typeof("value"::jsonb) as json_type, "value"::text as raw, count(*)::bigint as n
       from "configs"
      where "level" = 'PLATFORM'
        and "value"::text ilike any(array['%GBP%','%"GB"%','%en-GB%','%Europe/London%'])
      group by 1, 2, 3
      order by 4 desc`,
  );

  for (const row of rows) {
    findings.push({
      kind: row.json_type === 'string' ? 'configScalar' : 'configNonScalar',
      ref: `configs.${row.key}`,
      value: row.raw,
      count: Number(row.n),
      jsonType: row.json_type,
    });
  }
}

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const findings = [];

  try {
    const covered = migrationCoverage();
    if (!covered) {
      console.warn('preflight: migration file not found — every finding will be reported as uncovered\n');
    }

    await auditTextColumns(prisma, covered, findings);
    await auditColumnDefaults(prisma, findings);
    await auditConfigJson(prisma, findings);
  } catch (err) {
    console.error(`preflight: audit could not run (${err.message})`);
    await prisma.$disconnect().catch(() => {});
    process.exit(2);
  }

  await prisma.$disconnect().catch(() => {});

  const group = (kind) => findings.filter((f) => f.kind === kind);
  const report = (title, items, note) => {
    if (items.length === 0) return;
    console.log(`\n${title}`);
    if (note) console.log(`  ${note}`);
    for (const f of items) {
      const value = f.value === undefined ? '' : ` ${JSON.stringify(f.value)}`;
      const count = f.count === undefined ? '' : ` — ${f.count} row(s)`;
      console.log(`  - ${f.ref}${value}${count}${f.detail ? ` (${f.detail})` : ''}`);
    }
  };

  const uncovered = group('uncovered');
  const silentMiss = group('silentMiss');
  const configNonScalar = group('configNonScalar');
  const unreadable = group('unreadable');
  const covered = group('covered');
  const configScalar = group('configScalar');

  console.log('=== US region normalisation pre-flight (read-only) ===');

  report('WILL BE MIGRATED', [...covered, ...configScalar], 'Exact-match values the migration rewrites.');

  report(
    'NOT COVERED BY THE MIGRATION',
    uncovered,
    'Region-ish columns holding UK values that no UPDATE in the migration touches.',
  );

  report(
    'SILENT MISSES (case or whitespace)',
    silentMiss,
    "Stored value differs from the literal the migration matches, so it is skipped AND passes verification.",
  );

  report(
    'CONFIG ROWS THAT ARE NOT BARE JSON STRINGS',
    configNonScalar,
    "The migration compares value #>> '{}', which only matches a JSON string scalar.",
  );

  report(
    'COLUMNS STILL DEFAULTING TO A UK VALUE',
    group('ukDefault'),
    'No UK rows may exist today, but the next insert will create one.',
  );

  report(
    'INTENTIONALLY EXCLUDED',
    group('excluded'),
    'UK values that are correct here and must not be rewritten.',
  );

  report('COLUMNS THAT COULD NOT BE READ', unreadable);

  const ukDefault = group('ukDefault');
  const blocking =
    uncovered.length +
    silentMiss.length +
    configNonScalar.length +
    unreadable.length +
    ukDefault.length;

  console.log('\n=== Summary ===');
  console.log(`  Will be migrated:        ${covered.length + configScalar.length}`);
  console.log(`  Not covered:             ${uncovered.length}`);
  console.log(`  Silent misses:           ${silentMiss.length}`);
  console.log(`  UK column defaults:      ${ukDefault.length}`);
  console.log(`  Non-scalar config rows:  ${configNonScalar.length}`);
  console.log(`  Unreadable columns:      ${unreadable.length}`);
  console.log(`  Intentionally excluded:  ${group('excluded').length}`);

  if (blocking > 0) {
    console.log('\nReview the above before applying the migration. Nothing has been changed.');
    process.exit(1);
  }

  console.log('\nNo gaps found. The migration covers every UK value present. Nothing has been changed.');
  process.exit(0);
})();
