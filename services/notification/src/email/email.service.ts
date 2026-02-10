import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email Service
 *
 * Handles SMTP transport and sending of HTML emails.
 * Gracefully degrades to logging when SMTP is not configured.
 */
@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);
  private emailEnabled: boolean;
  private readonly fromAddress: string;

  constructor(private configService: ConfigService) {
    this.fromAddress = this.configService.get(
      'SMTP_FROM',
      'noreply@hos-marketplace.com',
    );
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpPort = this.configService.get('SMTP_PORT', 587);
    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPass = this.configService.get('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort.toString()),
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          from: this.fromAddress,
        });

        this.emailEnabled = true;
        this.logger.log('Email transporter initialized successfully');
      } catch (error: any) {
        this.logger.warn(
          `Email transporter initialization failed: ${error?.message}`,
        );
        this.emailEnabled = false;
      }
    } else {
      this.logger.warn(
        'Email configuration missing - set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email',
      );
      this.emailEnabled = false;
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    if (!this.emailEnabled || !this.transporter) {
      this.logger.debug(`Email would be sent to ${to}: ${subject} (email disabled)`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${to}: ${error?.message}`);
      return false;
    }
  }

  isEnabled(): boolean {
    return this.emailEnabled;
  }
}
