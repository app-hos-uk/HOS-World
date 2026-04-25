import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { InviteEventDto } from './dto/invite-event.dto';

@ApiTags('admin-events')
@ApiBearerAuth('JWT-auth')
@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EventsAdminController {
  constructor(private events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List events (all statuses)' })
  async list(
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.events.adminList({ status, storeId, page, limit });
    return { data, message: 'OK' };
  }

  @Post()
  @ApiOperation({ summary: 'Create draft event' })
  async create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateEventDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.events.create(dto, req.user.id);
    return { data, message: 'Created' };
  }

  @Get(':id/rsvps')
  @ApiOperation({ summary: 'List RSVPs' })
  async rsvps(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.events.getRsvpsForAdmin(id);
    return { data, message: 'OK' };
  }

  @Get(':id/attendances')
  @ApiOperation({ summary: 'List attendances' })
  async attendances(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.events.getAttendees(id);
    return { data, message: 'OK' };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Event statistics' })
  async stats(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.events.getEventStats(id);
    return { data, message: 'OK' };
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish event' })
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.events.publish(id);
    return { data, message: 'Published' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel event' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.events.cancel(id, body?.reason);
    return { data, message: 'Cancelled' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark event completed' })
  async complete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.events.complete(id);
    return { data, message: 'Completed' };
  }

  @Post(':id/check-in')
  @ApiOperation({ summary: 'Staff check-in by userId or ticketCode' })
  async checkIn(
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { userId?: string; ticketCode?: string },
  ): Promise<ApiResponse<unknown>> {
    if (body.ticketCode) {
      const data = await this.events.checkInByTicket(id, body.ticketCode, req.user.id);
      return { data, message: 'Checked in' };
    }
    if (body.userId) {
      const data = await this.events.checkIn(id, body.userId, { method: 'MANUAL' }, req.user.id);
      return { data, message: 'Checked in' };
    }
    throw new BadRequestException('Provide userId or ticketCode');
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Bulk invite members' })
  async invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InviteEventDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.events.inviteToEvent(id, body);
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Event detail + stats' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const event = await this.events.findById(id);
    const stats = await this.events.getEventStats(id);
    return { data: { event, stats }, message: 'OK' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update event' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.events.update(id, dto);
    return { data, message: 'Updated' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete draft event' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.events.remove(id);
    return { data: null, message: 'Deleted' };
  }
}
