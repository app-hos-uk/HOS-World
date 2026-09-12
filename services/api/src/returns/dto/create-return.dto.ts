import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'exactlyOneReturnSource', async: false })
class ExactlyOneReturnSourceConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as CreateReturnDto;
    const hasOrder = typeof obj.orderId === 'string' && obj.orderId.trim().length > 0;
    const hasPos = typeof obj.posSaleId === 'string' && obj.posSaleId.trim().length > 0;
    return hasOrder !== hasPos;
  }

  defaultMessage() {
    return 'Exactly one of orderId or posSaleId must be provided';
  }
}

@ValidatorConstraint({ name: 'exactlyOneReturnItemSource', async: false })
class ExactlyOneReturnItemSourceConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as ReturnItemDto;
    const hasOrderItem = typeof obj.orderItemId === 'string' && obj.orderItemId.trim().length > 0;
    const hasPosItem = typeof obj.posSaleItemId === 'string' && obj.posSaleItemId.trim().length > 0;
    return hasOrderItem !== hasPosItem;
  }

  defaultMessage() {
    return 'Exactly one of orderItemId or posSaleItemId must be provided';
  }
}

export class ReturnItemDto {
  @ValidateIf((o: ReturnItemDto) => !o.posSaleItemId)
  @IsString()
  @IsNotEmpty()
  orderItemId?: string;

  @ValidateIf((o: ReturnItemDto) => !o.orderItemId)
  @IsString()
  @IsNotEmpty()
  posSaleItemId?: string;

  // Always present, so the XOR check is not skipped by ValidateIf/IsOptional.
  @Validate(ExactlyOneReturnItemSourceConstraint)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateReturnDto {
  // Bound to `reason` so the XOR check always runs (IsOptional on orderId/posSaleId
  // would otherwise skip validators when that field is omitted).
  @Validate(ExactlyOneReturnSourceConstraint)
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  posSaleId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items?: ReturnItemDto[];
}
