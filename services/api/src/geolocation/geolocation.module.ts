import { Module } from '@nestjs/common';
import { GeolocationService } from './geolocation.service';
import { GeolocationController } from './geolocation.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GeolocationController],
  providers: [GeolocationService],
  exports: [GeolocationService],
})
export class GeolocationModule {}

