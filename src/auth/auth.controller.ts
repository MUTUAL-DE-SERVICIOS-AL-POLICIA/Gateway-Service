import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthAppMobileGuard } from 'src/auth/guards';
import { NatsService, RecordsService } from 'src/common';
import { LoginAppMobileDto } from './dto';

@ApiTags('auth')
@UseInterceptors(RecordsService)
@Controller('auth')
export class AuthController {
  constructor(private readonly nats: NatsService) {}

  @ApiOperation({ summary: 'Auth AppMobile - loginAppMobile' })
  @ApiResponse({ status: 200, description: 'Login AppMobile' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'numeroCI' },
        countryCode: { type: 'string', example: '+591' },
        cellphone: { type: 'string', example: '71931166' },
        signature: { type: 'string', example: 'firma' },
        firebaseToken: { type: 'string', example: 'token' },
        isBiometric: { type: 'boolean', example: 'true' },
        isCitizenshipDigital: { type: 'boolean', example: 'false' },
        citizenshipDigitalCode: { type: 'string', example: '1234' },
        citizenshipDigitalCodeVerifier: { type: 'string', example: '1234' },
        isRegisterCellphone: { type: 'boolean', example: 'false' },
      },
    },
  })
  @Post('loginAppMobile')
  async loginAppMobile(@Body() body: LoginAppMobileDto) {
    return await this.nats.firstValue('auth.loginAppMobile', body);
  }

  @ApiOperation({ summary: 'Auth AppMobile - verifyPin' })
  @ApiResponse({ status: 200, description: 'Verificar pin SMS y crear token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pin: { type: 'string', example: '1234' },
        messageId: { type: 'string', example: '99999' },
      },
    },
  })
  @Post('verifyPin')
  async verifyPin(@Body() body: any) {
    return await this.nats.firstValue('auth.verifyPin', body);
  }

  @ApiOperation({ summary: 'Auth AppMobile - logoutAppMobile' })
  @ApiResponse({ status: 200, description: 'Eliminar sesión' })
  @Delete('logoutAppMobile')
  @UseGuards(AuthAppMobileGuard)
  async logoutAppMobile(@Req() req: any) {
    return await this.nats.firstValue('auth.logoutAppMobile', req.user);
  }

  @Get('credentialsCitizenshipDigital')
  async credentialsCitizenshipDigital() {
    return await this.nats.firstValue('auth.credentialsCitizenshipDigital', {});
  }

  // Código para generar token para el BCB Test
  @Get('generateBcbJwt')
  async generateBcbJwt() {
    return await this.nats.firstValue('authBcb.generateJwt', {});
  }
}
