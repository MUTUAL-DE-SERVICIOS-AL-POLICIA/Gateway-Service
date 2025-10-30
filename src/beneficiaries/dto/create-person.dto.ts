import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePersonDto {
  @IsString()
  first_name: string;

  @IsString()
  @IsOptional()
  second_name?: string;

  @IsString()
  last_name: string;

  @IsString()
  @IsOptional()
  mothers_last_name?: string;

  @IsString()
  identity_card: string;

  @IsDate()
  @IsOptional()
  due_date?: Date;

  @IsBoolean()
  is_duedate_undefined?: boolean;

  @IsString()
  @MaxLength(1)
  gender: string;

  @IsString()
  @MaxLength(1)
  civil_status: string;

  @IsDate()
  @Type(() => Date)
  birth_date: Date;

  @IsDate()
  @IsOptional()
  death_certificate?: Date;

  @IsString()
  @IsOptional()
  death_certificate_number?: string;

  @IsString()
  @IsOptional()
  reason_death?: string;

  @IsInt()
  phone_number: string;

  @IsNumber()
  @IsOptional()
  nua?: number;

  @IsString()
  @IsOptional()
  account_number?: string;

  @IsString()
  @IsOptional()
  sigep_status?: string;

  @IsInt()
  @IsOptional()
  id_person_senasir?: number;

  @IsDate()
  @IsOptional()
  date_last_contribution?: Date;
}
