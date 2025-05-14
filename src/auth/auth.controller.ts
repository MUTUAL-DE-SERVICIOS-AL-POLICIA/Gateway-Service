import { Body, Controller, Get, Logger, Param, Post, Res, UseGuards } from '@nestjs/common';
import { LoginUserDto, LdapUserDto, UserDetailDto, UserListDto } from './dto';
import { Response } from 'express';
import { NatsService, RecordService } from 'src/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './interfaces/current-user.interface';
import { AuthGuard } from './guards/auth.guard';
import { User } from './decorators/user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
@ApiBearerAuth('access-token')
export class AuthController {
  private readonly logger = new Logger('AuthController');
  constructor(
    private readonly nats: NatsService,
    private readonly recordService: RecordService,
  ) {}

  @Post('login')
  @ApiBody({
    schema: {
      example: {
        username: 'example',
        password: 'contraseña',
      },
    },
  })
  async loginUser(@Body() loginUserDto: LoginUserDto, @Res({ passthrough: true }) res: Response) {
    this.logger.log({ username: loginUserDto.username });
    try {
      const data: CurrentUser = await this.nats.firstValue('auth.login', loginUserDto);
      const timeShort = 4; // 4 horas
      const oneHourMiliseconds = 3600000;
      this.logger.log('Login successful');
      if (data.user.username != 'pvtbe') {
        this.recordService.http('Inicio de sesion exitosa', data.user.data.username, 1, 1, 'User');
      }
      res.cookie('msp', data.access_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + timeShort * oneHourMiliseconds),
      });
      res.cookie('modules', JSON.stringify(data.user.modules), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + timeShort * oneHourMiliseconds),
      });
      res.cookie('user', JSON.stringify(data.user.data), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + timeShort * oneHourMiliseconds),
      });
      if (data.user.modulesWithRoles && Array.isArray(data.user.modulesWithRoles)) {
        for (const module of data.user.modulesWithRoles) {
          const cookieName = `mod_${module.id}`;
          res.cookie(cookieName, JSON.stringify(module), {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            expires: new Date(Date.now() + timeShort * oneHourMiliseconds),
          });
        }
      }
      res.status(200).json({
        message: 'Login successful',
      });
    } catch (error) {
      this.logger.error(error);
      res.status(401).json({
        error: true,
        message: error.message,
      });
    }
  }

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

  @Get('ldapUsers')
  @ApiOperation({ summary: 'Obtener todos los usuarios LDAP' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios encontrados',
    type: [LdapUserDto],
  })
  async getLdapUsers(): Promise<LdapUserDto[]> {
    return this.nats.firstValue('auth.ldap.getAllUsers', {});
  }

  @Get('users')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios encontrada',
    type: [UserListDto],
  })
  async getAllUsers() {
    return this.nats.firstValue('user.getAll', {});
  }
  @Get('users/:uuid')
  @ApiOperation({ summary: 'Obtener un usuario por UUID' })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
    type: UserDetailDto,
  })
  async getUserById(@Param('uuid') uuid: string) {
    return this.nats.firstValue('user.getByUuid', { uuid });
  }

  @UseGuards(AuthGuard)
  @Get('userManagementRoles')
  @ApiOperation({ summary: 'Obtener los roles de gestión de usuarios' })
  async getUserManagementRoles(@User() user: JwtPayload) {
    return this.nats.firstValue('user.managementModulesByUser', { userId: user.id });
  }
}
