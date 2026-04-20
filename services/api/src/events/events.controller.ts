import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Body,
  Query,
  Request,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { EventsService } from './events.service';
import { RsvpEventDto } from './dto/rsvp-event.dto';
import { CheckInDto } from './dto/check-in.dto';

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(
    private events: EventsService,
    private jwt: JwtService,
  ) {}

  private optionalUserId(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
    const raw = req.headers['authorization'];
    const auth = typeof raw === 'string' ? raw : raw?.[0];
    if (!auth?.startsWith('Bearer ')) return undefined;
    try {
      const p = this.jwt.verify<{ sub: string }>(auth.slice(7));
      return p.sub;
    } catch {
      return undefined;
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List upcoming public events' })
  async list(
    @Request() req: { headers: Record<string, string | string[] | undefined> },
    @Query('storeId') storeId?: string,
    @Query('fandomId') fandomId?: string,
    @Query('type') type?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<ApiResponse<unknown>> {
    const userId = this.optionalUserId(req);
    const data = await this.events.findUpcoming({
      storeId,
      fandomId,
      type,
      userId,
      page,
      limit,
    });
    return { data, message: 'OK' };
  }

  @Get('my/rsvps')
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'My event RSVPs' })
  async myRsvps(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.events.getMyRsvps(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('my/attendances')
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Events I attended' })
  async myAttendances(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.events.getMyAttendances(req.user.id);
    return { data, message: 'OK' };
  }

  @Post(':id/rsvp')
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'RSVP to an event' })
  async rsvp(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: RsvpEventDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.events.rsvp(id, req.user.id, dto);
    return { data, message: 'RSVP recorded' };
  }

  @Delete(':id/rsvp')
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Cancel RSVP' })
  async cancelRsvp(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    await this.events.cancelRsvp(id, req.user.id);
    return { data: null, message: 'Cancelled' };
  }

  @Post(':id/check-in')
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Self check-in' })
  async checkIn(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: CheckInDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.events.checkIn(id, req.user.id, dto);
    return { data, message: 'Checked in' };
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Event detail by slug' })
  async detail(
    @Request() req: { headers: Record<string, string | string[] | undefined> },
    @Param('slug') slug: string,
  ): Promise<ApiResponse<unknown>> {
    const userId = this.optionalUserId(req);
    const data = await this.events.getDetailForUser(slug, userId);
    return { data, message: 'OK' };
  }
}
