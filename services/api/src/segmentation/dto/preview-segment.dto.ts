import { IsObject } from 'class-validator';

export class PreviewSegmentDto {
  @IsObject()
  rules!: Record<string, unknown>;
}
