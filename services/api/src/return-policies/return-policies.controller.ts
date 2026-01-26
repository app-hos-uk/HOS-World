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
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReturnPoliciesService } from './return-policies.service';
import { CreateReturnPolicyDto } from './dto/create-return-policy.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('return-policies')
@Version('1')
@Controller('return-policies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SELLER', 'B2C_SELLER')
@ApiBearerAuth('JWT-auth')
export class ReturnPoliciesController {
  constructor(
    private readonly returnPoliciesService: ReturnPoliciesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create return policy',
    description: 'Creates a new return policy. Requires ADMIN, SELLER, or B2C_SELLER role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Return policy created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid return policy data' })
  async create(
    @Body() createDto: CreateReturnPolicyDto,
  ): Promise<ApiResponse<any>> {
    const policy = await this.returnPoliciesService.create(createDto);
    return {
      data: policy,
      message: 'Return policy created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all return policies',
    description: 'Retrieves all active return policies.',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Return policies retrieved successfully' })
  async findAll(
    @Query('sellerId') sellerId?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
  ): Promise<ApiResponse<any[]>> {
    const policies = await this.returnPoliciesService.findAll(
      sellerId,
      productId,
      categoryId,
    );
    return {
      data: policies,
      message: 'Return policies retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get return policy by ID',
    description: 'Retrieves a specific return policy by ID.',
  })
  @ApiParam({ name: 'id', description: 'Return policy UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Return policy retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Return policy not found' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    const policy = await this.returnPoliciesService.findOne(id);
    return {
      data: policy,
      message: 'Return policy retrieved successfully',
    };
  }

  @Get('applicable/:productId')
  @ApiOperation({
    summary: 'Get applicable return policy',
    description: 'Retrieves the applicable return policy for a product.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @ApiQuery({ name: 'sellerId', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Applicable return policy retrieved successfully' })
  async getApplicablePolicy(
    @Param('productId') productId: string,
    @Query('sellerId') sellerId?: string,
    @Query('categoryId') categoryId?: string,
  ): Promise<ApiResponse<any>> {
    const policy = await this.returnPoliciesService.getApplicablePolicy(
      productId,
      sellerId,
      categoryId,
    );
    return {
      data: policy,
      message: 'Applicable return policy retrieved successfully',
    };
  }

  @Get('eligibility/:orderId')
  @ApiOperation({
    summary: 'Check return eligibility',
    description: 'Checks if a return is allowed for an order.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', type: String })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Return eligibility checked successfully' })
  async checkReturnEligibility(
    @Param('orderId') orderId: string,
    @Query('productId') productId?: string,
  ): Promise<ApiResponse<any>> {
    const eligibility = await this.returnPoliciesService.checkReturnEligibility(
      orderId,
      productId,
    );
    return {
      data: eligibility,
      message: 'Return eligibility checked successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update return policy',
    description: 'Updates an existing return policy.',
  })
  @ApiParam({ name: 'id', description: 'Return policy UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Return policy updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateReturnPolicyDto>,
  ): Promise<ApiResponse<any>> {
    const policy = await this.returnPoliciesService.update(id, updateDto);
    return {
      data: policy,
      message: 'Return policy updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete return policy',
    description: 'Deletes a return policy.',
  })
  @ApiParam({ name: 'id', description: 'Return policy UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Return policy deleted successfully' })
  async delete(@Param('id') id: string): Promise<ApiResponse<any>> {
    await this.returnPoliciesService.delete(id);
    return {
      data: null,
      message: 'Return policy deleted successfully',
    };
  }
}
