import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NavigationService } from './navigation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('navigation')
@Controller('navigation')
export class NavigationController {
  constructor(private readonly service: NavigationService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get active navigation items for a group' })
  async getByGroup(@Query('group') group: string) {
    const data = group
      ? await this.service.findByGroup(group)
      : await this.service.findByGroup('header_primary');
    return { data, message: 'OK' };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all navigation items (admin)' })
  async getAll() {
    const data = await this.service.findAll();
    return { data, message: 'OK' };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create navigation item' })
  async create(@Body() body: any) {
    const data = await this.service.create(body);
    return { data, message: 'Navigation item created' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update navigation item' })
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.service.update(id, body);
    return { data, message: 'Navigation item updated' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete navigation item' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { data: null, message: 'Navigation item deleted' };
  }
}
