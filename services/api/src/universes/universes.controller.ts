import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UniversesService } from './universes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';
import { ReorderUniversesDto } from './dto/reorder-universes.dto';

@ApiTags('universes')
@Controller('universes')
export class UniversesController {
  constructor(private readonly service: UniversesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get active universes (public)' })
  async getActive() {
    const data = await this.service.findActive();
    return { data, message: 'OK' };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all universes (admin)' })
  async getAll() {
    const data = await this.service.findAll();
    return { data, message: 'OK' };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create universe' })
  async create(@Body() body: CreateUniverseDto) {
    const data = await this.service.create(body);
    return { data, message: 'Universe created' };
  }

  @Put('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reorder universes' })
  async reorder(@Body() body: ReorderUniversesDto) {
    const data = await this.service.reorder(body.orderedIds);
    return { data, message: 'Universes reordered' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update universe' })
  async update(@Param('id') id: string, @Body() body: UpdateUniverseDto) {
    const data = await this.service.update(id, body);
    return { data, message: 'Universe updated' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete universe' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { data: null, message: 'Universe deleted' };
  }
}
