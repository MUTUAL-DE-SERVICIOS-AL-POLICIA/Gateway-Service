import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthAppMobileGuard } from 'src/auth/guards';
import { NatsService } from 'src/common';
import { Records } from 'src/records/records.interceptor';
import { LoginUserDto } from './dto';
import { CurrentUser } from './interfaces/current-user.interface';

@ApiTags('auth')
@UseInterceptors(Records)
@Controller('auth')
export class AuthController {
  constructor(private readonly nats: NatsService) {}

  @ApiOperation({ summary: 'Auth Web - loginUser' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'numeroCI' },
        password: { type: 'string', example: '71931166' },
      },
    },
  })
  @Post('login')
  async loginHubWeb(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    try {
      const data: CurrentUser = await this.nats.firstValue('auth.login', loginUserDto);
      const timeShort = 4;
      const oneHourMiliseconds = 3600000;

      res.cookie('msp', data.access_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + timeShort * oneHourMiliseconds),
      });

      return {
        message: 'Login successful',
        user: data.user,
      };
    } catch (error) {
      return {
        error: true,
        message: 'Credenciales inválidas',
      };
    }
  }

  @ApiOperation({ summary: 'Auth Web - logout' })
  @Get('logout')
  async logout(@Res() res: Response): Promise<void> {
    res.clearCookie('msp', {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
    });
    res.status(200).json({
      message: 'Logout successful',
    });
  }

  @ApiOperation({ summary: 'Auth AppMobile - loginAppMobile' })
  @ApiResponse({ status: 200, description: 'Login AppMobile' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'numeroCI' },
        cellphone: { type: 'string', example: '71931166' },
        signature: { type: 'string', example: 'firma' },
        firebaseToken: { type: 'string', example: 'token' },
        isBiometric: { type: 'boolean', example: 'true' },
        isRegisterCellphone: { type: 'boolean', example: 'false' },
      },
    },
  })
  @Post('loginAppMobile')
  async loginAppMobile(@Body() body: any) {
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
}
