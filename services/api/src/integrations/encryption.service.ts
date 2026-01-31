import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * EncryptionService - Handles secure encryption/decryption of sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private encryptionKey: Buffer | null = null;
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly saltLength = 32; // 256 bits

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeEncryptionKey();
  }

  /**
   * Initialize the encryption key from environment variable
   * Key should be a 64-character hex string (32 bytes)
   */
  private initializeEncryptionKey(): void {
    const keyHex = this.configService.get<string>('INTEGRATION_ENCRYPTION_KEY');

    if (!keyHex) {
      this.logger.warn(
        'INTEGRATION_ENCRYPTION_KEY not set. Generating a temporary key for development. ' +
          'Set this environment variable in production!',
      );
      // Generate a deterministic key for development (NOT secure for production)
      const devKey = crypto
        .createHash('sha256')
        .update('hos-marketplace-dev-key-' + (this.configService.get('NODE_ENV') || 'development'))
        .digest();
      this.encryptionKey = devKey;
      return;
    }

    if (keyHex.length !== 64) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }

    try {
      this.encryptionKey = Buffer.from(keyHex, 'hex');
      this.logger.log('Encryption key initialized successfully');
    } catch (error) {
      throw new Error('Invalid INTEGRATION_ENCRYPTION_KEY format. Must be valid hex.');
    }
  }

  /**
   * Encrypt sensitive data (e.g., API credentials)
   * Returns a base64-encoded string containing: salt + iv + authTag + ciphertext
   */
  encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (!plaintext) {
      return '';
    }

    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);

      // Derive a unique key using PBKDF2 with the salt
      const derivedKey = crypto.pbkdf2Sync(
        this.encryptionKey,
        salt,
        100000, // iterations
        32, // key length
        'sha256',
      );

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv, {
        authTagLength: this.authTagLength,
      });

      // Encrypt
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine: salt + iv + authTag + ciphertext
      const combined = Buffer.concat([salt, iv, authTag, encrypted]);

      return combined.toString('base64');
    } catch (error: any) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * Expects base64-encoded string containing: salt + iv + authTag + ciphertext
   */
  decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (!encryptedData) {
      return '';
    }

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = combined.subarray(0, this.saltLength);
      const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
      const authTag = combined.subarray(
        this.saltLength + this.ivLength,
        this.saltLength + this.ivLength + this.authTagLength,
      );
      const ciphertext = combined.subarray(this.saltLength + this.ivLength + this.authTagLength);

      // Derive the same key using PBKDF2
      const derivedKey = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv, {
        authTagLength: this.authTagLength,
      });
      decipher.setAuthTag(authTag);

      // Decrypt
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error: any) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error(
        'Failed to decrypt data. The data may be corrupted or the key may have changed.',
      );
    }
  }

  /**
   * Encrypt a JSON object
   */
  encryptJson(data: Record<string, any>): string {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypt to a JSON object
   */
  decryptJson<T = Record<string, any>>(encryptedData: string): T {
    const decrypted = this.decrypt(encryptedData);
    if (!decrypted) {
      return {} as T;
    }
    try {
      return JSON.parse(decrypted) as T;
    } catch (error) {
      throw new Error('Decrypted data is not valid JSON');
    }
  }

  /**
   * Mask sensitive data for display (show only last N characters)
   */
  maskSecret(secret: string, visibleChars: number = 4): string {
    if (!secret || secret.length <= visibleChars) {
      return '****';
    }
    const masked = '*'.repeat(Math.min(secret.length - visibleChars, 20));
    return masked + secret.slice(-visibleChars);
  }

  /**
   * Mask all sensitive fields in a credentials object
   */
  maskCredentials(credentials: Record<string, any>): Record<string, any> {
    const masked: Record<string, any> = {};
    const sensitiveFields = [
      'apiKey',
      'api_key',
      'apiSecret',
      'api_secret',
      'secretKey',
      'secret_key',
      'password',
      'secret',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'privateKey',
      'private_key',
      'clientSecret',
      'client_secret',
      'licenseKey',
      'license_key',
      'webhookSecret',
    ];

    for (const [key, value] of Object.entries(credentials)) {
      if (
        typeof value === 'string' &&
        sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))
      ) {
        masked[key] = this.maskSecret(value);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskCredentials(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Generate a secure random webhook secret
   */
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a secure random API key
   */
  generateApiKey(prefix: string = 'hos'): string {
    const randomPart = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${randomPart}`;
  }

  /**
   * Hash a value using SHA-256 (for non-reversible storage)
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Verify a value against its hash
   */
  verifyHash(value: string, hashedValue: string): boolean {
    return this.hash(value) === hashedValue;
  }
}
