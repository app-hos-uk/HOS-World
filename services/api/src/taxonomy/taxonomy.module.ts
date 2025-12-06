import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AttributesService } from './attributes.service';
import { TagsService } from './tags.service';
import { CategoriesController } from './categories.controller';
import { AttributesController } from './attributes.controller';
import { TagsController } from './tags.controller';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController, AttributesController, TagsController],
  providers: [CategoriesService, AttributesService, TagsService],
  exports: [CategoriesService, AttributesService, TagsService],
})
export class TaxonomyModule {}

