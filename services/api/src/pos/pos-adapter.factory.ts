import { BadRequestException, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { PlatformRegionService } from '../config/platform-region.service';
import { EncryptionService } from '../integrations/encryption.service';
import { RedisService } from '../cache/redis.service';
import type { POSAdapter } from './interfaces/pos-adapter.interface';
import type { LightspeedCredentials } from './interfaces/pos-types';
import { LightspeedAdapter } from './adapters/lightspeed/lightspeed.adapter';
import { PLATFORM_DEFAULT_CURRENCY } from '../common/currency-defaults';

@Injectable()
export class POSAdapterFactory implements OnModuleInit {
  private defaultCurrency = PLATFORM_DEFAULT_CURRENCY;

  constructor(
    private readonly encryption: EncryptionService,
    private readonly platformRegion: PlatformRegionService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async onModuleInit() {
    this.defaultCurrency = await this.platformRegion.getCurrency();
  }

  create(provider: string, encryptedCredentials: string): POSAdapter {
    const creds = this.encryption.decryptJson<LightspeedCredentials & Record<string, unknown>>(
      encryptedCredentials,
    );

    switch (provider.toLowerCase()) {
      case 'lightspeed': {
        const adapter = new LightspeedAdapter(
          {
            domainPrefix: String(creds.domainPrefix || ''),
            accessToken: creds.accessToken ? String(creds.accessToken) : undefined,
            refreshToken: creds.refreshToken ? String(creds.refreshToken) : undefined,
            expiresAt: typeof creds.expiresAt === 'number' ? creds.expiresAt : undefined,
            clientId: creds.clientId ? String(creds.clientId) : undefined,
            clientSecret: creds.clientSecret ? String(creds.clientSecret) : undefined,
          },
          this.defaultCurrency,
        );
        if (this.redis) {
          adapter.attachRedis(this.redis);
        }
        return adapter;
      }
      default:
        throw new BadRequestException(
          `POS provider "${provider}" is not supported. Supported: lightspeed`,
        );
    }
  }
}
