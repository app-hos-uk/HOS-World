/**
 * Optional DB overrides for WhatsApp marketing templates (built-ins also exist in TemplatesService).
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/marketing-template-seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const whatsappRows = [
  {
    name: 'whatsapp_welcome_quiz',
    category: 'MARKETING',
    content: 'Hi {{firstName}}! Take your first fandom quiz in the app and earn points.',
    variables: ['firstName'],
  },
  {
    name: 'whatsapp_birthday',
    category: 'MARKETING',
    content: 'Happy Birthday {{firstName}} from House of Spells!',
    variables: ['firstName'],
  },
];

async function main() {
  for (const row of whatsappRows) {
    await prisma.whatsAppTemplate.upsert({
      where: { name: row.name },
      create: {
        name: row.name,
        category: row.category,
        content: row.content,
        variables: row.variables,
        isActive: true,
      },
      update: {
        content: row.content,
        variables: row.variables,
        isActive: true,
      },
    });
    console.log(`WhatsApp template upserted: ${row.name}`);
  }
  console.log(
    'Marketing WhatsApp template seed complete. Email/PUSH/SMS marketing copy is served from built-in TemplatesService defaults.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
