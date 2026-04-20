import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type TemplateChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP' | 'PUSH';

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
    slug: 'abandoned_cart',
    channel: 'EMAIL',
    subject: 'You left something in your cart',
    description: 'Sent when a logged-in customer has items in cart but has not checked out for a while.',
    variables: ['customerName', 'itemsTable', 'cartTotal', 'cartLink'],
    body: `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:#553c9a;color:#fff;padding:20px;text-align:center}
  .content{padding:20px;background:#f7fafc}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}
  th{background:#e2e8f0}
  .cta{display:inline-block;padding:12px 24px;background:#553c9a;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0}
  .total{font-size:18px;font-weight:bold;text-align:right;margin-top:12px}
  .footer{text-align:center;padding:20px;color:#718096;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header"><h1>Your cart is waiting</h1></div>
  <div class="content">
    <h2>Hi {{customerName}},</h2>
    <p>You still have items saved in your cart. Complete your order whenever you are ready.</p>
    {{itemsTable}}
    <div class="total">Cart subtotal: {{cartTotal}}</div>
    <p><a class="cta" href="{{cartLink}}">Return to cart</a></p>
    <p style="word-break:break-all;color:#4299e1;">{{cartLink}}</p>
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

  // ─── Phase 4 — Marketing journeys ─────────────────────────────────────
  {
    slug: 'welcome_loyalty',
    channel: 'EMAIL',
    subject: 'Welcome to The Enchanted Circle',
    variables: ['firstName', 'tierName'],
    body: `<p>Hi {{firstName}}, welcome to The Enchanted Circle! You're starting as {{tierName}}.</p>`,
  },
  {
    slug: 'welcome_explore',
    channel: 'EMAIL',
    subject: 'Discover Your First Quest',
    variables: ['firstName'],
    body: `<p>Hi {{firstName}}, explore quests and quizzes to earn bonus points this week.</p>`,
  },
  {
    slug: 'welcome_first_purchase',
    channel: 'EMAIL',
    subject: 'Your First Enchanted Purchase Awaits',
    variables: ['firstName'],
    body: `<p>{{firstName}}, enjoy 10% off your first order with code ENCHANTED10.</p>`,
  },
  {
    slug: 'whatsapp_welcome_quiz',
    channel: 'WHATSAPP',
    variables: ['firstName'],
    body: `Hi {{firstName}}! Take your first fandom quiz in the app and earn points.`,
  },
  {
    slug: 'post_purchase_thankyou',
    channel: 'EMAIL',
    subject: 'Thanks for Your Order!',
    variables: ['orderNumber', 'loyaltyPointsEarned', 'firstName'],
    body: `<p>Thanks {{firstName}}! Order {{orderNumber}} is confirmed. You earned {{loyaltyPointsEarned}} points.</p>`,
  },
  {
    slug: 'post_purchase_review',
    channel: 'EMAIL',
    subject: 'How Was Your Purchase?',
    variables: ['productName', 'firstName'],
    body: `<p>Hi {{firstName}}, how was {{productName}}? Leave a review for 25 points.</p>`,
  },
  {
    slug: 'tier_upgrade_congrats',
    channel: 'EMAIL',
    subject: 'Congratulations on Your New Tier!',
    variables: ['newTier', 'oldTier', 'firstName'],
    body: `<p>{{firstName}}, you've moved from {{oldTier}} to {{newTier}}! Enjoy new perks.</p>`,
  },
  {
    slug: 'tier_upgrade_push',
    channel: 'PUSH',
    subject: 'Tier upgrade!',
    variables: ['newTier'],
    body: `Congratulations! You're now {{newTier}}.`,
  },
  {
    slug: 'tier_upgrade_benefits',
    channel: 'EMAIL',
    subject: 'Your New Tier Benefits',
    variables: ['newTier', 'firstName'],
    body: `<p>{{firstName}}, don't miss your {{newTier}} member benefits.</p>`,
  },
  {
    slug: 'birthday_greeting',
    channel: 'EMAIL',
    subject: 'Happy Birthday!',
    variables: ['firstName', 'bonusPoints'],
    body: `<p>Happy Birthday {{firstName}}! {{bonusPoints}} bonus points are waiting in your wallet.</p>`,
  },
  {
    slug: 'whatsapp_birthday',
    channel: 'WHATSAPP',
    variables: ['firstName'],
    body: `Happy Birthday {{firstName}} from House of Spells!`,
  },
  {
    slug: 'birthday_reminder',
    channel: 'EMAIL',
    subject: 'Your Birthday Bonus Expires Soon',
    variables: ['firstName'],
    body: `<p>{{firstName}}, redeem your birthday bonus before it expires.</p>`,
  },
  {
    slug: 'abandoned_cart_reminder',
    channel: 'EMAIL',
    subject: 'You Left Something Enchanted Behind',
    variables: ['firstName', 'cartTotal'],
    body: `<p>{{firstName}}, your cart ({{cartTotal}}) is waiting. Complete checkout anytime.</p>`,
  },
  {
    slug: 'abandoned_cart_incentive',
    channel: 'EMAIL',
    subject: 'Complete Your Order for Double Points',
    variables: ['firstName'],
    body: `<p>{{firstName}}, finish your order this weekend and earn double points.</p>`,
  },
  {
    slug: 'abandoned_cart_final',
    channel: 'EMAIL',
    subject: 'Last Chance — Items May Sell Out',
    variables: ['firstName'],
    body: `<p>Last reminder {{firstName}} — your cart items may not stay in stock.</p>`,
  },
  {
    slug: 'winback_miss_you',
    channel: 'EMAIL',
    subject: 'We Miss You!',
    variables: ['firstName'],
    body: `<p>We miss you {{firstName}}! Here's what's new at House of Spells.</p>`,
  },
  {
    slug: 'winback_incentive',
    channel: 'EMAIL',
    subject: 'Come Back for 2x Points',
    variables: ['firstName'],
    body: `<p>{{firstName}}, come back this weekend for 2x points on qualifying purchases.</p>`,
  },
  {
    slug: 'winback_final',
    channel: 'EMAIL',
    subject: 'Your Points Are Waiting',
    variables: ['firstName'],
    body: `<p>{{firstName}}, your Enchanted Circle points are waiting — don't let them expire.</p>`,
  },
  {
    slug: 'points_expiry_30d',
    channel: 'EMAIL',
    subject: 'Points Expiring Soon',
    variables: ['expiringPoints', 'expiryDate'],
    body: `<p>{{expiringPoints}} points expire on {{expiryDate}}. Use them on your next order.</p>`,
  },
  {
    slug: 'points_expiry_14d',
    channel: 'EMAIL',
    subject: '14 Days Left to Use Your Points',
    variables: ['expiringPoints'],
    body: `<p>Only 14 days left to use {{expiringPoints}} points.</p>`,
  },
  {
    slug: 'points_expiry_final',
    channel: 'EMAIL',
    subject: 'Last 4 Days — Use Your Points Now',
    variables: ['expiringPoints'],
    body: `<p>Last call: {{expiringPoints}} points expire in 4 days.</p>`,
  },

  // ─── Phase 5 — Events & experiences ───────────────────────────────────
  {
    slug: 'event_rsvp_confirmation',
    channel: 'EMAIL',
    subject: 'Your RSVP is Confirmed!',
    variables: ['firstName', 'eventTitle', 'ticketCode', 'startsAt', 'unsubscribeUrl'],
    body: `<p>Hi {{firstName}}, you're confirmed for <strong>{{eventTitle}}</strong>.</p><p>Ticket code: <strong>{{ticketCode}}</strong></p><p>Starts: {{startsAt}}</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>`,
  },
  {
    slug: 'event_reminder_24h',
    channel: 'EMAIL',
    subject: 'Tomorrow: {{eventTitle}}',
    variables: ['firstName', 'eventTitle', 'startsAt', 'unsubscribeUrl'],
    body: `<p>Hi {{firstName}}, reminder: {{eventTitle}} is tomorrow ({{startsAt}}).</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>`,
  },
  {
    slug: 'event_starting_soon',
    channel: 'PUSH',
    subject: 'Starting soon',
    variables: ['eventTitle', 'unsubscribeUrl'],
    body: `Starting soon: {{eventTitle}}`,
  },
  {
    slug: 'event_thankyou',
    channel: 'EMAIL',
    subject: 'Thanks for Attending {{eventTitle}}!',
    variables: ['firstName', 'eventTitle', 'unsubscribeUrl'],
    body: `<p>Hi {{firstName}}, thanks for joining {{eventTitle}}!</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>`,
  },
  {
    slug: 'event_cancelled_notice',
    channel: 'EMAIL',
    subject: 'Event Cancelled: {{eventTitle}}',
    variables: ['firstName', 'eventTitle', 'reason', 'unsubscribeUrl'],
    body: `<p>Hi {{firstName}}, {{eventTitle}} has been cancelled. {{reason}}</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>`,
  },
  {
    slug: 'event_waitlist_promoted',
    channel: 'EMAIL',
    subject: "You're In! {{eventTitle}}",
    variables: ['firstName', 'eventTitle', 'ticketCode', 'startsAt', 'unsubscribeUrl'],
    body: `<p>Great news {{firstName}} — you're confirmed for {{eventTitle}}!</p><p>Ticket: {{ticketCode}}</p><p>{{startsAt}}</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>`,
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

    const escapeHtml = (str: string): string =>
      str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeVarPattern = /^(https?:\/\/\S+)$/i;

    const replaceVars = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        if (variables[key] === undefined) {
          this.logger.warn(`Template "${slug}": missing variable "{{${key}}}"`);
          return '';
        }
        const val = variables[key];
        if (key.toLowerCase().includes('table') || key.toLowerCase().includes('html')) {
          return val;
        }
        if (key.toLowerCase().includes('link') || key.toLowerCase().includes('url')) {
          // Safe http(s) URLs: use raw value in href="{{...}}" — escaping would break the URL
          return safeVarPattern.test(val) ? val : escapeHtml(val);
        }
        return escapeHtml(val);
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
