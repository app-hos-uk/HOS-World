import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepartmentsService, CreateDepartmentDto, UpdateDepartmentDto } from './departments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get active departments for storefront display' })
  @SwaggerApiResponse({ status: 200, description: 'Active departments retrieved' })
  async findActive(): Promise<ApiResponse<any[]>> {
    const departments = await this.departmentsService.findActive();
    return { data: departments, message: 'Departments retrieved successfully' };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all departments including inactive (admin)' })
  @SwaggerApiResponse({ status: 200, description: 'All departments retrieved' })
  async findAll(): Promise<ApiResponse<any[]>> {
    const departments = await this.departmentsService.findAll();
    return { data: departments, message: 'All departments retrieved successfully' };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get department by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const department = await this.departmentsService.findOne(id);
    return { data: department, message: 'Department retrieved successfully' };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new department' })
  @SwaggerApiResponse({ status: 201, description: 'Department created' })
  async create(@Body() dto: CreateDepartmentDto): Promise<ApiResponse<any>> {
    const department = await this.departmentsService.create(dto);
    return { data: department, message: 'Department created successfully' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a department' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<ApiResponse<any>> {
    const department = await this.departmentsService.update(id, dto);
    return { data: department, message: 'Department updated successfully' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a department' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.departmentsService.remove(id);
    return { data: null, message: 'Department deleted successfully' };
  }

  @Put('reorder/batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder departments' })
  async reorder(@Body() body: { orderedIds: string[] }): Promise<ApiResponse<any[]>> {
    const departments = await this.departmentsService.reorder(body.orderedIds);
    return { data: departments, message: 'Departments reordered successfully' };
  }
}
