import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { WarehouseRoutingService } from './warehouse-routing.service';
import { GeocodingService } from './geocoding.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController],
  providers: [InventoryService, WarehouseRoutingService, GeocodingService],
  exports: [InventoryService, WarehouseRoutingService, GeocodingService],
})
export class InventoryModule {}
