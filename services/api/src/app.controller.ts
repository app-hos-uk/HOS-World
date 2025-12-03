import { Controller, Get, Redirect } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getRoot() {
    return {
      message: 'House of Spells Marketplace API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        api: '/api',
        docs: 'Coming soon',
      },
    };
  }

  @Public()
  @Get('api')
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('api/health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'House of Spells Marketplace API',
    };
  }
}


