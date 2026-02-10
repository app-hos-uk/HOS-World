import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const logger = new Logger('InventoryService');

async function bootstrap() {
  logger.log('Starting Inventory/Shipping Microservice...');

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

  app.enableCors({ origin: true, credentials: true });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('HOS Inventory Service')
      .setDescription('Inventory, Shipping, Fulfillment & Logistics API')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
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
    logger.warn(`Could not connect to Redis event bus: ${error?.message}. Events disabled.`);
  }

  const port = process.env.INVENTORY_PORT || process.env.PORT || 3010;
  await app.listen(port, '0.0.0.0');
  logger.log(`Inventory service running on http://0.0.0.0:${port}`);
}

bootstrap().catch((error) => {
  logger.error(`Inventory service failed to start: ${error?.message}`);
  process.exit(1);
});
