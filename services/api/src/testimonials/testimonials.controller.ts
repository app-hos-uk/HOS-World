import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TestimonialsService } from './testimonials.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly service: TestimonialsService) {}

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
  @ApiOperation({ summary: 'Get all testimonials (admin)' })
  async getAll() {
    const data = await this.service.findAll();
    return { data, message: 'OK' };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get single testimonial' })
  async getOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data, message: 'OK' };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create testimonial' })
  async create(@Body() body: any) {
    const data = await this.service.create(body);
    return { data, message: 'Testimonial created' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update testimonial' })
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.service.update(id, body);
    return { data, message: 'Testimonial updated' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete testimonial' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { data: null, message: 'Testimonial deleted' };
  }
}
