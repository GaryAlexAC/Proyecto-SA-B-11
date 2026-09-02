import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateIdentityDocumentDto {
  @Type(() => Number)
  @IsInt() @Min(1) version!: number;
}
