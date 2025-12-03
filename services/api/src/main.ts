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
    console.log(`📡 Listening on port: ${port}`);
    console.log(`⏳ Calling app.listen(${port})...`);
    
    const server = await app.listen(port);
    
    console.log(`✅ Server object received:`, !!server);
    console.log(`✅ API server is running on: http://0.0.0.0:${port}/api`);
    console.log(`✅ Health check available at: http://0.0.0.0:${port}/api/health`);
    
    // Verify server is actually listening
    if (server && server.listening) {
      console.log(`✅ Server confirmed listening on port ${port}`);
    } else {
      console.warn(`⚠️ Server object exists but listening status unclear`);
    }
  } catch (error) {
    console.error('❌ Failed to start API server:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

bootstrap();


