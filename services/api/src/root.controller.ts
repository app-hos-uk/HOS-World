import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class RootController {
  @Public()
  @Get()
  getRoot() {
    return {
      message: 'House of Spells Marketplace API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        api: '/api',
        health: '/api/health',
        products: '/api/products',
        auth: '/api/auth',
      },
      documentation: 'API documentation coming soon',
    };
  }
}

