import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type TemplateChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP';

export interface TemplateDefinition {
  slug: string;
  channel: TemplateChannel;
  subject?: string;
  body: string;
  variables: string[];
  description?: string;
}

/**
 * Built-in default templates.
 * Each uses `{{variableName}}` placeholders that are replaced at render time.
 */
const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  // ─── EMAIL ────────────────────────────────────────────────────────────
  {
    slug: 'order_confirmation',
    channel: 'EMAIL',
    subject: 'Order Confirmation - {{orderNumber}}',
    description: 'Sent to customers after an order is placed.',
    variables: ['orderNumber', 'customerName', 'itemsTable', 'orderTotal', 'currency'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#4a5568;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}
  th{background:#e2e8f0}
  .total{font-size:18px;font-weight:bold;text-align:right;margin-top:20px}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>Order Confirmation</h1></div>
  <div class="content">
    <h2>Thank you for your order, {{customerName}}!</h2>
    <p>Your order <strong>{{orderNumber}}</strong> has been confirmed.</p>
    {{itemsTable}}
    <div class="total">Total: {{currency}}{{orderTotal}}</div>
    <p>We'll send you another email when your order ships.</p>
  </div>
  <div class="footer"><p>House of Spells Marketplace</p></div>
</div></body></html>`,
  },
  {
    slug: 'order_shipped',
    channel: 'EMAIL',
    subject: 'Your Order Has Shipped - {{orderNumber}}',
    description: 'Sent when a shipment is dispatched.',
    variables: ['orderNumber', 'customerName', 'trackingCode', 'carrier'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#4299e1;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  .tracking{background:#edf2f7;padding:15px;border-radius:4px;margin:20px 0}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>Your Order Has Shipped!</h1></div>
  <div class="content">
    <h2>Great news, {{customerName}}!</h2>
    <p>Your order <strong>{{orderNumber}}</strong> has been shipped via {{carrier}}.</p>
    <div class="tracking"><strong>Tracking Code:</strong> {{trackingCode}}</div>
    <p>You can track your order using the tracking code above.</p>
  </div>
  <div class="footer"><p>House of Spells Marketplace</p></div>
</div></body></html>`,
  },
  {
    slug: 'order_delivered',
    channel: 'EMAIL',
    subject: 'Order Delivered - {{orderNumber}}',
    description: 'Sent when a delivery is confirmed.',
    variables: ['orderNumber', 'customerName'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#48bb78;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>Order Delivered!</h1></div>
  <div class="content">
    <h2>Your order has been delivered</h2>
    <p>Hi {{customerName}}, your order <strong>{{orderNumber}}</strong> has been successfully delivered.</p>
    <p>We hope you enjoy your purchase! If you have any questions, please don't hesitate to contact us.</p>
  </div>
  <div class="footer"><p>House of Spells Marketplace</p></div>
</div></body></html>`,
  },
  {
    slug: 'seller_invitation',
    channel: 'EMAIL',
    subject: "You've been invited to join House of Spells as a {{sellerTypeName}}",
    description: 'Sent to prospective sellers / wholesalers with a registration link.',
    variables: ['sellerTypeName', 'invitationLink', 'personalMessage'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#553c9a;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  .cta{display:inline-block;padding:12px 24px;background:#553c9a;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>Seller Invitation</h1></div>
  <div class="content">
    <h2>You're invited!</h2>
    <p>You've been invited to join <strong>House of Spells Marketplace</strong> as a <strong>{{sellerTypeName}}</strong>.</p>
    {{personalMessage}}
    <p><a class="cta" href="{{invitationLink}}">Accept Invitation</a></p>
    <p style="word-break:break-all;color:#4299e1;">{{invitationLink}}</p>
    <p>This invitation will expire in 7 days.</p>
  </div>
  <div class="footer"><p>House of Spells Marketplace - Your magical shopping destination</p></div>
</div></body></html>`,
  },
  {
    slug: 'influencer_invitation',
    channel: 'EMAIL',
    subject: "You've been invited to join House of Spells as an Influencer",
    description: 'Sent to prospective influencer partners with a registration link.',
    variables: ['invitationLink', 'personalMessage', 'commissionRate'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#d69e2e;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  .cta{display:inline-block;padding:12px 24px;background:#d69e2e;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>Influencer Invitation</h1></div>
  <div class="content">
    <h2>You're invited to be an Influencer!</h2>
    <p>You've been invited to join <strong>House of Spells Marketplace</strong> as an <strong>Influencer Partner</strong>.</p>
    <p>Earn {{commissionRate}}% commission on every sale through your unique referral links.</p>
    {{personalMessage}}
    <p><a class="cta" href="{{invitationLink}}">Accept Invitation</a></p>
    <p style="word-break:break-all;color:#4299e1;">{{invitationLink}}</p>
    <p>This invitation will expire in 7 days.</p>
  </div>
  <div class="footer"><p>House of Spells Marketplace - Your magical shopping destination</p></div>
</div></body></html>`,
  },
  {
    slug: 'password_reset',
    channel: 'EMAIL',
    subject: 'Reset Your Password - House of Spells',
    description: 'Sent when a user requests a password reset.',
    variables: ['customerName', 'resetLink', 'expiresInMinutes'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#e53e3e;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  .cta{display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>Password Reset</h1></div>
  <div class="content">
    <p>Hi {{customerName}},</p>
    <p>We received a request to reset your password. Click the button below to set a new password:</p>
    <p><a class="cta" href="{{resetLink}}">Reset Password</a></p>
    <p>This link will expire in {{expiresInMinutes}} minutes. If you didn't request this, please ignore this email.</p>
  </div>
  <div class="footer"><p>House of Spells Marketplace</p></div>
</div></body></html>`,
  },
  {
    slug: 'generic_notification',
    channel: 'EMAIL',
    subject: '{{subject}}',
    description: 'A catch-all notification for role/user specific emails.',
    variables: ['subject', 'bodyContent'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#4a5568;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>{{subject}}</h1></div>
  <div class="content">{{bodyContent}}</div>
  <div class="footer"><p>House of Spells Marketplace</p></div>
</div></body></html>`,
  },

  // ─── WHATSAPP ─────────────────────────────────────────────────────────
  {
    slug: 'whatsapp_order_confirmation',
    channel: 'WHATSAPP',
    description: 'WhatsApp notification for order confirmation.',
    variables: ['customerName', 'orderNumber', 'orderTotal', 'currency'],
    body: `Hi {{customerName}}, your order {{orderNumber}} has been confirmed! Total: {{currency}}{{orderTotal}}. Thank you for shopping with House of Spells!`,
  },
  {
    slug: 'whatsapp_order_shipped',
    channel: 'WHATSAPP',
    description: 'WhatsApp notification for order shipment.',
    variables: ['customerName', 'orderNumber', 'trackingCode', 'carrier'],
    body: `Hi {{customerName}}, your order {{orderNumber}} has shipped via {{carrier}}! Track with: {{trackingCode}}`,
  },
  {
    slug: 'whatsapp_order_delivered',
    channel: 'WHATSAPP',
    description: 'WhatsApp notification for order delivery.',
    variables: ['customerName', 'orderNumber'],
    body: `Hi {{customerName}}, your order {{orderNumber}} has been delivered. Enjoy your purchase! 🎉`,
  },

  // ─── SMS ──────────────────────────────────────────────────────────────
  {
    slug: 'sms_order_confirmation',
    channel: 'SMS',
    description: 'SMS notification for order confirmation.',
    variables: ['orderNumber', 'orderTotal'],
    body: 'HOS: Order {{orderNumber}} confirmed. Total: ${{orderTotal}}. Thank you!',
  },
  {
    slug: 'sms_order_shipped',
    channel: 'SMS',
    description: 'SMS notification for order shipment.',
    variables: ['orderNumber', 'trackingCode'],
    body: `HOS: Order {{orderNumber}} shipped. Track: {{trackingCode}}`,
  },
  {
    slug: 'sms_password_reset',
    channel: 'SMS',
    description: 'SMS code for password reset.',
    variables: ['resetCode', 'expiresInMinutes'],
    body: `HOS: Your password reset code is {{resetCode}}. Expires in {{expiresInMinutes}} min.`,
  },

  // ─── IN_APP ───────────────────────────────────────────────────────────
  {
    slug: 'inapp_order_confirmation',
    channel: 'IN_APP',
    description: 'In-app notification for order confirmation.',
    variables: ['orderNumber'],
    body: `Your order {{orderNumber}} has been confirmed.`,
  },
  {
    slug: 'inapp_order_shipped',
    channel: 'IN_APP',
    description: 'In-app notification for order shipment.',
    variables: ['orderNumber', 'trackingCode'],
    body: `Your order {{orderNumber}} has shipped. Tracking: {{trackingCode}}`,
  },
  {
    slug: 'inapp_order_delivered',
    channel: 'IN_APP',
    description: 'In-app notification for order delivery.',
    variables: ['orderNumber'],
    body: `Your order {{orderNumber}} has been delivered. Enjoy!`,
  },
  {
    slug: 'inapp_submission_approved',
    channel: 'IN_APP',
    description: 'In-app notification when a product submission is approved.',
    variables: ['productName'],
    body: `Your product "{{productName}}" has been approved and is now live!`,
  },
  {
    slug: 'inapp_submission_rejected',
    channel: 'IN_APP',
    description: 'In-app notification when a product submission is rejected.',
    variables: ['productName', 'reason'],
    body: `Your product "{{productName}}" was not approved. Reason: {{reason}}`,
  },
];

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Render a template by slug, substituting `{{variable}}` placeholders.
   *
   * @example
   *   const { subject, body } = await templateService.render('order_confirmation', {
   *     orderNumber: 'ORD-1234',
   *     customerName: 'Jane Doe',
   *     itemsTable: '<table>...</table>',
   *     orderTotal: '59.99',
   *     currency: '$',
   *   });
   */
  async render(
    slug: string,
    variables: Record<string, string>,
  ): Promise<{ subject: string; body: string; channel: TemplateChannel }> {
    const template = await this.resolve(slug);

    const replaceVars = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        if (variables[key] !== undefined) return variables[key];
        this.logger.warn(`Template "${slug}": missing variable "{{${key}}}"`);
        return '';
      });
    };

    return {
      subject: template.subject ? replaceVars(template.subject) : '',
      body: replaceVars(template.body),
      channel: template.channel,
    };
  }

  /**
   * Resolve a template: check DB override (WhatsApp table for WHATSAPP slugs),
   * then fall back to built-in defaults.
   */
  private async resolve(slug: string): Promise<TemplateDefinition> {
    const builtIn = BUILT_IN_TEMPLATES.find((t) => t.slug === slug);

    if (builtIn?.channel === 'WHATSAPP' || slug.startsWith('whatsapp_')) {
      try {
        const dbRow = await this.prisma.whatsAppTemplate.findUnique({
          where: { name: slug },
        });

        if (dbRow && dbRow.isActive) {
          return {
            slug: dbRow.name,
            channel: 'WHATSAPP',
            subject: undefined,
            body: dbRow.content,
            variables: dbRow.variables,
          };
        }
      } catch {
        // Table may not exist yet; fall through to built-in
      }
    }

    if (!builtIn) {
      throw new NotFoundException(`Template "${slug}" not found`);
    }
    return builtIn;
  }

  /**
   * List all available templates (built-in merged with DB overrides).
   */
  async listTemplates(channel?: TemplateChannel): Promise<TemplateDefinition[]> {
    let templates = [...BUILT_IN_TEMPLATES];
    if (channel) {
      templates = templates.filter((t) => t.channel === channel);
    }
    return templates;
  }

  /**
   * Get a single template definition (for preview / edit).
   */
  async getTemplate(slug: string): Promise<TemplateDefinition> {
    return this.resolve(slug);
  }

  /**
   * Preview a template by rendering it with example data.
   *
   * @example
   *   const preview = await templateService.preview('order_shipped');
   *   // Returns rendered HTML with sample values
   */
  async preview(slug: string): Promise<{ subject: string; body: string; channel: TemplateChannel }> {
    const template = await this.resolve(slug);
    const sampleVars: Record<string, string> = {};
    for (const v of template.variables) {
      sampleVars[v] = this.getSampleValue(v);
    }
    return this.render(slug, sampleVars);
  }

  /**
   * Create a custom DB-backed template override.
   */
  async createTemplate(data: {
    name: string;
    category: string;
    content: string;
    variables?: string[];
  }) {
    return this.prisma.whatsAppTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        content: data.content,
        variables: data.variables || [],
        isActive: true,
      },
    });
  }

  /**
   * Update a DB-backed template override.
   */
  async updateTemplate(
    slug: string,
    data: { content?: string; variables?: string[]; isActive?: boolean },
  ) {
    return this.prisma.whatsAppTemplate.update({
      where: { name: slug },
      data: {
        ...(data.content !== undefined && { content: data.content }),
        ...(data.variables !== undefined && { variables: data.variables }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      },
    });
  }

  private getSampleValue(variable: string): string {
    const samples: Record<string, string> = {
      orderNumber: 'ORD-20260219-001',
      customerName: 'Jane Doe',
      itemsTable: '<table><tr><td>Wand of Elder</td><td>1</td><td>$29.99</td><td>$29.99</td></tr></table>',
      orderTotal: '59.99',
      currency: '$',
      trackingCode: 'USPS-9400111899223456789012',
      carrier: 'USPS',
      sellerTypeName: 'B2C Seller',
      invitationLink: 'https://hos-marketplace.com/auth/accept-invitation?token=example',
      personalMessage: '<p>We think you would be a great fit for our marketplace!</p>',
      commissionRate: '10',
      resetLink: 'https://hos-marketplace.com/reset-password?token=example',
      resetCode: '482910',
      expiresInMinutes: '30',
      subject: 'New Product Submission',
      bodyContent: '<p>A new product has been submitted for review.</p>',
      productName: 'Marauder\'s Map Replica',
      reason: 'Image quality does not meet requirements.',
    };
    return samples[variable] || `[${variable}]`;
  }
}
