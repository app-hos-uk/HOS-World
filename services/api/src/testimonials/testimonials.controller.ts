import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TestimonialsService } from './testimonials.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';

@ApiTags('testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly service: TestimonialsService) {}

  @RequireAccess({ permission: 'cms.edit', scope: 'MARKET' })
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get active testimonials (public)' })
  async getActive() {
    const data = await this.service.findActive();
    return { data, message: 'OK' };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Get all testimonials (admin)' })
  async getAll() {
    const data = await this.service.findAll();
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'cms.edit', scope: 'MARKET' })
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Get single testimonial' })
  async getOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'cms.edit', scope: 'MARKET' })
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'marketing.create', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Create testimonial' })
  async create(@Body() body: any) {
    const data = await this.service.create(body);
    return { data, message: 'Testimonial created' };
  }

  @RequireAccess({ permission: 'cms.edit', scope: 'MARKET' })
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update testimonial' })
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.service.update(id, body);
    return { data, message: 'Testimonial updated' };
  }

  @RequireAccess({ permission: 'cms.edit', scope: 'MARKET' })
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Delete testimonial' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { data: null, message: 'Testimonial deleted' };
  }
}
