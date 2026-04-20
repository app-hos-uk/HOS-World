/**
 * Sample events + EVENT_ATTENDANCE earn rule for staging and demos.
 * Run: pnpm --filter @hos-marketplace/api db:seed-events
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findFirst({ where: { isActive: true } });
  const hpFandom = await prisma.fandom.findFirst({ where: { slug: 'harry-potter' } });
  const marvelFandom = await prisma.fandom.findFirst({ where: { slug: 'marvel' } });

  const defs: {
    slug: string;
    title: string;
    type: string;
    status: string;
    description: string;
    shortDescription: string;
    startsAtOffset: number;
    durationHours: number;
    capacity: number | null;
    attendancePoints: number;
    minTierLevel: number;
    tags: string[];
    isPublic: boolean;
    storeId?: string | null;
    fandomId?: string | null;
    virtualUrl?: string;
    virtualPlatform?: string;
    hostName?: string;
  }[] = [
    {
      slug: 'hp-wand-making-workshop',
      title: 'Harry Potter Wand Making Workshop',
      type: 'IN_STORE',
      status: 'PUBLISHED',
      description: 'Join us for an interactive wand-making experience at our flagship store.',
      shortDescription: 'Create your own custom wand with our master craftsmen',
      startsAtOffset: 10,
      durationHours: 2,
      capacity: 30,
      attendancePoints: 150,
      minTierLevel: 0,
      tags: ['harry-potter', 'workshop', 'family'],
      isPublic: true,
      storeId: store?.id,
      fandomId: hpFandom?.id,
      hostName: 'Master Ollivander (Dave)',
    },
    {
      slug: 'dragon-keeper-vip-after-hours',
      title: 'Dragon Keeper VIP After-Hours Experience',
      type: 'VIP_EXPERIENCE',
      status: 'PUBLISHED',
      description: 'An exclusive after-hours shopping event for Dragon Keeper+ members.',
      shortDescription: 'VIP shopping with exclusive previews and champagne',
      startsAtOffset: 20,
      durationHours: 3,
      capacity: 50,
      attendancePoints: 250,
      minTierLevel: 4,
      tags: ['vip', 'exclusive', 'shopping'],
      isPublic: false,
      storeId: store?.id,
    },
    {
      slug: 'wizarding-trivia-virtual',
      title: 'Wizarding World Trivia Night — Virtual Edition',
      type: 'VIRTUAL',
      status: 'PUBLISHED',
      description: 'Test your wizarding knowledge against fellow fans worldwide.',
      shortDescription: 'Live virtual trivia night with prizes',
      startsAtOffset: 25,
      durationHours: 2,
      capacity: null,
      attendancePoints: 100,
      minTierLevel: 0,
      tags: ['trivia', 'virtual', 'harry-potter'],
      isPublic: true,
      fandomId: hpFandom?.id,
      virtualUrl: 'https://zoom.us/j/placeholder',
      virtualPlatform: 'ZOOM',
    },
    {
      slug: 'marvel-cosplay-meetup',
      title: 'Marvel Cosplay Meetup',
      type: 'FAN_MEETUP',
      status: 'DRAFT',
      description: 'Assemble in your best Marvel cosplay for prizes and photo ops.',
      shortDescription: 'Cosplay meetup with prizes and photo ops',
      startsAtOffset: 40,
      durationHours: 5,
      capacity: 200,
      attendancePoints: 100,
      minTierLevel: 0,
      tags: ['marvel', 'cosplay'],
      isPublic: true,
      storeId: store?.id,
      fandomId: marvelFandom?.id,
    },
    {
      slug: 'enchanted-wands-launch',
      title: 'New Product Launch — Enchanted Wands Collection',
      type: 'PRODUCT_LAUNCH',
      status: 'DRAFT',
      description: 'Be the first to see and purchase our new Enchanted Wands collection.',
      shortDescription: 'Exclusive first look at new wand designs',
      startsAtOffset: 50,
      durationHours: 7,
      capacity: null,
      attendancePoints: 100,
      minTierLevel: 2,
      tags: ['product-launch', 'wands', 'exclusive'],
      isPublic: true,
      storeId: store?.id,
    },
  ];

  for (const d of defs) {
    const existing = await prisma.event.findUnique({ where: { slug: d.slug } });
    if (existing) {
      console.log(`Exists: ${d.slug}`);
      continue;
    }
    const startsAt = new Date(Date.now() + d.startsAtOffset * 86400000);
    const endsAt = new Date(startsAt.getTime() + d.durationHours * 3600000);
    await prisma.event.create({
      data: {
        title: d.title,
        slug: d.slug,
        description: d.description,
        shortDescription: d.shortDescription,
        type: d.type,
        status: d.status,
        startsAt,
        endsAt,
        timezone: 'Europe/London',
        capacity: d.capacity,
        isPublic: d.isPublic,
        minTierLevel: d.minTierLevel,
        allowedTierIds: [],
        attendancePoints: d.attendancePoints,
        storeId: d.storeId ?? undefined,
        fandomId: d.fandomId ?? undefined,
        tags: d.tags,
        hostName: d.hostName,
        virtualUrl: d.virtualUrl,
        virtualPlatform: d.virtualPlatform,
      },
    });
    console.log(`Created event: ${d.slug}`);
  }

  await prisma.loyaltyEarnRule.upsert({
    where: { action: 'EVENT_ATTENDANCE' },
    update: {},
    create: {
      name: 'Event Attendance',
      action: 'EVENT_ATTENDANCE',
      pointsAmount: 100,
      pointsType: 'FIXED',
      multiplierStack: true,
      maxPerDay: 2,
      isActive: true,
    },
  });
  console.log('EVENT_ATTENDANCE earn rule upserted');

  console.log('Event seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
