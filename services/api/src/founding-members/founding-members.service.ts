import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFoundingMemberDto } from './dto/create-founding-member.dto';
import { ImportFoundingMemberRowDto } from './dto/import-founding-members.dto';

export interface FoundingMemberImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; email: string; message: string }>;
  createdEmails: string[];
}

export type FoundingMemberPreviewStatus =
  | 'ready'
  | 'duplicate'
  | 'duplicate_in_file'
  | 'invalid';

export interface FoundingMemberPreviewRow {
  row: number;
  email: string;
  firstName: string;
  lastName?: string;
  status: FoundingMemberPreviewStatus;
  message?: string;
}

export interface FoundingMemberPreviewResult {
  total: number;
  ready: number;
  duplicate: number;
  duplicateInFile: number;
  invalid: number;
  rows: FoundingMemberPreviewRow[];
}

@Injectable()
export class FoundingMembersService {
  private readonly logger = new Logger(FoundingMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: CreateFoundingMemberDto,
    metadata?: Record<string, unknown>,
    options?: { sendConfirmationEmail?: boolean },
  ) {
    const existing = await this.prisma.foundingMember.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('This email is already registered as a founding member.');
    }

    return this.createMember(dto, metadata, options);
  }

  async adminCreate(
    dto: CreateFoundingMemberDto,
    options?: { sendConfirmationEmail?: boolean; metadata?: Record<string, unknown> },
  ) {
    const existing = await this.prisma.foundingMember.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('This email is already registered as a founding member.');
    }

    return this.createMember(
      dto,
      {
        registeredFrom: 'admin_manual',
        ...(options?.metadata || {}),
      },
      { sendConfirmationEmail: options?.sendConfirmationEmail ?? false },
    );
  }

  async bulkImport(
    rows: ImportFoundingMemberRowDto[],
    options?: {
      skipDuplicates?: boolean;
      sendConfirmationEmail?: boolean;
      defaultSource?: string;
      importedBy?: string;
    },
  ): Promise<FoundingMemberImportResult> {
    const result: FoundingMemberImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      createdEmails: [],
    };

    const BATCH_SIZE = 50;

    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (row, batchIndex) => {
          const i = batchStart + batchIndex;
          const rowNum = i + 1;
          const email = row.email?.toLowerCase().trim();

          if (!email || !row.firstName?.trim()) {
            return {
              status: 'failed' as const,
              row: rowNum,
              email: email || '(missing)',
              message: 'Email and first name are required',
            };
          }

          const existing = await this.prisma.foundingMember.findUnique({ where: { email } });
          if (existing) {
            if (options?.skipDuplicates !== false) {
              return { status: 'skipped' as const };
            }
            return {
              status: 'failed' as const,
              row: rowNum,
              email,
              message: 'Email already registered',
            };
          }

          try {
            const member = await this.createMember(
              {
                email: row.email,
                firstName: row.firstName,
                lastName: row.lastName,
                phone: row.phone,
                country: row.country,
                fandoms: row.fandoms?.length ? row.fandoms : [],
                otherFranchises: row.otherFranchises,
                source: row.source || options?.defaultSource || 'external_import',
                spendBracket: row.spendBracket,
              },
              {
                registeredFrom: 'admin_import',
                importedBy: options?.importedBy,
                originalRegisteredAt: row.registeredAt || null,
              },
              {
                sendConfirmationEmail: options?.sendConfirmationEmail ?? false,
                registeredAt: row.registeredAt ? new Date(row.registeredAt) : undefined,
              },
            );
            return { status: 'created' as const, email: member.email };
          } catch (err: unknown) {
            return {
              status: 'failed' as const,
              row: rowNum,
              email,
              message: err instanceof Error ? err.message : 'Import failed',
            };
          }
        }),
      );

      for (const settled of batchResults) {
        if (settled.status === 'rejected') {
          result.failed++;
          result.errors.push({
            row: batchStart + 1,
            email: '(unknown)',
            message: settled.reason instanceof Error ? settled.reason.message : 'Import failed',
          });
          continue;
        }

        const rowResult = settled.value;
        switch (rowResult.status) {
          case 'created':
            result.created++;
            result.createdEmails.push(rowResult.email);
            break;
          case 'skipped':
            result.skipped++;
            break;
          case 'failed':
            result.failed++;
            result.errors.push({
              row: rowResult.row,
              email: rowResult.email,
              message: rowResult.message,
            });
            break;
        }
      }

      const processed = Math.min(batchStart + BATCH_SIZE, rows.length);
      if (processed % 100 === 0 || processed === rows.length) {
        this.logger.log(
          `Import progress: ${processed}/${rows.length} (${result.created} created, ${result.skipped} skipped, ${result.failed} failed)`,
        );
      }
    }

    this.logger.log(
      `Founding member import: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
    );

    return result;
  }

  async sendConfirmationToAll(options?: {
    onlyUnsent?: boolean;
    batchSize?: number;
  }): Promise<{ sent: number; failed: number; skipped: number }> {
    const batchSize = options?.batchSize ?? 50;
    const onlyUnsent = options?.onlyUnsent ?? true;
    const result = { sent: 0, failed: 0, skipped: 0 };

    const members = await this.prisma.foundingMember.findMany({
      orderBy: { registeredAt: 'asc' },
      select: { id: true, email: true, firstName: true, metadata: true },
    });

    const toSend = onlyUnsent
      ? members.filter((member) => !this.hasConfirmationEmailSent(member.metadata))
      : members;

    result.skipped = members.length - toSend.length;

    for (let batchStart = 0; batchStart < toSend.length; batchStart += batchSize) {
      const batch = toSend.slice(batchStart, batchStart + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (member) => {
          const sentAt = new Date().toISOString();
          await this.prisma.foundingMember.update({
            where: { id: member.id },
            data: {
              metadata: this.mergeMetadata(member.metadata, {
                confirmationEmailSentAt: sentAt,
              }),
            },
          });
          try {
            await this.notificationsService.sendFoundingMemberConfirmation(member.email, {
              firstName: member.firstName,
            });
          } catch (emailErr) {
            try {
              await this.prisma.foundingMember.update({
                where: { id: member.id },
                data: {
                  metadata: this.mergeMetadata(member.metadata, {
                    confirmationEmailSentAt: null,
                    confirmationEmailError: emailErr instanceof Error ? emailErr.message : 'unknown',
                  }),
                },
              });
            } catch (rollbackErr) {
              this.logger.error(
                `Failed to rollback confirmationEmailSentAt for member ${member.id}: ${rollbackErr instanceof Error ? rollbackErr.message : 'unknown'}`,
              );
            }
            throw emailErr;
          }
        }),
      );

      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          result.sent++;
        } else {
          result.failed++;
          this.logger.warn(
            `Founding member confirmation batch send failed: ${settled.reason instanceof Error ? settled.reason.message : 'unknown'}`,
          );
        }
      }

      const processed = Math.min(batchStart + batchSize, toSend.length);
      if (processed % 100 === 0 || processed === toSend.length) {
        this.logger.log(
          `Confirmation email progress: ${processed}/${toSend.length} (${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped)`,
        );
      }
    }

    this.logger.log(
      `Founding member confirmations: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`,
    );

    return result;
  }

  async previewImport(
    rows: ImportFoundingMemberRowDto[],
    options?: { defaultSource?: string },
  ): Promise<FoundingMemberPreviewResult> {
    const result: FoundingMemberPreviewResult = {
      total: rows.length,
      ready: 0,
      duplicate: 0,
      duplicateInFile: 0,
      invalid: 0,
      rows: [],
    };

    const emailsInFile = new Map<string, number>();
    const normalizedRows = rows.map((row, index) => {
      const email = row.email?.toLowerCase().trim() || '';
      if (email) {
        emailsInFile.set(email, (emailsInFile.get(email) || 0) + 1);
      }
      return { row, index, email };
    });

    const candidateEmails = normalizedRows
      .map((r) => r.email)
      .filter((email) => email && this.isValidEmail(email));

    const existingMembers = candidateEmails.length
      ? await this.prisma.foundingMember.findMany({
          where: { email: { in: candidateEmails } },
          select: { email: true },
        })
      : [];
    const existingSet = new Set(existingMembers.map((m) => m.email));

    for (const { row, index, email } of normalizedRows) {
      const rowNum = index + 1;
      const firstName = row.firstName?.trim() || '';

      if (!email || !firstName) {
        result.invalid++;
        result.rows.push({
          row: rowNum,
          email: email || '(missing)',
          firstName,
          lastName: row.lastName,
          status: 'invalid',
          message: 'Email and first name are required',
        });
        continue;
      }

      if (!this.isValidEmail(email)) {
        result.invalid++;
        result.rows.push({
          row: rowNum,
          email,
          firstName,
          lastName: row.lastName,
          status: 'invalid',
          message: 'Invalid email format',
        });
        continue;
      }

      if ((emailsInFile.get(email) || 0) > 1) {
        result.duplicateInFile++;
        result.rows.push({
          row: rowNum,
          email,
          firstName,
          lastName: row.lastName,
          status: 'duplicate_in_file',
          message: 'Duplicate email within this file',
        });
        continue;
      }

      if (existingSet.has(email)) {
        result.duplicate++;
        result.rows.push({
          row: rowNum,
          email,
          firstName,
          lastName: row.lastName,
          status: 'duplicate',
          message: 'Already registered in founding members list',
        });
        continue;
      }

      if (row.registeredAt && Number.isNaN(Date.parse(row.registeredAt))) {
        result.invalid++;
        result.rows.push({
          row: rowNum,
          email,
          firstName,
          lastName: row.lastName,
          status: 'invalid',
          message: 'registeredAt must be a valid ISO date',
        });
        continue;
      }

      result.ready++;
      result.rows.push({
        row: rowNum,
        email,
        firstName,
        lastName: row.lastName,
        status: 'ready',
        message: row.source || options?.defaultSource || 'external_import',
      });
    }

    return result;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private async createMember(
    dto: CreateFoundingMemberDto,
    metadata?: Record<string, unknown>,
    options?: { sendConfirmationEmail?: boolean; registeredAt?: Date },
  ) {
    const member = await this.prisma.foundingMember.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName?.trim() || null,
        phone: dto.phone?.trim() || null,
        country: dto.country?.trim() || null,
        fandoms: dto.fandoms ?? [],
        otherFranchises: dto.otherFranchises?.trim() || null,
        source: dto.source?.trim() || null,
        spendBracket: dto.spendBracket?.trim() || null,
        registeredAt: options?.registeredAt ?? new Date(),
        metadata: (metadata || Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    if (options?.sendConfirmationEmail) {
      try {
        await this.notificationsService.sendFoundingMemberConfirmation(member.email, {
          firstName: member.firstName,
        });
        await this.prisma.foundingMember.update({
          where: { id: member.id },
          data: {
            metadata: this.mergeMetadata(metadata, {
              confirmationEmailSentAt: new Date().toISOString(),
            }),
          },
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Founding member confirmation email failed for ${member.email}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    return member;
  }

  private hasConfirmationEmailSent(metadata: Prisma.JsonValue | null): boolean {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }
    const sentAt = (metadata as Record<string, unknown>).confirmationEmailSentAt;
    return typeof sentAt === 'string' && sentAt.length > 0;
  }

  private mergeMetadata(
    existing: Prisma.JsonValue | Record<string, unknown> | null | undefined,
    updates: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    return { ...base, ...updates } as Prisma.InputJsonValue;
  }

  async sendAccountInvitations(options?: {
    onlyUnsent?: boolean;
    batchSize?: number;
    memberIds?: string[];
  }): Promise<{ sent: number; failed: number; skipped: number }> {
    const batchSize = options?.batchSize ?? 50;
    const onlyUnsent = options?.onlyUnsent ?? true;
    const result = { sent: 0, failed: 0, skipped: 0 };

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const registerLink = `${frontendUrl}/register?ref=founding`;

    const where: any = { userId: null };
    if (options?.memberIds?.length) {
      where.id = { in: options.memberIds };
    }
    if (onlyUnsent) {
      where.status = { not: 'INVITED' };
    }

    const members = await this.prisma.foundingMember.findMany({
      where,
      orderBy: { registeredAt: 'asc' },
      select: { id: true, email: true, firstName: true, metadata: true, status: true },
    });

    if (onlyUnsent) {
      result.skipped = await this.prisma.foundingMember.count({
        where: {
          userId: null,
          status: 'INVITED',
          ...(options?.memberIds?.length ? { id: { in: options.memberIds } } : {}),
        },
      });
    }

    for (let batchStart = 0; batchStart < members.length; batchStart += batchSize) {
      const batch = members.slice(batchStart, batchStart + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (member) => {
          try {
            await this.notificationsService.sendFoundingMemberAccountInvitation(
              member.email,
              { firstName: member.firstName, registerLink },
            );
            const sentAt = new Date().toISOString();
            await this.prisma.foundingMember.update({
              where: { id: member.id },
              data: {
                status: 'INVITED',
                metadata: this.mergeMetadata(member.metadata, {
                  accountInvitationSentAt: sentAt,
                }),
              },
            });
          } catch (emailErr) {
            await this.prisma.foundingMember.update({
              where: { id: member.id },
              data: {
                metadata: this.mergeMetadata(member.metadata, {
                  accountInvitationError:
                    emailErr instanceof Error ? emailErr.message : 'unknown',
                }),
              },
            }).catch((rollbackErr) => {
              this.logger.error(
                `Failed to save invitation error for member ${member.id}: ${rollbackErr instanceof Error ? rollbackErr.message : 'unknown'}`,
              );
            });
            throw emailErr;
          }
        }),
      );

      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          result.sent++;
        } else {
          result.failed++;
          this.logger.warn(
            `Founding member account invitation send failed: ${settled.reason instanceof Error ? settled.reason.message : 'unknown'}`,
          );
        }
      }

      const processed = Math.min(batchStart + batchSize, members.length);
      if (processed % 100 === 0 || processed === members.length) {
        this.logger.log(
          `Account invitation progress: ${processed}/${members.length} (${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped)`,
        );
      }
    }

    this.logger.log(
      `Account invitations: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`,
    );

    return result;
  }

  private hasAccountInvitationSent(metadata: Prisma.JsonValue | null): boolean {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }
    const sentAt = (metadata as Record<string, unknown>).accountInvitationSentAt;
    return typeof sentAt === 'string' && sentAt.length > 0;
  }

  async findByEmail(email: string) {
    return this.prisma.foundingMember.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async linkToUser(email: string, userId: string) {
    const member = await this.findByEmail(email);
    if (!member) return null;
    return this.prisma.foundingMember.update({
      where: { id: member.id },
      data: { userId, status: 'LINKED' },
    });
  }

  async getStats() {
    const [total, byStatus, topFandoms] = await Promise.all([
      this.prisma.foundingMember.count(),
      this.prisma.foundingMember.groupBy({ by: ['status'], _count: true }),
      this.prisma.$queryRaw`
        SELECT unnest(fandoms) as fandom, COUNT(*) as count
        FROM founding_members
        GROUP BY fandom ORDER BY count DESC LIMIT 20
      ` as Promise<Array<{ fandom: string; count: bigint }>>,
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      topFandoms: topFandoms.map((f) => ({ fandom: f.fandom, count: Number(f.count) })),
    };
  }

  async findAll(page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.foundingMember.findMany({
        where,
        skip,
        take: limit,
        orderBy: { registeredAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.foundingMember.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
