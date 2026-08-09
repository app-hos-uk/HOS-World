#!/usr/bin/env node
/**
 * Guard for the fast path in docker-migrate.sh.
 *
 * `prisma migrate deploy` only reads _prisma_migrations. It cannot tell that a migration recorded
 * as applied never actually created its tables, which is the exact failure the direct `db execute`
 * repair steps exist to heal. Skipping those steps on the strength of migration metadata alone
 * would let the API boot against a physically incomplete schema.
 *
 * So before taking the fast path we check that the objects those repair files create are really
 * there. The file list is read out of docker-migrate.sh rather than duplicated here, so a repair
 * step added later is covered automatically.
 *
 * Exits 0 when everything is present, 1 when anything is missing or unverifiable, which sends
 * docker-migrate.sh down the full reconciliation path.
 */
const fs = require('fs');
const path = require('path');

const apiRoot = path.resolve(__dirname, '..');
const migrateScript = path.join(apiRoot, 'docker-migrate.sh');

function repairFiles() {
  const script = fs.readFileSync(migrateScript, 'utf8');
  const files = new Set();
  for (const match of script.matchAll(/--file\s+(\S+)/g)) {
    files.add(path.resolve(apiRoot, match[1]));
  }
  return [...files];
}

function expectedObjects(files) {
  const tables = new Set();
  const columns = new Set();

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const sql = fs.readFileSync(file, 'utf8');

    for (const m of sql.matchAll(
      /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi,
    )) {
      tables.add(m[1]);
    }
    // Only the first ADD COLUMN of a multi-clause ALTER is captured. That is enough: these files
    // are applied whole, so one missing column proves the file never ran.
    for (const m of sql.matchAll(
      /ALTER TABLE\s+(?:IF EXISTS\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi,
    )) {
      columns.add(`${m[1]}.${m[2]}`);
    }
  }

  return { tables: [...tables], columns: [...columns] };
}

(async () => {
  const files = repairFiles();
  if (files.length === 0) {
    console.error('verify-repair-objects: found no repair files to check — taking the slow path');
    process.exit(1);
  }

  const { tables, columns } = expectedObjects(files);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const presentTables = new Set(
      (
        await prisma.$queryRawUnsafe(
          `select table_name from information_schema.tables
             where table_schema = 'public' and table_name = any($1::text[])`,
          tables,
        )
      ).map((r) => r.table_name),
    );

    const presentColumns = new Set(
      (
        await prisma.$queryRawUnsafe(
          `select table_name || '.' || column_name as ref from information_schema.columns
             where table_schema = 'public' and table_name || '.' || column_name = any($1::text[])`,
          columns,
        )
      ).map((r) => r.ref),
    );

    const missing = [
      ...tables.filter((t) => !presentTables.has(t)).map((t) => `table ${t}`),
      ...columns.filter((c) => !presentColumns.has(c)).map((c) => `column ${c}`),
    ];

    if (missing.length > 0) {
      console.error(
        `verify-repair-objects: ${missing.length} object(s) missing, reconciliation needed:`,
      );
      missing.forEach((m) => console.error(`  - ${m}`));
      process.exit(1);
    }

    console.log(
      `verify-repair-objects: ${tables.length} tables and ${columns.length} columns present across ${files.length} repair files`,
    );
    process.exit(0);
  } catch (err) {
    console.error(`verify-repair-objects: check failed (${err.message}) — taking the slow path`);
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
})();
