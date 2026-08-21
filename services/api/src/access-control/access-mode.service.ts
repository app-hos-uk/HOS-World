import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AccessControlMode } from '@hos-marketplace/shared-types';

const MODES: AccessControlMode[] = ['legacy', 'shadow', 'enforce'];

function parseMode(raw: unknown, fallback: AccessControlMode): AccessControlMode {
  if (typeof raw !== 'string') return fallback;
  const v = raw.trim().toLowerCase() as AccessControlMode;
  return MODES.includes(v) ? v : fallback;
}

/**
 * ACCESS_CONTROL_MODE=legacy|shadow|enforce
 * ACCESS_CONTROL_MODULE_MODES=orders:shadow,finance:legacy,admin:enforce
 * ACCESS_CONTROL_DATA_SCOPE=legacy|shadow|enforce
 */
@Injectable()
export class AccessModeService {
  private readonly globalMode: AccessControlMode;
  private readonly dataScopeMode: AccessControlMode;
  private readonly perModule = new Map<string, AccessControlMode>();

  constructor(private readonly config: ConfigService) {
    this.globalMode = parseMode(this.config.get('ACCESS_CONTROL_MODE'), 'legacy');
    this.dataScopeMode = parseMode(this.config.get('ACCESS_CONTROL_DATA_SCOPE'), 'legacy');

    const raw = this.config.get<string>('ACCESS_CONTROL_MODULE_MODES') || '';
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [mod, mode] = trimmed.split(':').map((s) => s.trim());
      if (mod && mode && MODES.includes(mode as AccessControlMode)) {
        this.perModule.set(mod.toLowerCase(), mode as AccessControlMode);
      }
    }
  }

  getGlobalMode(): AccessControlMode {
    return this.globalMode;
  }

  getDataScopeMode(): AccessControlMode {
    return this.dataScopeMode;
  }

  getModuleMode(moduleName?: string | null): AccessControlMode {
    if (moduleName) {
      const override = this.perModule.get(moduleName.toLowerCase());
      if (override) return override;
    }
    return this.globalMode;
  }
}
