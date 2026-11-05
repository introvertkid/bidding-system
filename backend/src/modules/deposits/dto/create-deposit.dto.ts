import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreateDepositDto {
  @ApiPropertyOptional({
    description: 'Số tiền đặt cọc (mặc định 10% giá khởi điểm)',
    example: 1000000,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
