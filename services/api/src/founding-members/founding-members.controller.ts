import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FoundingMembersService } from './founding-members.service';
import { CreateFoundingMemberDto } from './dto/create-founding-member.dto';
import { ImportFoundingMembersDto } from './dto/import-founding-members.dto';
import { AdminCreateFoundingMemberDto } from './dto/admin-create-founding-member.dto';
import { FOUNDING_MEMBER_ADMIN_ROLES } from './founding-members.roles';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';

@ApiTags('Founding Members')
@Controller('founding-members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoundingMembersController {
  constructor(
    private readonly foundingMembersService: FoundingMembersService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register as a founding member' })
  async register(@Body() dto: CreateFoundingMemberDto, @Request() req: any) {
    if (!this.featureFlagsService.isEnabled(FeatureFlag.FOUNDING_MEMBERS)) {
      throw new ForbiddenException('Founding member registration is currently closed.');
    }

    const ipAddress =
      req.headers?.['x-forwarded-for']?.split(',')[0] ||
      req.headers?.['x-real-ip'] ||
      req.ip;
    const userAgent = req.headers?.['user-agent'] || '';

    const member = await this.foundingMembersService.register(
      dto,
      {
        ipAddress,
        userAgent: userAgent.slice(0, 200),
        registeredFrom: 'landing_page',
      },
      { sendConfirmationEmail: true },
    );

    return {
      data: { id: member.id, email: member.email, firstName: member.firstName },
      message: 'Welcome to the Founding Circle! You will be notified when the gates open.',
    };
  }

  @Get('stats')
  @Roles(...FOUNDING_MEMBER_ADMIN_ROLES)
  @ApiOperation({ summary: 'Get founding member statistics (Admin / Marketing)' })
  async stats() {
    return { data: await this.foundingMembersService.getStats() };
  }

  @Post('import/preview')
  @Roles(...FOUNDING_MEMBER_ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Dry-run preview of a founding member import (Admin / Marketing)' })
  async previewImport(@Body() dto: ImportFoundingMembersDto) {
    const preview = await this.foundingMembersService.previewImport(dto.members, {
      defaultSource: dto.defaultSource || 'external_import',
    });

    return {
      data: preview,
      message: `Preview: ${preview.ready} ready, ${preview.duplicate} duplicates, ${preview.duplicateInFile} in-file duplicates, ${preview.invalid} invalid`,
    };
  }

  @Post('import')
  @Roles(...FOUNDING_MEMBER_ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Bulk import founding members from external data (Admin / Marketing)' })
  async importMembers(@Body() dto: ImportFoundingMembersDto, @Request() req: any) {
    const result = await this.foundingMembersService.bulkImport(dto.members, {
      skipDuplicates: dto.skipDuplicates ?? true,
      sendConfirmationEmail: dto.sendConfirmationEmail ?? false,
      defaultSource: dto.defaultSource || 'external_import',
      importedBy: req.user?.id,
    });

    return {
      data: result,
      message: `Import complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
    };
  }

  @Post('admin')
  @Roles(...FOUNDING_MEMBER_ADMIN_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Manually add a single founding member (Admin / Marketing)' })
  async adminCreate(@Body() dto: AdminCreateFoundingMemberDto, @Request() req: any) {
    const { sendConfirmationEmail, ...memberDto } = dto;
    const member = await this.foundingMembersService.adminCreate(memberDto, {
      sendConfirmationEmail: sendConfirmationEmail ?? false,
      metadata: { importedBy: req.user?.id },
    });

    return {
      data: member,
      message: 'Founding member added successfully',
    };
  }

  @Post('send-confirmations')
  @Roles(...FOUNDING_MEMBER_ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send confirmation emails to all founding members who haven\'t received one',
  })
  async sendConfirmations(@Body() body?: { batchSize?: number }) {
    const result = await this.foundingMembersService.sendConfirmationToAll({
      onlyUnsent: true,
      batchSize: body?.batchSize ?? 50,
    });
    return {
      data: result,
      message: `Sent ${result.sent} emails, ${result.failed} failed, ${result.skipped} skipped`,
    };
  }

  @Get()
  @Roles(...FOUNDING_MEMBER_ADMIN_ROLES)
  @ApiOperation({ summary: 'List all founding members (Admin / Marketing)' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return {
      data: await this.foundingMembersService.findAll(
        parseInt(page || '1', 10),
        parseInt(limit || '50', 10),
        search?.trim() || undefined,
      ),
    };
  }
}
