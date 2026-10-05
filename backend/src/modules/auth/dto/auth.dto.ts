import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo1@bidwell.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ example: 'Nguyễn Văn An' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  declare password: string;
}
