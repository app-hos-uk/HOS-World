import { Logger } from '@nestjs/common';

export interface SendGridSendParams {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  fromEmail: string;
  fromName?: string;
}

export interface SendGridSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const logger = new Logger('SendGridClient');

/**
 * Send email via SendGrid v3 Mail Send API (no extra dependency).
 */
export async function sendViaSendGrid(params: SendGridSendParams): Promise<SendGridSendResult> {
  const { apiKey, to, subject, html, fromEmail, fromName } = params;

  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: {
      email: fromEmail,
      ...(fromName ? { name: fromName } : {}),
    },
    subject,
    content: [{ type: 'text/html', value: html }],
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const messageId = response.headers.get('x-message-id');
      return { success: true, messageId: messageId || undefined };
    }

    const errorText = await response.text();
    logger.error(`SendGrid API error ${response.status}: ${errorText}`);
    return {
      success: false,
      error: `SendGrid ${response.status}: ${errorText.slice(0, 500)}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SendGrid request failed: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Verify API key with SendGrid user profile endpoint (no email sent).
 */
export async function verifySendGridApiKey(apiKey: string): Promise<SendGridSendResult> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.ok) {
      return { success: true };
    }

    const errorText = await response.text();
    return { success: false, error: `SendGrid ${response.status}: ${errorText.slice(0, 500)}` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
