/**
 * Email Templates
 *
 * HTML email templates for various notification types.
 * These match the templates previously embedded in the monolith.
 */

const baseStyles = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #4a5568; color: white; padding: 20px; text-align: center; }
  .content { padding: 20px; background: #f7fafc; }
  .button { display: inline-block; padding: 12px 24px; background: #4299e1; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
`;

function wrap(headerBg: string, headerTitle: string, bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        ${baseStyles}
        .header { background: ${headerBg}; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #e2e8f0; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
        .tracking { background: #edf2f7; padding: 15px; border-radius: 4px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${headerTitle}</h1>
        </div>
        <div class="content">
          ${bodyHtml}
        </div>
        <div class="footer">
          <p>House of Spells Marketplace</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function sellerInvitationTemplate(
  sellerTypeName: string,
  invitationLink: string,
  message?: string,
): string {
  return wrap(
    '#4a5568',
    'House of Spells Marketplace',
    `
    <h2>You've Been Invited!</h2>
    <p>You have been invited to join House of Spells Marketplace as a <strong>${sellerTypeName}</strong>.</p>
    ${message ? `<p>${message}</p>` : ''}
    <a href="${invitationLink}" class="button">Accept Invitation</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #4299e1;">${invitationLink}</p>
    <p>This invitation will expire in 7 days.</p>
    `,
  );
}

export function orderConfirmationTemplate(
  orderNumber: string,
  items: Array<{ name: string; quantity: number; price: number }>,
  total: number,
): string {
  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>&pound;${item.price.toFixed(2)}</td>
      <td>&pound;${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `,
    )
    .join('');

  return wrap(
    '#4a5568',
    'Order Confirmation',
    `
    <h2>Thank you for your order!</h2>
    <p>Your order <strong>${orderNumber}</strong> has been confirmed.</p>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <div class="total">Total: &pound;${total.toFixed(2)}</div>
    <p>We'll send you another email when your order ships.</p>
    `,
  );
}

export function orderShippedTemplate(
  orderNumber: string,
  trackingCode: string,
): string {
  return wrap(
    '#4299e1',
    'Your Order Has Shipped!',
    `
    <h2>Great news!</h2>
    <p>Your order <strong>${orderNumber}</strong> has been shipped.</p>
    <div class="tracking">
      <strong>Tracking Code:</strong> ${trackingCode}
    </div>
    <p>You can track your order using the tracking code above.</p>
    `,
  );
}

export function orderDeliveredTemplate(orderNumber: string): string {
  return wrap(
    '#48bb78',
    'Order Delivered!',
    `
    <h2>Your order has been delivered</h2>
    <p>Your order <strong>${orderNumber}</strong> has been successfully delivered.</p>
    <p>We hope you enjoy your purchase! If you have any questions, please don't hesitate to contact us.</p>
    `,
  );
}

export function genericNotificationTemplate(
  subject: string,
  content: string,
): string {
  return wrap(
    '#4a5568',
    subject,
    `${content.replace(/\n/g, '<br>')}`,
  );
}
