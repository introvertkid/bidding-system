import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

// Gửi dạng multipart/form-data (kèm file `image`), nên số và ngày cần @Type để chuyển kiểu
export class CreateAuctionDto {
  @ApiProperty({ example: 'MacBook Air M2 16GB / 512GB' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Máy đã qua sử dụng, hoạt động ổn định.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 15000000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  startingPrice: number;

  @ApiPropertyOptional({ description: 'Bỏ trống để dùng bước giá mặc định theo giá khởi điểm' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  bidIncrement?: number;

  @ApiProperty({ example: '2026-10-06T09:00:00+07:00' })
  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @ApiProperty({ example: '2026-10-06T21:00:00+07:00' })
  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  image?: unknown;
}
