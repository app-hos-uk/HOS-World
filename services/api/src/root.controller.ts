import { Controller, Get, Version } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('root')
@Controller()
export class RootController {
  @Public()
    @Get()
  @ApiOperation({
    summary: 'Get API root information',
    description: 'Returns basic API information and available endpoints. Public endpoint, no authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'API information retrieved successfully' })
  getRoot() {
    return {
      message: 'House of Spells Marketplace API',
      version: '1.0.0',
      apiVersion: 'v1',
      status: 'running',
      endpoints: {
        v1: '/api/v1',
        legacy: '/api',
        docs: '/api/docs',
        health: '/api/health',
      },
    };
  }
}

