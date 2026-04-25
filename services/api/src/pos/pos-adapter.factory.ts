import { BadRequestException, Injectable } from '@nestjs/common';
import { EncryptionService } from '../integrations/encryption.service';
import type { POSAdapter } from './interfaces/pos-adapter.interface';
import type { LightspeedCredentials } from './interfaces/pos-types';
import { LightspeedAdapter } from './adapters/lightspeed/lightspeed.adapter';

@Injectable()
export class POSAdapterFactory {
  constructor(private readonly encryption: EncryptionService) {}

  create(provider: string, encryptedCredentials: string): POSAdapter {
    const creds = this.encryption.decryptJson<LightspeedCredentials & Record<string, unknown>>(
      encryptedCredentials,
    );

    switch (provider.toLowerCase()) {
      case 'lightspeed':
        return new LightspeedAdapter({
          domainPrefix: String(creds.domainPrefix || ''),
          accessToken: creds.accessToken ? String(creds.accessToken) : undefined,
          refreshToken: creds.refreshToken ? String(creds.refreshToken) : undefined,
          expiresAt: typeof creds.expiresAt === 'number' ? creds.expiresAt : undefined,
          clientId: creds.clientId ? String(creds.clientId) : undefined,
          clientSecret: creds.clientSecret ? String(creds.clientSecret) : undefined,
        });
      default:
        throw new BadRequestException(
          `POS provider "${provider}" is not supported. Supported: lightspeed`,
        );
    }
  }
}
