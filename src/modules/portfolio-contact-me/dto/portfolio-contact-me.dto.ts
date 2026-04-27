import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PortfolioContactMeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  @Type(() => String)
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @Type(() => String)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(150)
  @Type(() => String)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  @Type(() => String)
  message!: string;

  @IsString()
  @IsNotEmpty()
  @Type(() => String)
  captchaToken!: string;
}
