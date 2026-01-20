import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { citizenshipDigitalEnvs } from 'src/config/envs';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';


@Injectable()
export class CitizenshipDigitalService {
  private readonly credentials = {
    clientUrl: citizenshipDigitalEnvs.clientUrl,
    clientId: citizenshipDigitalEnvs.clientId,
    redirectUri: citizenshipDigitalEnvs.redirectUri,
    scopes: citizenshipDigitalEnvs.scopes,
  };

  constructor(
    private readonly httpService: HttpService,
  ) {}

  async citizenshipDigitalCredentials() {
    return this.credentials;
  }

  async findPerson(body: any) {
    try {
      const { code, codeVerifier } = body;

      const tokenUrl = `${this.credentials.clientUrl}/token`;

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('redirect_uri', this.credentials.redirectUri);
      params.append('code_verifier', codeVerifier);
      params.append('code', code);
      params.append('client_id', this.credentials.clientId);
      const tokenResponse = await firstValueFrom(
        this.httpService.post(tokenUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      const { access_token, id_token } = tokenResponse.data;

      if (!access_token) {
        throw new HttpException('No se obtuvo access_token', 500);
      }

      const getPerson = await firstValueFrom(
        this.httpService.get(`${this.credentials.clientUrl}/me`, {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }),
      );
      // PARA TEST 
      // const getPerson: any =  {
      //   data: {
      //     sub: '4f9469c2-cc57-45f0-8151-82b38f5e0047',
      //     profile: {
      //       documento_identidad: { numero_documento: '9994084', tipo_documento: 'CI' },
      //       nombre: {
      //         nombres: 'LEONEL ALVARO',
      //         primer_apellido: 'CHAMACA',
      //         segundo_apellido: 'LIMA'
      //       }
      //     },
      //     fecha_nacimiento: '22/04/1999',
      //     email: 'leonellimaa56@gmail.com',
      //     celular: '73716888'
      //   }
      // }

      const urlLogout =
        `${this.credentials.clientUrl}/session/end?` +
        `id_token_hint=${encodeURIComponent(id_token)}` +
        `&post_logout_redirect_uri=${encodeURIComponent('com.muserpol.pvt:/oauth2redirect')}`;

      const names = getPerson.data.profile.nombre.nombres.split(' ');
      const profile = {
        identityCard: getPerson.data.profile.documento_identidad.numero_documento,
        firstName: names[0],
        secondName: names.length > 1 ? names[1] : '',
        lastName: getPerson.data.profile.nombre.primer_apellido,
        mothersLastName: getPerson.data.profile.nombre.segundo_apellido,
        birthDate: getPerson.data.fecha_nacimiento,
        email: getPerson.data.email,
        cellphone: getPerson.data.celular
      }

      return {
        profile,
        urlLogout,
      };
    } catch (error) {
      throw new HttpException('Error consultando ciudadanía digital', HttpStatus.BAD_GATEWAY);
    }
  }
}
