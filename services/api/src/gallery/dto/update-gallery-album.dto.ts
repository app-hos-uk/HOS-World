import { PartialType } from '@nestjs/swagger';
import { CreateGalleryAlbumDto } from './create-gallery-album.dto';

export class UpdateGalleryAlbumDto extends PartialType(CreateGalleryAlbumDto) {}
