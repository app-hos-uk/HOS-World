import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AttributesService } from './attributes.service';
import { TagsService } from './tags.service';
import { CategoriesController } from './categories.controller';
import { AttributesController } from './attributes.controller';
import { TagsController } from './tags.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoriesController, AttributesController, TagsController],
  providers: [CategoriesService, AttributesService, TagsService],
  exports: [CategoriesService, AttributesService, TagsService],
})
export class TaxonomyModule {}

