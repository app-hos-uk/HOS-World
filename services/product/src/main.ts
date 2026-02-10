import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const logger = new Logger('ProductService');

async function bootstrap() {
  logger.log('Starting Product Catalog Microservice...');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn', 'debug'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('HOS Product Service').setVersion('1.0.0').addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth').build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    const url = new URL(redisUrl);
    app.connectMicroservice<MicroserviceOptions>({ transport: Transport.REDIS, options: { host: url.hostname, port: parseInt(url.port || '6379', 10), password: url.password || undefined, retryAttempts: 5, retryDelay: 3000 } });
    await app.startAllMicroservices();
    logger.log('Connected to Redis event bus');
  } catch (error: any) { logger.warn(`Could not connect to Redis: ${error?.message}`); }

  const port = process.env.PRODUCT_PORT || process.env.PORT || 3007;
  await app.listen(port, '0.0.0.0');
  logger.log(`Product service running on http://0.0.0.0:${port}`);
}

bootstrap().catch((error) => { logger.error(`Product service failed: ${error?.message}`); process.exit(1); });
