/**
 * Dev helper — lists stores and POS state. Does not create encrypted credentials.
 *   cd services/api && pnpm exec ts-node prisma/seeds/pos-seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({
    take: 20,
    orderBy: { code: 'asc' },
    include: { posConnection: true, seller: { select: { id: true, storeName: true } } },
  });

  console.log('Stores (sample):');
  for (const s of stores) {
    console.log(
      `  ${s.code} | ${s.name} | sellerId=${s.sellerId ?? 'null'} | pos=${s.posConnection ? s.posConnection.provider : 'none'}`,
    );
  }

  const sales = await prisma.pOSSale.count();
  const mappings = await prisma.externalEntityMapping.count();
  console.log(`\nPOSSales: ${sales} | ExternalEntityMappings: ${mappings}`);
  console.log('\nCreate connections via Admin API POST /admin/pos/connections (credentials are encrypted server-side).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
