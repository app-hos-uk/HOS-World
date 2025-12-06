import { Module } from '@nestjs/common';
import { CreateTeamUsersController } from './create-team-users.controller';
import { AdminUsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { MigrationController } from './migration.controller';
import { AdminSellersController } from './sellers.controller';
import { AdminProductsController } from './products.controller';
import { MigrationFeaturesController } from './migration-features.controller';
import { MigrationTaxonomyController } from './migration-taxonomy.controller';
import { AdminService } from './admin.service';
import { AdminSellersService } from './sellers.service';
import { AdminProductsService } from './products.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, ProductsModule],
  controllers: [
    CreateTeamUsersController,
    AdminUsersController,
    AdminController,
    MigrationController,
    AdminSellersController,
    AdminProductsController,
    MigrationFeaturesController,
    MigrationTaxonomyController,
  ],
  providers: [AdminService, AdminSellersService, AdminProductsService],
  exports: [AdminService, AdminSellersService, AdminProductsService],
})
export class AdminModule {}

