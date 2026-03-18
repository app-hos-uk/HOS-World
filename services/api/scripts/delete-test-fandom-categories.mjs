#!/usr/bin/env node
/**
 * Deletes listed test fandom categories (and their descendant categories),
 * then removes or detaches associated products.
 *
 * Run: cd services/api && node scripts/delete-test-fandom-categories.mjs
 *      (uses DATABASE_URL from env or services/api/.env)
 * Dry run: DRY_RUN=1 node scripts/delete-test-fandom-categories.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrlFromEnvFile() {
  if (process.env.DATABASE_URL) return;
  const envFile = join(__dirname, '..', '.env');
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('DATABASE_URL=')) {
      let v = t.slice('DATABASE_URL='.length).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      process.env.DATABASE_URL = v;
      return;
    }
  }
}

const NAME_PATTERNS = [
  'Test Root Category - ',
  'Test Subcategory - ',
  'Test one',
];

async function collectDescendantIds(prisma, rootIds) {
  const all = new Set(rootIds);
  let frontier = [...rootIds];
  while (frontier.length) {
    const children = await prisma.category.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const next = children.map((c) => c.id).filter((id) => !all.has(id));
    next.forEach((id) => all.add(id));
    frontier = next;
  }
  return [...all];
}

async function main() {
  loadDatabaseUrlFromEnvFile();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required (env or services/api/.env)');
    process.exit(1);
  }
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const matched = await prisma.category.findMany({
      where: {
        OR: NAME_PATTERNS.map((p) => ({ name: { startsWith: p } })),
      },
      select: { id: true, name: true, slug: true, parentId: true, level: true },
    });

    if (matched.length === 0) {
      console.log('No categories matched the given names. Nothing to do.');
      return;
    }

    console.log(`Matched ${matched.length} categories by name:`);
    matched.forEach((c) => console.log(`  - ${c.name} (${c.slug})`));

    const rootIds = matched.map((c) => c.id);
    const categoryIds = await collectDescendantIds(prisma, rootIds);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, slug: true, level: true },
    });

    const slugs = [...new Set(categories.map((c) => c.slug))];
    const names = [...new Set(categories.map((c) => c.name))];

    const productWhere = {
      OR: [
        { categoryId: { in: categoryIds } },
        { fandom: { in: slugs } },
        { category: { in: slugs } },
        { category: { in: names } },
        { fandom: { in: names } },
      ],
    };

    const affectedProducts = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, name: true, slug: true },
    });

    const productIds = affectedProducts.map((p) => p.id);
    const orderedIds = (
      await prisma.orderItem.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true },
        distinct: ['productId'],
      })
    ).map((r) => r.productId);
    const orderedSet = new Set(orderedIds);
    const deletableIds = productIds.filter((id) => !orderedSet.has(id));
    const detachIds = productIds.filter((id) => orderedSet.has(id));

    console.log(`\nCategory subtree: ${categoryIds.length} categories (including descendants).`);
    console.log(`Products linked: ${productIds.length} (${deletableIds.length} deletable, ${detachIds.length} have order history — will detach only).`);

    if (dryRun) {
      console.log('\nDRY_RUN=1 — no changes made.');
      return;
    }

    // Step 1: delete products (outside the category transaction to avoid timeout)
    if (deletableIds.length) {
      await prisma.cartItem.deleteMany({ where: { productId: { in: deletableIds } } });
      await prisma.productSubmission.updateMany({
        where: { productId: { in: deletableIds } },
        data: { productId: null },
      });
      await prisma.discrepancy.updateMany({
        where: { productId: { in: deletableIds } },
        data: { productId: null },
      });
      await prisma.product.deleteMany({ where: { id: { in: deletableIds } } });
      console.log(`Deleted ${deletableIds.length} products.`);
    }

    if (detachIds.length) {
      await prisma.product.updateMany({
        where: { id: { in: detachIds } },
        data: { categoryId: null, fandom: null, category: null },
      });
      console.log(`Detached ${detachIds.length} products from fandom/category (kept for order history).`);
    }

    // Step 2: clear FK refs to categories
    await prisma.attribute.updateMany({
      where: { categoryId: { in: categoryIds } },
      data: { categoryId: null },
    });
    await prisma.returnPolicy.updateMany({
      where: { categoryId: { in: categoryIds } },
      data: { categoryId: null },
    });

    // Step 3: delete categories (deepest first)
    const byLevel = [...categories].sort((a, b) => b.level - a.level);
    let deleted = 0;
    for (const c of byLevel) {
      await prisma.category.delete({ where: { id: c.id } });
      deleted++;
    }
    console.log(`Deleted ${deleted} categories.`);

    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
