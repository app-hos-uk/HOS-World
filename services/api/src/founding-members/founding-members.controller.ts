import { Controller, Post, Get, Body, Query, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FoundingMembersService } from './founding-members.service';
import { CreateFoundingMemberDto } from './dto/create-founding-member.dto';

@ApiTags('Founding Members')
@Controller('founding-members')
export class FoundingMembersController {
  constructor(private readonly foundingMembersService: FoundingMembersService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register as a founding member' })
  async register(
    @Body() dto: CreateFoundingMemberDto,
    @Request() req: any,
  ) {
    const ipAddress =
      req.headers?.['x-forwarded-for']?.split(',')[0] ||
      req.headers?.['x-real-ip'] ||
      req.ip;
    const userAgent = req.headers?.['user-agent'] || '';

    const member = await this.foundingMembersService.register(dto, {
      ipAddress,
      userAgent: userAgent.slice(0, 200),
      registeredFrom: 'landing_page',
    });

    return {
      data: { id: member.id, email: member.email, firstName: member.firstName },
      message: 'Welcome to the Founding Circle! You will be notified when the gates open.',
    };
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all founding members (Admin)' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      data: await this.foundingMembersService.findAll(
        parseInt(page || '1', 10),
        parseInt(limit || '50', 10),
      ),
    };
  }

  @Get('stats')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get founding member statistics (Admin)' })
  async stats() {
    return { data: await this.foundingMembersService.getStats() };
  }
}
