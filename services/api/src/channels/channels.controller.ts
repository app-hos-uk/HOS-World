import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { ChannelsService } from './channels.service';
import { AssignChannelDto } from './dto/assign-channel.dto';
import { UpdateChannelPriceDto } from './dto/update-channel-price.dto';

@ApiTags('admin-channels')
@ApiBearerAuth('JWT-auth')
@Controller('admin/channels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ChannelsController {
  constructor(private channels: ChannelsService) {}

  @Post('assign')
  @ApiOperation({ summary: 'Assign product to sales channel' })
  async assign(@Body() dto: AssignChannelDto): Promise<ApiResponse<unknown>> {
    const data = await this.channels.assignProductToChannel(dto);
    return { data, message: 'Assigned' };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.channels.removeProductFromChannel(id);
    return { data: null, message: 'Removed' };
  }

  @Put(':id/price')
  async updatePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelPriceDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.channels.updateChannelPrice(id, dto);
    return { data, message: 'Updated' };
  }

  @Get('product/:productId')
  async byProduct(@Param('productId', ParseUUIDPipe) productId: string): Promise<ApiResponse<unknown>> {
    const data = await this.channels.getProductChannels(productId);
    return { data, message: 'OK' };
  }

  @Get('store/:storeId')
  async byStore(@Param('storeId', ParseUUIDPipe) storeId: string): Promise<ApiResponse<unknown>> {
    const data = await this.channels.getStoreProducts(storeId);
    return { data, message: 'OK' };
  }
}
