import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class LoginAppMobileDto {
  @IsString()
  @IsOptional()
  username: string = '';

  @IsString()
  @IsOptional()
  countryCode: string = '+591';

  @IsString()
  @IsOptional()
  cellphone: string = '';

  @IsString()
  @IsOptional()
  signature: string = '';

  @IsString()
  @IsOptional()
  firebaseToken: string = '';

  @IsBoolean()
  @IsOptional()
  isBiometric: boolean = false;

  @IsBoolean()
  @IsOptional()
  isCitizenshipDigital: boolean = false;

  @IsString()
  @IsOptional()
  citizenshipDigitalCode: string = '';

  @IsString()
  @IsOptional()
  citizenshipDigitalCodeVerifier: string = '';

  @IsBoolean()
  @IsOptional()
  isRegisterCellphone: boolean = false;
}
