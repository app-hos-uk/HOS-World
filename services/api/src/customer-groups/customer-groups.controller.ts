import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomerGroupsService } from './customer-groups.service';
import { CreateCustomerGroupDto } from './dto/create-customer-group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('customer-groups')
@Controller('customer-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MARKETING')
@ApiBearerAuth('JWT-auth')
export class CustomerGroupsController {
  constructor(
    private readonly customerGroupsService: CustomerGroupsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create customer group',
    description: 'Creates a new customer group. Requires ADMIN or MARKETING role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Customer group created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid customer group data' })
  async create(
    @Body() createDto: CreateCustomerGroupDto,
  ): Promise<ApiResponse<any>> {
    const group = await this.customerGroupsService.create(createDto);
    return {
      data: group,
      message: 'Customer group created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all customer groups',
    description: 'Retrieves all customer groups.',
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @SwaggerApiResponse({ status: 200, description: 'Customer groups retrieved successfully' })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ApiResponse<any[]>> {
    const groups = await this.customerGroupsService.findAll(
      includeInactive === 'true',
    );
    return {
      data: groups,
      message: 'Customer groups retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get customer group by ID',
    description: 'Retrieves a specific customer group by ID.',
  })
  @ApiParam({ name: 'id', description: 'Customer group UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Customer group retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Customer group not found' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    const group = await this.customerGroupsService.findOne(id);
    return {
      data: group,
      message: 'Customer group retrieved successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update customer group',
    description: 'Updates an existing customer group.',
  })
  @ApiParam({ name: 'id', description: 'Customer group UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Customer group updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateCustomerGroupDto>,
  ): Promise<ApiResponse<any>> {
    const group = await this.customerGroupsService.update(id, updateDto);
    return {
      data: group,
      message: 'Customer group updated successfully',
    };
  }

  @Post(':id/customers/:userId')
  @ApiOperation({
    summary: 'Add customer to group',
    description: 'Adds a customer to a customer group.',
  })
  @ApiParam({ name: 'id', description: 'Customer group UUID', type: String })
  @ApiParam({ name: 'userId', description: 'User UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Customer added to group successfully' })
  async addCustomer(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<ApiResponse<any>> {
    const user = await this.customerGroupsService.addCustomerToGroup(id, userId);
    return {
      data: user,
      message: 'Customer added to group successfully',
    };
  }

  @Delete('customers/:userId')
  @ApiOperation({
    summary: 'Remove customer from group',
    description: 'Removes a customer from their current group.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Customer removed from group successfully' })
  async removeCustomer(
    @Param('userId') userId: string,
  ): Promise<ApiResponse<any>> {
    const user = await this.customerGroupsService.removeCustomerFromGroup(userId);
    return {
      data: user,
      message: 'Customer removed from group successfully',
    };
  }

  @Get('my/group')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get my customer group',
    description: 'Retrieves the customer group for the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Customer group retrieved successfully' })
  async getMyGroup(@Request() req: any): Promise<ApiResponse<any>> {
    const group = await this.customerGroupsService.getCustomerGroup(req.user.id);
    return {
      data: group,
      message: 'Customer group retrieved successfully',
    };
  }
}
