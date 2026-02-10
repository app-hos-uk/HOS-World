import { Global, Module, DynamicModule, Type } from '@nestjs/common';
import { BasePrismaService } from './base-prisma.service';

/**
 * Database Module
 *
 * A reusable NestJS module that provides a PrismaService instance.
 * Each microservice can use this with its own PrismaService subclass.
 *
 * Usage:
 *   // In a microservice module:
 *   DatabaseCommonModule.forRoot(OrderPrismaService)
 *
 *   // Or use the default BasePrismaService:
 *   DatabaseCommonModule.forRoot()
 */
@Global()
@Module({})
export class DatabaseCommonModule {
  static forRoot(
    prismaService?: Type<BasePrismaService>,
  ): DynamicModule {
    const serviceClass = prismaService || BasePrismaService;

    return {
      module: DatabaseCommonModule,
      providers: [
        {
          provide: BasePrismaService,
          useClass: serviceClass,
        },
        // Also provide the concrete class if it's different from the base
        ...(serviceClass !== BasePrismaService
          ? [
              {
                provide: serviceClass,
                useExisting: BasePrismaService,
              },
            ]
          : []),
      ],
      exports: [BasePrismaService, serviceClass],
    };
  }
}
