/**
 * One-off script: send test email via SendGrid credentials stored in integration_configs.
 * Usage (from services/api):
 *   pnpm ts-node scripts/send-test-email.ts arun@houseofspells.com
 *
 * Requires DATABASE_URL and INTEGRATION_ENCRYPTION_KEY (same as production API).
 */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/integrations/encryption.service';
import { sendViaSendGrid } from '../src/notifications/sendgrid.client';

const to = process.argv[2] || 'arun@houseofspells.com';

async function main() {
  const prisma = new PrismaClient();
  const configService = new ConfigService(process.env as Record<string, string>);
  const encryptionService = new EncryptionService(configService);
  encryptionService.onModuleInit();

  const integration = await prisma.integrationConfig.findFirst({
    where: { category: 'EMAIL', provider: 'sendgrid', isActive: true },
  });

  if (!integration) {
    console.error('No active SendGrid integration found in database.');
    console.error('Activate SendGrid under Admin → Settings → Integrations.');
    process.exit(1);
  }

  const credentials = encryptionService.decryptJson(String(integration.credentials));
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) {
    console.error('SendGrid integration has no apiKey.');
    process.exit(1);
  }

  const fromEmail = credentials.fromEmail?.trim() || process.env.SMTP_FROM || 'noreply@houseofspells.com';
  const fromName = credentials.fromName?.trim() || 'House of Spells';

  console.log(`Sending test email to ${to} from ${fromEmail} via SendGrid...`);

  const result = await sendViaSendGrid({
    apiKey,
    to,
    subject: 'House of Spells — Test Email',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2>Test email from House of Spells</h2>
        <p>This confirms outbound email from the marketplace application is working.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      </div>
    `,
    fromEmail,
    fromName,
  });

  if (result.success) {
    console.log('✅ Email sent successfully.');
    if (result.messageId) console.log(`Message ID: ${result.messageId}`);
    process.exit(0);
  }

  console.error('❌ Send failed:', result.error);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
