/**
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/journey-seed.ts
 * Seeds 7 built-in marketing journeys (Phase 4).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const journeys = [
  {
    slug: 'welcome-series',
    name: 'Welcome series',
    description: '4-step welcome over several days after loyalty enrollment',
    triggerEvent: 'LOYALTY_WELCOME',
    steps: [
      { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'welcome_loyalty' },
      { stepIndex: 1, type: 'WAIT', delayMinutes: 1440 },
      { stepIndex: 2, type: 'SEND', channel: 'EMAIL', templateSlug: 'welcome_explore' },
      { stepIndex: 3, type: 'WAIT', delayMinutes: 4320 },
      {
        stepIndex: 4,
        type: 'CONDITION',
        condition: {
          field: 'user.loyaltyMembership.purchaseCount',
          operator: 'eq',
          value: 0,
        },
        skipToStep: 7,
      },
      { stepIndex: 5, type: 'SEND', channel: 'EMAIL', templateSlug: 'welcome_first_purchase' },
      { stepIndex: 6, type: 'WAIT', delayMinutes: 2880 },
      { stepIndex: 7, type: 'SEND', channel: 'WHATSAPP', templateSlug: 'whatsapp_welcome_quiz' },
    ],
  },
  {
    slug: 'post-purchase',
    name: 'Post-purchase thank you',
    description: 'Thank you + review request after order paid',
    triggerEvent: 'ORDER_PAID',
    steps: [
      { stepIndex: 0, type: 'WAIT', delayMinutes: 120 },
      {
        stepIndex: 1,
        type: 'SEND',
        channel: 'USER_PREFERRED',
        templateSlug: 'post_purchase_thankyou',
      },
      { stepIndex: 2, type: 'WAIT', delayMinutes: 10080 },
      { stepIndex: 3, type: 'SEND', channel: 'EMAIL', templateSlug: 'post_purchase_review' },
    ],
  },
  {
    slug: 'tier-upgrade',
    name: 'Tier upgrade celebration',
    description: 'Email + push + follow-up benefits',
    triggerEvent: 'LOYALTY_TIER_UPGRADE',
    steps: [
      { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'tier_upgrade_congrats' },
      { stepIndex: 1, type: 'SEND', channel: 'PUSH', templateSlug: 'tier_upgrade_push' },
      { stepIndex: 2, type: 'WAIT', delayMinutes: 2880 },
      {
        stepIndex: 3,
        type: 'SEND',
        channel: 'USER_PREFERRED',
        templateSlug: 'tier_upgrade_benefits',
      },
    ],
  },
  {
    slug: 'birthday-celebration',
    name: 'Birthday flow',
    description: 'Greeting + WhatsApp + optional reminder',
    triggerEvent: 'LOYALTY_BIRTHDAY',
    steps: [
      { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'birthday_greeting' },
      { stepIndex: 1, type: 'SEND', channel: 'WHATSAPP', templateSlug: 'whatsapp_birthday' },
      { stepIndex: 2, type: 'WAIT', delayMinutes: 10080 },
      {
        stepIndex: 3,
        type: 'CONDITION',
        condition: { field: 'metadata.birthdayRedeemed', operator: 'eq', value: false },
        skipToStep: 5,
      },
      { stepIndex: 4, type: 'SEND', channel: 'EMAIL', templateSlug: 'birthday_reminder' },
    ],
  },
  {
    slug: 'abandoned-cart',
    name: 'Abandoned cart recovery',
    description: '3-touch recovery sequence',
    triggerEvent: 'CART_ABANDONED',
    steps: [
      { stepIndex: 0, type: 'WAIT', delayMinutes: 60 },
      { stepIndex: 1, type: 'SEND', channel: 'EMAIL', templateSlug: 'abandoned_cart_reminder' },
      { stepIndex: 2, type: 'WAIT', delayMinutes: 1440 },
      {
        stepIndex: 3,
        type: 'CONDITION',
        condition: { field: 'metadata.cartRecovered', operator: 'eq', value: false },
        skipToStep: 8,
      },
      {
        stepIndex: 4,
        type: 'SEND',
        channel: 'USER_PREFERRED',
        templateSlug: 'abandoned_cart_incentive',
      },
      { stepIndex: 5, type: 'WAIT', delayMinutes: 2880 },
      {
        stepIndex: 6,
        type: 'CONDITION',
        condition: { field: 'metadata.cartRecovered', operator: 'eq', value: false },
        skipToStep: 8,
      },
      { stepIndex: 7, type: 'SEND', channel: 'EMAIL', templateSlug: 'abandoned_cart_final' },
    ],
  },
  {
    slug: 'win-back',
    name: 'Win-back inactive members',
    description: 'Re-engage 60-day inactive members',
    triggerEvent: 'MEMBER_INACTIVE',
    steps: [
      { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'winback_miss_you' },
      { stepIndex: 1, type: 'WAIT', delayMinutes: 10080 },
      {
        stepIndex: 2,
        type: 'CONDITION',
        condition: { field: 'metadata.reactivated', operator: 'eq', value: false },
        skipToStep: 7,
      },
      { stepIndex: 3, type: 'SEND', channel: 'USER_PREFERRED', templateSlug: 'winback_incentive' },
      { stepIndex: 4, type: 'WAIT', delayMinutes: 20160 },
      {
        stepIndex: 5,
        type: 'CONDITION',
        condition: { field: 'metadata.reactivated', operator: 'eq', value: false },
        skipToStep: 7,
      },
      { stepIndex: 6, type: 'SEND', channel: 'EMAIL', templateSlug: 'winback_final' },
    ],
  },
  {
    slug: 'points-expiry-warning',
    name: 'Points expiry warnings',
    description: '30d / 14d / final reminders',
    triggerEvent: 'POINTS_EXPIRY_WARNING',
    steps: [
      { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'points_expiry_30d' },
      { stepIndex: 1, type: 'WAIT', delayMinutes: 20160 },
      {
        stepIndex: 2,
        type: 'CONDITION',
        condition: { field: 'metadata.pointsStillExpiring', operator: 'eq', value: true },
        skipToStep: 6,
      },
      {
        stepIndex: 3,
        type: 'SEND',
        channel: 'USER_PREFERRED',
        templateSlug: 'points_expiry_14d',
      },
      { stepIndex: 4, type: 'WAIT', delayMinutes: 14400 },
      { stepIndex: 5, type: 'SEND', channel: 'EMAIL', templateSlug: 'points_expiry_final' },
    ],
  },
  {
    slug: 'event-rsvp-followup',
    name: 'Event RSVP follow-up',
    description: 'Light touch after a member RSVPs (Phase 5 bus: EVENT_RSVP)',
    triggerEvent: 'EVENT_RSVP',
    steps: [
      { stepIndex: 0, type: 'WAIT', delayMinutes: 60 },
      { stepIndex: 1, type: 'SEND', channel: 'EMAIL', templateSlug: 'event_rsvp_confirmation' },
    ],
  },
  {
    slug: 'event-post-attendance',
    name: 'Post-event thank you',
    description: 'Thanks after check-in (Phase 5 bus: EVENT_ATTENDED)',
    triggerEvent: 'EVENT_ATTENDED',
    steps: [{ stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'event_thankyou' }],
  },
  {
    slug: 'event-reminder-journey',
    name: 'Event reminder journey',
    description: 'Optional extra touch when reminder job fires (EVENT_REMINDER_DUE)',
    triggerEvent: 'EVENT_REMINDER_DUE',
    steps: [{ stepIndex: 0, type: 'SEND', channel: 'PUSH', templateSlug: 'event_starting_soon' }],
  },
];

async function main() {
  for (const j of journeys) {
    await prisma.marketingJourney.upsert({
      where: { slug: j.slug },
      create: {
        slug: j.slug,
        name: j.name,
        description: j.description,
        triggerEvent: j.triggerEvent,
        steps: j.steps as object,
        isActive: true,
        regionCodes: [],
        channelCodes: [],
      },
      update: {
        name: j.name,
        description: j.description,
        triggerEvent: j.triggerEvent,
        steps: j.steps as object,
        isActive: true,
      },
    });
    console.log(`Journey upserted: ${j.slug}`);
  }
  console.log('Journey seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
