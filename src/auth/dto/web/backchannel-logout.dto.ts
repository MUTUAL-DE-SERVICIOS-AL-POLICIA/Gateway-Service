import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BackchannelLogoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16384)
  logout_token: string;
}
