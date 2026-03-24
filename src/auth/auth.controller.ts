import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthAppMobileGuard } from 'src/auth/guards';
import { NatsService } from 'src/common';
import { Records } from 'src/records/records.interceptor';
import { LoginAppMobileDto } from './dto';
import { CurrentUser } from './interfaces/current-user.interface';

@ApiBearerAuth('msp')
@ApiTags('auth')
// @UseInterceptors(Records)
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


  /* ======================================================
   *  OIDC / SSO 
   * ====================================================== */

  @ApiOperation({ summary: 'Auth Plataforma - Construir URL de autorización (PKCE + state)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        returnTo: { type: 'string', example: 'http://localhost:3001/modules' },
      },
      required: ['returnTo'],
    },
  })
  @Get('login')
  @Redirect()
  async startLogin(@Req() req: any, @Res() res: Response) {
    // El frontend manda returnTo, y nosotros determinamos el clientId desde .env
    const clientId = req.query.clientId;
    const returnTo = req.query.returnTo;
    const { url } = await this.nats.firstValue('auth.login.start', {
      returnTo,
      clientId,
    });

    res.setHeader('Cache-Control', 'no-store');
    return { url, statusCode: 302 };
  }

  @ApiOperation({ summary: 'Auth Plataforma - Exchange code/state → sid (establece cookie sid)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'abc123' },
        state: { type: 'string', example: 'xyz789' },
      },
      required: ['code', 'state'],

    },
  })
  @Post('exchange')
  @ApiResponse({
    status: 200,
    description: 'Sesión creada',
    schema: { example: { sessionId: '...', returnTo: '...' } },
  })
  async exchange(
    @Body() body: { code: string; state: string; sidCookie?: string },
    @Res() res: Response,
  ) {
    if (!body?.code || !body?.state) {
      return res.status(400).json({ error: 'Faltan code/state' });
    }

    const { sid, returnTo, profile, permissions } = await this.nats.firstValue('auth.login.exchange', {
      code: body.code,
      state: body.state,
      ...(body.sidCookie ? { sid: body.sidCookie } : {}),
    });
    console.log('Exchange OIDC - nueva sesión creada:', { sid, returnTo });
    return res.status(200).json({ sessionId: sid, returnTo, profile, permissions });
  }

  /* ======================================================
   *  Endpoints útiles de sesión (para debug / status)
   * ====================================================== */

  @ApiOperation({ summary: 'Auth Plataforma - Logout SSO (revoca tokens y elimina sid)' })
  @Delete('logout')
  async ssoLogout(@Req() req: Request, @Res() res: Response) {
    const sid = req.cookies?.sid;
    console.log('Logout OIDC - cerrando sesión:', { sid });
    if (sid) {
      try {
        await this.nats.firstValue('auth.logout', { sid });
      } catch (err) {
        console.error('❌ Error al cerrar sesión en Auth-Service:', err);
      }
    }

    // El backend NO elimina cookies del navegador (lo hace el frontend)
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).send(); // No Content
  }

  /* ======================================================
   *  Endpoints útiles de autorización (para debug / status)
   * ====================================================== */

  @ApiOperation({ summary: 'Auth Plataforma - getProfile' })
  @Get('profile')
  async getProfile(@Req() req: Request, @Res() res: Response) {
    const sid = req.cookies?.sid;
    if (!sid) return res.status(401).json({ ok: false, message: 'Falta cookie sid' });

    const origin =
      (req.headers.origin as string) ||
      (req.headers['x-origin'] as string) ||
      (req.headers.referer as string) ||
      (req.headers['x-referer'] as string);
    console.log('getProfile', { sid, origin });
    try {
      const data = await this.nats.firstValue('auth.profile.get', { sid, origin });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(data);
    } catch (e: any) {
      return res
        .status(401)
        .json({ ok: false, code: 'PROFILE_LOOKUP_FAILED', message: e?.message ?? 'Unauthorized' });
    }
  }

  @ApiOperation({ summary: 'Auth Plataforma - Verificar existencia y validez del access token de un cliente' })
  @Get('token/verify')
  async verifyTokenEndpoint(
    @Query('clientId') client_id: string,
    @Req() req: Request, @Res() res: Response
    ) {
      console.log('sid');
    const sid = req.cookies?.sid;
    
    if (!sid) return res.status(401).json({ ok: false, message: 'Falta cookie sid' });

    const clientId = req.query?.clientId || client_id;
    if (!clientId) return res.status(400).json({ ok: false, message: 'Falta clientId' });

    console.log('Verifying token for clientId:', clientId, sid);
    const origin =
      // (req.headers.origin as string) ||
      (req.headers['x-origin'] as string) 
      // (req.headers.referer as string) ||
      // (req.headers['x-referer'] as string);

    console.log('verifyToken', { sid, clientId, origin });
    try {
      const data = await this.nats.firstValue('auth.token.verify', { sid, clientId, origin });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(data);
    } catch (e: any) {
      return res
        .status(401)
        .json({ ok: false, code: 'PROFILE_LOOKUP_FAILED', message: e?.message ?? 'Unauthorized' });
    }
  }


  @ApiOperation({ summary: 'Auth Plataforma - Listar permisos UMA para un audience (resource-server)' })
  @ApiQuery({ name: 'audience', type: String, required: true })
  @Get('permissions')
  async getPermissions(
    @Req() req: Request,
    @Res() res: Response,
    // @Query('clientId') clientId: string,
    @Query('audience') aud: string,

  ) {
    const sid = req.cookies?.sid /* || sessionId*/ ;
    
    if (!sid) return res.status(401).json({ ok: false, message: 'Falta cookie sid' });

    const audience = req.query.audience || aud /* || aud*/;
    if (!audience) return res.status(400).json({ ok: false, message: 'Falta audience' });

    const origin =
      (req.headers['x-origin'] as string) ||
      (req.headers.origin as string) ||
      (req.headers.referer as string) ||
      (req.headers['x-referer'] as string);
    console.log('getPermissions', { sid, audience, origin });
    try {
      const out = await this.nats.firstValue('auth.permissions.list', {
        sid,
        audience,
        origin,
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(out);
    } catch (e: any) {
      return res
        .status(401)
        .json({
          ok: false,
          code: 'PERMISSIONS_LIST_FAILED',
          message: e?.message ?? 'Unauthorized',
        });
    }
  }

  @ApiOperation({ summary: 'Auth Plataforma - Evaluar permiso UMA (resource#scope) contra audience' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audience: { type: 'string', example: 'records-api' },
        resource: { type: 'string', example: 'expedientes' },
        scope: { type: 'string', example: 'create' },
      },
      required: ['audience', 'resource', 'scope'],
    },
  })
  @Post('permission/evaluate')
  async evaluatePermission(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const sid = req.cookies?.sid;
    if (!sid) return res.status(401).json({ ok: false, message: 'Falta cookie sid' });

    const { audience, resource, scope } = body ?? {};
    if (!audience || !resource || !scope) {
      return res.status(400).json({ ok: false, message: 'Faltan audience/resource/scope' });
    }

    const origin =
      (req.headers['x-origin'] as string) ||
      (req.headers.origin as string) ||
      (req.headers.referer as string) ||
      (req.headers['x-referer'] as string);
    try {
      const out = await this.nats.firstValue('auth.permission.evaluate', {
        sid,
        audience,
        resource,
        scope,
        origin,
      });
      console.log('evaluatePermission response', out);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(out);
    } catch (e: any) {
      return res
        .status(401)
        .json({
          ok: false,
          code: 'PERMISSION_EVALUATE_FAILED',
          message: e?.message ?? 'Unauthorized',
        });
    }
  }

  @ApiOperation({ summary: 'Auth Plataforma - Token exchange: obtiene tokens, perfil y permisos para otro cliente usando la sesión de hub' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', example: 'beneficiary-interface', description: 'Si no se envía, se usa hubClientId' },
        audience: { type: 'string', example: 'beneficiaries-api' },
      },
      required: ['audience'],
    },
  })
  @Post('token/exchange')
  async tokenExchange(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { sid?: string; clientId?: string; audience: string },
  ) {

    const sid = body.sid || req.cookies?.sid;
    if (!sid) return res.status(401).json({ ok: false, message: 'Falta cookie sid' });

    const { clientId, audience } = body ?? {};
    if (!audience) return res.status(400).json({ ok: false, message: 'Falta audience' });

    try {
      const out = await this.nats.firstValue('auth.token.exchange', {
        sid,
        ...(clientId ? { clientId } : {}),
        audience,
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(out);
    } catch (e: any) {
      return res.status(401).json({
        ok: false,
        code: 'TOKEN_EXCHANGE_FAILED',
        message: e?.message ?? 'Unauthorized',
      });
    }
  }
}
