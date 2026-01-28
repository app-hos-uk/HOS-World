import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { AdminModule } from './admin/admin.module';
import { CurrencyModule } from './currency/currency.module';
import { GeolocationModule } from './geolocation/geolocation.module';
import { GDPRModule } from './gdpr/gdpr.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ActivityModule } from './activity/activity.module';
import { DiscrepanciesModule } from './discrepancies/discrepancies.module';
import { SupportModule } from './support/support.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { CMSModule } from './cms/cms.module';
import { CollectionsModule } from './collections/collections.module';
import { BadgesModule } from './badges/badges.module';
import { QuestsModule } from './quests/quests.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ShippingModule } from './shipping/shipping.module';
import { CourierModule } from './shipping/courier/courier.module';
import { InventoryModule } from './inventory/inventory.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CustomerGroupsModule } from './customer-groups/customer-groups.module';
import { ReturnPoliciesModule } from './return-policies/return-policies.module';
import { TaxModule } from './tax/tax.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TenantsModule } from './tenants/tenants.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggerModule } from './common/logger/logger.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MonitoringInterceptor } from './monitoring/monitoring.interceptor';
import { IntegrationsModule } from './integrations/integrations.module';
import { GamificationModule } from './gamification/gamification.module';
import { DigitalProductsModule } from './digital-products/digital-products.module';
import { InfluencerInvitationsModule } from './influencer-invitations/influencer-invitations.module';
import { InfluencersModule } from './influencers/influencers.module';
import { InfluencerStorefrontsModule } from './influencer-storefronts/influencer-storefronts.module';
import { ReferralsModule } from './referrals/referrals.module';
import { InfluencerCommissionsModule } from './influencer-commissions/influencer-commissions.module';
import { InfluencerPayoutsModule } from './influencer-payouts/influencer-payouts.module';
import { InfluencerCampaignsModule } from './influencer-campaigns/influencer-campaigns.module';
import { MeilisearchModule } from './meilisearch/meilisearch.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' ? undefined : '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true',
    }),
    LoggerModule,
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
    MeilisearchModule, // Enhanced search with Meilisearch
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
    AdminModule,
    CurrencyModule,
    GeolocationModule,
    GDPRModule,
    ComplianceModule,
    ActivityModule,
    DiscrepanciesModule,
    SupportModule,
    WhatsAppModule,
    TaxonomyModule,
    CMSModule,
    CollectionsModule,
    BadgesModule,
    QuestsModule,
    PromotionsModule,
    ShippingModule,
    CourierModule,
    InventoryModule,
    WebhooksModule,
    CustomerGroupsModule,
    ReturnPoliciesModule,
    TaxModule,
    AnalyticsModule,
    TenantsModule,
    MonitoringModule,
    IntegrationsModule,
    GamificationModule,
    DigitalProductsModule,
    // Influencer Module
    InfluencerInvitationsModule,
    InfluencersModule,
    InfluencerStorefrontsModule,
    ReferralsModule,
    InfluencerCommissionsModule,
    InfluencerPayoutsModule,
    InfluencerCampaignsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
})
export class AppModule {}
