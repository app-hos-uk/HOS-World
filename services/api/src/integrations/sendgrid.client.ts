import { Logger } from '@nestjs/common';
import { isValidEmailAddress, normalizeEmailAddress } from '../config/protected-admin-emails';

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
 * Raw SendGrid payloads are logged but never surfaced to admins — they leak
 * provider internals and are not actionable in the UI.
 */
function friendlySendGridError(status: number, rawBody: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'Email provider authentication failed. Please verify the SendGrid API key in Admin → Integrations.';
    case 413:
      return 'The email was rejected because it is too large.';
    case 429:
      return 'The email provider is rate limiting requests. Please try again shortly.';
    default:
      break;
  }

  if (status === 400) {
    // 400s are usually actionable configuration problems (unverified sender, bad address).
    if (/from address does not match a verified Sender Identity/i.test(rawBody)) {
      return 'The sender address is not a verified SendGrid Sender Identity. Verify it in SendGrid, or update the From address in Admin → Integrations.';
    }
    if (/does not contain a valid address/i.test(rawBody) || /valid address/i.test(rawBody)) {
      return 'SendGrid rejected the From/To address. Set a verified sender email (e.g. noreply@yourdomain.com) in Admin → Integrations → SendGrid → From Email.';
    }
    return 'The email provider rejected the message. Please check the sender and recipient addresses in Admin → Integrations.';
  }

  if (status >= 500) {
    return 'The email provider is temporarily unavailable. Please try again shortly.';
  }

  return 'The email could not be sent. Please check the SendGrid configuration in Admin → Integrations.';
}

/**
 * Send email via SendGrid v3 Mail Send API (no extra dependency).
 */
export async function sendViaSendGrid(params: SendGridSendParams): Promise<SendGridSendResult> {
  const { apiKey, subject, html, fromName } = params;
  const fromEmail = normalizeEmailAddress(params.fromEmail) || '';
  const to = normalizeEmailAddress(params.to) || '';

  if (!isValidEmailAddress(fromEmail)) {
    logger.error(`Refusing to send: invalid SendGrid sender address "${params.fromEmail}"`);
    return {
      success: false,
      error:
        'The configured sender address is not a valid email address. Update the From address in Admin → Integrations.',
    };
  }
  if (!isValidEmailAddress(to)) {
    return { success: false, error: 'The recipient address is not a valid email address.' };
  }

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
      error: friendlySendGridError(response.status, errorText),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SendGrid request failed: ${message}`);
    return {
      success: false,
      error: 'Could not reach the email provider. Please check network connectivity and try again.',
    };
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
    logger.error(`SendGrid key verification failed ${response.status}: ${errorText}`);
    return { success: false, error: friendlySendGridError(response.status, errorText) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SendGrid key verification request failed: ${message}`);
    return {
      success: false,
      error: 'Could not reach the email provider. Please check network connectivity and try again.',
    };
  }
}
