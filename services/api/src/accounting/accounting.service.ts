import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { isTruthy } from '../common/utils/config';
import { EncryptionService } from '../integrations/encryption.service';
import { JournalBuilderService } from './journal-builder.service';
import { LedgerOutboxService } from './ledger-outbox.service';
import { XeroAuthService } from './xero-auth.service';
import { XeroApiClient } from './xero-api.client';
import {
  DEFAULT_COA_MAPPING,
  LedgerEntryType,
  XERO_INTEGRATION_CATEGORY,
  XERO_INTEGRATION_PROVIDER,
  type ChartOfAccountsMapping,
} from './accounting.types';

const COA_SETTINGS_KEY = 'chartOfAccounts';

@Injectable()
export class AccountingService {
  constructor(
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private journals: JournalBuilderService,
    private outbox: LedgerOutboxService,
    private xeroAuth: XeroAuthService,
    private xeroApi: XeroApiClient,
  ) {}

  /**
   * Production-safe gate: both ACCOUNTING_ENABLED env and FeatureFlag.ACCOUNTING_XERO
   * must be on (both default false).
   */
  isEnabled(): boolean {
    return (
      isTruthy(this.config.get<string>('ACCOUNTING_ENABLED')) &&
      this.featureFlags.isEnabled(FeatureFlag.ACCOUNTING_XERO)
    );
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Accounting/Xero is disabled (ACCOUNTING_ENABLED + FeatureFlag.ACCOUNTING_XERO)',
      );
    }
  }

  async getStatus() {
    const connection = await this.xeroAuth.getConnectionStatus();
    return {
      enabled: this.isEnabled(),
      accountingEnabledEnv: isTruthy(this.config.get<string>('ACCOUNTING_ENABLED')),
      featureFlag: this.featureFlags.isEnabled(FeatureFlag.ACCOUNTING_XERO),
      connection,
      coaMapping: await this.getCoaMapping(),
    };
  }

  async getCoaMapping(): Promise<ChartOfAccountsMapping> {
    const row = await this.prisma.integrationConfig.findUnique({
      where: {
        category_provider: {
          category: XERO_INTEGRATION_CATEGORY,
          provider: XERO_INTEGRATION_PROVIDER,
        },
      },
    });
    const settings = (row?.settings || {}) as Record<string, unknown>;
    const mapped = settings[COA_SETTINGS_KEY] as Partial<ChartOfAccountsMapping> | undefined;
    return { ...DEFAULT_COA_MAPPING, ...(mapped || {}) };
  }

  /** Stub: persist JSON CoA mapping on the Xero integration settings. */
  async updateCoaMapping(
    mapping: Partial<ChartOfAccountsMapping>,
  ): Promise<ChartOfAccountsMapping> {
    this.assertEnabled();
    const next = { ...(await this.getCoaMapping()), ...mapping };

    const existing = await this.prisma.integrationConfig.findUnique({
      where: {
        category_provider: {
          category: XERO_INTEGRATION_CATEGORY,
          provider: XERO_INTEGRATION_PROVIDER,
        },
      },
    });

    if (!existing) {
      // Create a placeholder integration row (no tokens yet) for settings storage.
      await this.prisma.integrationConfig.create({
        data: {
          category: XERO_INTEGRATION_CATEGORY,
          provider: XERO_INTEGRATION_PROVIDER,
          displayName: 'Xero Accounting',
          description: 'HOS → Xero daily summary manual journals',
          isActive: false,
          isTestMode: true,
          credentials: this.encryption.encryptJson({}),
          settings: { [COA_SETTINGS_KEY]: next },
          testStatus: 'NEVER_TESTED',
          priority: 0,
        },
      });
    } else {
      const settings = {
        ...((existing.settings || {}) as Record<string, unknown>),
        [COA_SETTINGS_KEY]: next,
      };
      await this.prisma.integrationConfig.update({
        where: { id: existing.id },
        data: { settings },
      });
    }

    return next;
  }

  /**
   * Seed CoA codes from Xero GET /Accounts (requires accounting.settings.read).
   * Stub: returns remote accounts + current mapping for admin to pick codes.
   */
  async fetchRemoteAccounts(): Promise<{ accounts: unknown; mapping: ChartOfAccountsMapping }> {
    this.assertEnabled();
    const { accessToken, tenantId } = await this.xeroAuth.getValidAccessToken();
    const accounts = await this.xeroApi.getAccounts(accessToken, tenantId);
    return { accounts, mapping: await this.getCoaMapping() };
  }

  /**
   * Enqueue a pre-built daily summary journal (callers supply aggregated totals).
   * Idempotency key convention: `${entryType}:${periodDate}`
   */
  async enqueueDailyJournal(entryType: LedgerEntryType, periodDate: string, payload: unknown) {
    this.assertEnabled();
    const key = `${entryType}:${periodDate}`;
    return this.outbox.enqueue(entryType, periodDate, key, payload);
  }

  /** Helpers used by jobs / future aggregators — build then enqueue. */
  async enqueueBuilt(
    entryType: LedgerEntryType,
    periodDate: string,
    build: () => ReturnType<JournalBuilderService['buildOnlineSales']>,
  ) {
    this.assertEnabled();
    const payload = build();
    return this.outbox.enqueue(entryType, periodDate, `${entryType}:${periodDate}`, payload);
  }

  getJournalBuilder(): JournalBuilderService {
    return this.journals;
  }

  getOutbox(): LedgerOutboxService {
    return this.outbox;
  }
}
