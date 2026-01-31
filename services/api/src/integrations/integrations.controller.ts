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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  TestIntegrationDto,
  IntegrationResponseDto,
  TestConnectionResultDto,
  IntegrationCategory,
} from './dto/create-integration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('integrations')
@ApiBearerAuth('JWT-auth')
@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create integration configuration',
    description: 'Creates a new third-party integration configuration. Admin access required.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Integration created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 409, description: 'Integration already exists' })
  async create(
    @Body() createDto: CreateIntegrationDto,
  ): Promise<ApiResponse<IntegrationResponseDto>> {
    const integration = await this.integrationsService.create(createDto);
    return {
      data: integration,
      message: 'Integration created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all integrations',
    description: 'Retrieves all configured integrations. Credentials are masked.',
  })
  @ApiQuery({ name: 'category', required: false, enum: IntegrationCategory })
  @SwaggerApiResponse({ status: 200, description: 'Integrations retrieved successfully' })
  async findAll(
    @Query('category') category?: IntegrationCategory,
  ): Promise<ApiResponse<IntegrationResponseDto[]>> {
    const integrations = await this.integrationsService.findAll(category);
    return {
      data: integrations,
      message: 'Integrations retrieved successfully',
    };
  }

  @Get('providers')
  @ApiOperation({
    summary: 'Get available providers',
    description: 'Get all available providers and their metadata for each category.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Providers retrieved successfully' })
  async getProviders(): Promise<ApiResponse<any>> {
    const categories = Object.values(IntegrationCategory);
    const result: Record<string, any[]> = {};

    for (const category of categories) {
      result[category] = this.integrationsService.getAvailableProviders(category);
    }

    return {
      data: result,
      message: 'Available providers retrieved successfully',
    };
  }

  @Get('providers/:provider')
  @ApiOperation({
    summary: 'Get provider metadata',
    description: 'Get metadata for a specific provider including required credentials.',
  })
  @ApiParam({ name: 'provider', description: 'Provider identifier', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Provider metadata retrieved' })
  @SwaggerApiResponse({ status: 404, description: 'Provider not found' })
  async getProviderMetadata(@Param('provider') provider: string): Promise<ApiResponse<any>> {
    const metadata = this.integrationsService.getProviderMetadata(provider);
    if (!metadata) {
      return {
        data: null,
        message: 'Provider not found',
      };
    }
    return {
      data: { provider, ...metadata },
      message: 'Provider metadata retrieved successfully',
    };
  }

  @Get('category/:category')
  @ApiOperation({
    summary: 'Get integrations by category',
    description: 'Retrieves all integrations for a specific category.',
  })
  @ApiParam({ name: 'category', enum: IntegrationCategory })
  @SwaggerApiResponse({ status: 200, description: 'Integrations retrieved successfully' })
  async findByCategory(
    @Param('category') category: IntegrationCategory,
  ): Promise<ApiResponse<IntegrationResponseDto[]>> {
    const integrations = await this.integrationsService.findAll(category);
    return {
      data: integrations,
      message: 'Integrations retrieved successfully',
    };
  }

  @Get('category/:category/active')
  @ApiOperation({
    summary: 'Get active integration for category',
    description: 'Returns the currently active integration for a category (highest priority).',
  })
  @ApiParam({ name: 'category', enum: IntegrationCategory })
  @SwaggerApiResponse({ status: 200, description: 'Active integration retrieved' })
  async getActive(
    @Param('category') category: IntegrationCategory,
  ): Promise<ApiResponse<IntegrationResponseDto | null>> {
    const integration = await this.integrationsService.getActiveIntegration(category);
    return {
      data: integration,
      message: integration
        ? 'Active integration retrieved successfully'
        : 'No active integration found for this category',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get integration by ID',
    description: 'Retrieves a specific integration configuration. Credentials are masked.',
  })
  @ApiParam({ name: 'id', description: 'Integration UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Integration retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Integration not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<IntegrationResponseDto>> {
    const integration = await this.integrationsService.findById(id);
    return {
      data: integration,
      message: 'Integration retrieved successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update integration',
    description: 'Updates an existing integration configuration.',
  })
  @ApiParam({ name: 'id', description: 'Integration UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Integration updated successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Integration not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateIntegrationDto,
  ): Promise<ApiResponse<IntegrationResponseDto>> {
    const integration = await this.integrationsService.update(id, updateDto);
    return {
      data: integration,
      message: 'Integration updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete integration',
    description: 'Removes an integration configuration.',
  })
  @ApiParam({ name: 'id', description: 'Integration UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Integration deleted successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Integration not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
    await this.integrationsService.delete(id);
    return {
      data: null,
      message: 'Integration deleted successfully',
    };
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Test integration connection',
    description:
      'Tests the connection to the third-party service using stored or provided credentials.',
  })
  @ApiParam({ name: 'id', description: 'Integration UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Connection test completed' })
  @SwaggerApiResponse({ status: 404, description: 'Integration not found' })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() testDto: TestIntegrationDto,
  ): Promise<ApiResponse<TestConnectionResultDto>> {
    const result = await this.integrationsService.testConnection(id, testDto.credentials);
    return {
      data: result,
      message: result.success ? 'Connection test successful' : 'Connection test failed',
    };
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Get integration logs',
    description: 'Retrieves activity logs for an integration.',
  })
  @ApiParam({ name: 'id', description: 'Integration UUID', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.integrationsService.getLogs(id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      action,
    });
    return {
      data: result,
      message: 'Logs retrieved successfully',
    };
  }

  @Put(':id/activate')
  @ApiOperation({
    summary: 'Activate integration',
    description: 'Activates an integration (shortcut for updating isActive to true).',
  })
  @ApiParam({ name: 'id', description: 'Integration UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Integration activated successfully' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<IntegrationResponseDto>> {
    const integration = await this.integrationsService.update(id, { isActive: true });
    return {
      data: integration,
      message: 'Integration activated successfully',
    };
  }

  @Put(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate integration',
    description: 'Deactivates an integration (shortcut for updating isActive to false).',
  })
  @ApiParam({ name: 'id', description: 'Integration UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Integration deactivated successfully' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<IntegrationResponseDto>> {
    const integration = await this.integrationsService.update(id, { isActive: false });
    return {
      data: integration,
      message: 'Integration deactivated successfully',
    };
  }
}
