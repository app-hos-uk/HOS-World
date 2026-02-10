import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const logger = new Logger('SearchService');

async function bootstrap() {
  logger.log('Starting Search Microservice...');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('HOS Search Service')
      .setDescription('Search microservice API — Elasticsearch and Meilisearch product search')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    logger.log('Swagger docs available at /docs');
  }

  // Redis Microservice Transport
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    const url = new URL(redisUrl);
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.REDIS,
      options: {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        retryAttempts: 5,
        retryDelay: 3000,
      },
    });

    await app.startAllMicroservices();
    logger.log(`Connected to Redis event bus at ${url.hostname}:${url.port || 6379}`);
  } catch (error: any) {
    logger.warn(
      `Could not connect to Redis event bus: ${error?.message}. Event-driven indexing disabled.`,
    );
  }

  const port = process.env.SEARCH_PORT || process.env.PORT || 3004;
  await app.listen(port, '0.0.0.0');

  logger.log(`Search service running on http://0.0.0.0:${port}`);
  logger.log(`Health check: http://0.0.0.0:${port}/api/health`);
}

bootstrap().catch((error) => {
  logger.error(`Search service failed to start: ${error?.message}`);
  logger.error(error?.stack);
  process.exit(1);
});
