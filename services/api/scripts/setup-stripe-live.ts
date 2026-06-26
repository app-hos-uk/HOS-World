/**
 * Stripe Live Mode setup — automates webhook creation + HOS integration storage.
 *
 * STEP 1 (manual): Stripe Dashboard → Developers → API keys
 *   Copy pk_live_... and sk_live_...
 *
 * STEP 2–4 (this script): Creates webhook, stores credentials, verifies.
 *
 * Usage (from services/api, linked to Railway API service):
 *   export STRIPE_PUBLISHABLE_KEY=pk_live_...
 *   export STRIPE_SECRET_KEY=sk_live_...
 *   railway run -- pnpm exec ts-node scripts/setup-stripe-live.ts
 *
 * Optional: STRIPE_WEBHOOK_SECRET=whsec_... (skip auto webhook creation)
 * Optional: WEBHOOK_URL=https://hos-marketplaceapi-production.up.railway.app/api/payments/webhook
 */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/integrations/encryption.service';

const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  'https://hos-marketplaceapi-production.up.railway.app/api/payments/webhook';

const WEBHOOK_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'charge.dispute.created',
];

function maskKey(key: string): string {
  if (key.length <= 12) return '***';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

async function stripeApi(secretKey: string, path: string, body?: Record<string, string | string[]>): Promise<any> {
  const params = new URLSearchParams();
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      if (Array.isArray(v)) {
        for (const item of v) params.append(k, item);
      } else {
        params.append(k, v);
      }
    }
  }
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? params.toString() : undefined,
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function findOrCreateWebhook(secretKey: string): Promise<string> {
  const existing = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (existing) {
    console.log(`Using STRIPE_WEBHOOK_SECRET from env (${maskKey(existing)})`);
    return existing;
  }

  console.log(`Looking for existing webhook: ${WEBHOOK_URL}`);
  const list = await stripeApi(secretKey, '/webhook_endpoints?limit=100');
  if (list.data) {
    const match = list.data.find((ep: { url: string }) => ep.url === WEBHOOK_URL);
    if (match) {
      console.log(`Found existing webhook endpoint: ${match.id}`);
      console.error(
        '❌ Webhook exists but signing secret is not returned by Stripe API on list.',
      );
      console.error('   Stripe Dashboard → Developers → Webhooks → your endpoint → Reveal signing secret');
      console.error('   Then run: export STRIPE_WEBHOOK_SECRET=whsec_... and re-run this script.');
      process.exit(1);
    }
  }

  console.log('Creating new webhook endpoint in Stripe...');
  const params = new URLSearchParams();
  params.append('url', WEBHOOK_URL);
  for (const event of WEBHOOK_EVENTS) params.append('enabled_events[]', event);

  const response = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const created = await response.json();
  if (!response.ok || !created.secret) {
    throw new Error(`Failed to create webhook: ${JSON.stringify(created).slice(0, 300)}`);
  }
  console.log(`✅ Webhook created: ${created.id}`);
  return created.secret;
}

async function upsertStripeIntegration(
  prisma: PrismaClient,
  encryptionService: EncryptionService,
  credentials: Record<string, string>,
): Promise<void> {
  const encrypted = encryptionService.encryptJson(credentials);
  const existing = await prisma.integrationConfig.findUnique({
    where: { category_provider: { category: 'PAYMENT', provider: 'stripe' } },
  });

  if (existing) {
    await prisma.integrationConfig.update({
      where: { id: existing.id },
      data: {
        displayName: 'Stripe',
        description: 'Online payment processing (live)',
        isActive: true,
        isTestMode: false,
        credentials: encrypted,
        testStatus: 'SUCCESS',
        lastTestedAt: new Date(),
      },
    });
    console.log('✅ Updated existing Stripe integration in database');
  } else {
    await prisma.integrationConfig.create({
      data: {
        category: 'PAYMENT',
        provider: 'stripe',
        displayName: 'Stripe',
        description: 'Online payment processing (live)',
        isActive: true,
        isTestMode: false,
        credentials: encrypted,
        settings: {},
        testStatus: 'SUCCESS',
        lastTestedAt: new Date(),
        priority: 0,
      },
    });
    console.log('✅ Created Stripe integration in database');
  }
}

async function main() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!publishableKey || !secretKey) {
    console.log('\n=== Stripe Live Setup — Manual Step 1 ===\n');
    console.log('1. Open https://dashboard.stripe.com/apikeys');
    console.log('2. Copy Publishable key (pk_live_...) and Secret key (sk_live_...)');
    console.log('3. Run again with env vars:\n');
    console.log('   export STRIPE_PUBLISHABLE_KEY=pk_live_...');
    console.log('   export STRIPE_SECRET_KEY=sk_live_...');
    console.log('   railway run -- pnpm exec ts-node scripts/setup-stripe-live.ts\n');
    process.exit(1);
  }

  if (!secretKey.startsWith('sk_live_')) {
    console.error('❌ STRIPE_SECRET_KEY must be a live key (sk_live_...) for live mode setup.');
    process.exit(1);
  }
  if (!publishableKey.startsWith('pk_live_')) {
    console.error('❌ STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) for live mode setup.');
    process.exit(1);
  }

  console.log('\n=== Stripe Live Setup ===\n');
  console.log(`Publishable key: ${maskKey(publishableKey)}`);
  console.log(`Secret key: ${maskKey(secretKey)}`);

  // Verify secret key
  const balance = await stripeApi(secretKey, '/balance');
  if (balance.error) {
    console.error('❌ Stripe API verification failed:', balance.error);
    process.exit(1);
  }
  console.log('✅ Stripe secret key verified (balance API accessible)');

  // Webhook
  const webhookSecret = await findOrCreateWebhook(secretKey);

  const credentials = {
    publishableKey,
    secretKey,
    webhookSecret,
  };

  const prisma = new PrismaClient();
  const configService = new ConfigService(process.env as Record<string, string>);
  const encryptionService = new EncryptionService(configService);
  encryptionService.onModuleInit();

  await upsertStripeIntegration(prisma, encryptionService, credentials);
  await prisma.$disconnect();

  console.log('\n=== Verification ===\n');
  console.log('Webhook URL:', WEBHOOK_URL);
  console.log('Webhook secret stored:', maskKey(webhookSecret));
  console.log('\n⚠️  Restart API service or activate integration in admin to hot-reload StripeProvider.');
  console.log('   Or wait for next deploy — credentials are in DB and active.\n');
  console.log('Next: In Stripe Dashboard → Webhooks, confirm endpoint shows Enabled.');
  console.log('Test: curl https://hos-marketplaceapi-production.up.railway.app/api/payments/config');
  console.log('      (should return stripePublishableKey after API reloads credentials)\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
