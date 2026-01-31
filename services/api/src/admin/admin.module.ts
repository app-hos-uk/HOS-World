import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreateTeamUsersController } from './create-team-users.controller';
import { AdminUsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { MigrationController } from './migration.controller';
import { AdminSellersController } from './sellers.controller';
import { AdminProductsController } from './products.controller';
import { MigrationFeaturesController } from './migration-features.controller';
import { MigrationTaxonomyController } from './migration-taxonomy.controller';
import { MigrationTaxonomyDataController } from './migration-taxonomy-data.controller';
import { AdminService } from './admin.service';
import { AdminSellersService } from './sellers.service';
import { AdminProductsService } from './products.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [DatabaseModule, ConfigModule, NotificationsModule, ProductsModule],
  controllers: [
    CreateTeamUsersController,
    AdminUsersController,
    AdminController,
    MigrationController,
    AdminSellersController,
    AdminProductsController,
    MigrationFeaturesController,
    MigrationTaxonomyController,
    MigrationTaxonomyDataController,
  ],
  providers: [AdminService, AdminSellersService, AdminProductsService],
  exports: [AdminService, AdminSellersService, AdminProductsService],
})
export class AdminModule {}
