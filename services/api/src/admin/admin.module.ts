import { Module, forwardRef } from '@nestjs/common';
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
import { PublicConfigController } from './public-config.controller';
import { AdminService } from './admin.service';
import { AdminSeedService } from './admin-seed.service';
import { AdminSellersService } from './sellers.service';
import { AdminProductsService } from './products.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsModule } from '../products/products.module';
import { ReviewsModule } from '../reviews/reviews.module';

const isProduction = process.env.NODE_ENV === 'production';
const migrationControllersEnabled = process.env.ENABLE_ADMIN_MIGRATIONS === 'true';

const coreControllers = [
  // CreateTeamUsersController has both dev-only and production-safe endpoints with separate guards
  CreateTeamUsersController,
  AdminUsersController,
  AdminController,
  AdminSellersController,
  AdminProductsController,
  PublicConfigController,
];

// Never register HTTP migration runners in production (defense in depth vs raw SQL).
const migrationControllers =
  !isProduction && migrationControllersEnabled
    ? [
        MigrationController,
        MigrationFeaturesController,
        MigrationTaxonomyController,
        MigrationTaxonomyDataController,
      ]
    : [];

@Module({
  imports: [DatabaseModule, ConfigModule, NotificationsModule, ProductsModule, forwardRef(() => ReviewsModule)],
  controllers: [...coreControllers, ...migrationControllers],
  providers: [AdminService, AdminSeedService, AdminSellersService, AdminProductsService],
  exports: [AdminService, AdminSeedService, AdminSellersService, AdminProductsService],
})
export class AdminModule {}
