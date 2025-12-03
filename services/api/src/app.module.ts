import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RootController } from './root.controller';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { ThemesModule } from './themes/themes.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReturnsModule } from './returns/returns.module';
import { UploadsModule } from './uploads/uploads.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { SearchModule } from './search/search.module';
import { CacheModule } from './cache/cache.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { PerformanceModule } from './performance/performance.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';
import { KlarnaModule } from './payments/klarna/klarna.module';
import { CharactersModule } from './characters/characters.module';
import { FandomsModule } from './fandoms/fandoms.module';
import { SocialSharingModule } from './social-sharing/social-sharing.module';
import { AIModule } from './ai/ai.module';
import { SellersModule } from './sellers/sellers.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { DuplicatesModule } from './duplicates/duplicates.module';
import { ProcurementModule } from './procurement/procurement.module';
import { FulfillmentModule } from './fulfillment/fulfillment.module';
import { CatalogModule } from './catalog/catalog.module';
import { MarketingModule } from './marketing/marketing.module';
import { FinanceModule } from './finance/finance.module';
import { PublishingModule } from './publishing/publishing.module';
import { DomainsModule } from './domains/domains.module';
import { LogisticsModule } from './logistics/logistics.module';
import { SettlementsModule } from './settlements/settlements.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    CacheModule,
    RateLimitModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    CartModule,
    ThemesModule,
    AddressesModule,
    ReviewsModule,
    WishlistModule,
    ReturnsModule,
    UploadsModule,
    PaymentsModule,
    NotificationsModule,
    DashboardModule,
    SearchModule,
    PerformanceModule,
    NewsletterModule,
    GiftCardsModule,
    KlarnaModule,
    CharactersModule,
    FandomsModule,
    SocialSharingModule,
    AIModule,
    SellersModule,
    SubmissionsModule,
    DuplicatesModule,
    ProcurementModule,
    FulfillmentModule,
    CatalogModule,
    MarketingModule,
    FinanceModule,
    PublishingModule,
    DomainsModule,
    LogisticsModule,
    SettlementsModule,
    StorageModule,
    QueueModule,
  ],
  controllers: [RootController, AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
