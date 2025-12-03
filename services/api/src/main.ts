import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('🚀 Starting API server...');
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? '***set***' : '***missing***',
    });

    const app = await NestFactory.create(AppModule);

    // Enable CORS
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    });

    // Add root route handler via middleware BEFORE setting global prefix
    app.use('/', (req: any, res: any, next: any) => {
      if (req.path === '/' && req.method === 'GET') {
        return res.json({
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
        });
      }
      next();
    });

    // Global prefix for all routes
    app.setGlobalPrefix('api');

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const port = process.env.PORT || 3001;
    console.log(`📡 About to listen on port: ${port}`);
    
    // Use app.listen() to ensure all routes are properly registered
    await app.listen(port, '0.0.0.0');
    
    console.log(`✅ Server is listening on port ${port}`);
    console.log(`✅ API server is running on: http://0.0.0.0:${port}/api`);
    console.log(`✅ Health check available at: http://0.0.0.0:${port}/api/health`);
    console.log(`✅ Root endpoint available at: http://0.0.0.0:${port}/`);
  } catch (error) {
    console.error('❌ Failed to start API server:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

bootstrap();


