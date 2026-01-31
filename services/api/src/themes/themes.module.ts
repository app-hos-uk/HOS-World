import { Module } from '@nestjs/common';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';
import { ThemesSeedService } from './themes-seed.service';
import { ThemeUploadService } from './theme-upload.service';
import { StorageModule } from '../storage/storage.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [ThemesController],
  providers: [ThemesService, ThemesSeedService, ThemeUploadService],
  exports: [ThemesService],
})
export class ThemesModule {}
