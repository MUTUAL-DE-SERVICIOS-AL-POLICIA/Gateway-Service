import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { bcbEnvs } from 'src/config/envs';
import { NatsService } from './nats.service';
import {
  BCB_QR_STATUSES,
  BcbPaymentNotificationDto,
  BcbQrStatus,
} from '../dto/bcb-payment-notification.dto';

export { BcbQrStatus };

type BcbHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface BcbSignatureConfig {
  algorithm: string;
  keyid: string;
  secretkey: string;
  headers: readonly string[];
}

const BCB_REQUEST_RETRIES = 2;
const BCB_RETRY_DELAY_MS = 500;
const BCB_REQUEST_TIMEOUT_MS = 15000;
const BCB_STATUS_TIMEOUT_MS = 5000;
const BCB_BODY_METHODS: readonly BcbHttpMethod[] = ['POST', 'PUT', 'PATCH'];
const BCB_SIGNATURE_HEADERS = ['X-Date', 'X-Digest', 'X-Entity-Id'] as const;
const BCB_RETRYABLE_ERROR_CODES = [
  'ECONNABORTED',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ETIMEDOUT',
] as const;
const BCB_UNAVAILABLE_HTTP_STATUSES: readonly number[] = [
  HttpStatus.BAD_GATEWAY,
  HttpStatus.SERVICE_UNAVAILABLE,
  HttpStatus.GATEWAY_TIMEOUT,
];
const BCB_UNAVAILABLE_MESSAGE_PARTS = [
  'bad gateway',
  'service unavailable',
  'cloudguard waf',
  'invalid response from the host server',
] as const;
const BCB_UNAVAILABLE_MESSAGE =
  'Servicio BCB fuera de servicio temporalmente. Intente nuevamente más tarde.';

@Injectable()
export class BcbService {
  private readonly bcbUrl = bcbEnvs.bcbUrl;
  private readonly bcbEntityId = bcbEnvs.bcbEntityId;
  private readonly bcbKeyId = bcbEnvs.bcbKeyId;
  private readonly bcbSecret = bcbEnvs.bcbSecret;
  private readonly bcbToken = bcbEnvs.bcbToken;
  private readonly validQrStatuses = [...BCB_QR_STATUSES];

  constructor(
    private readonly httpService: HttpService,
    private readonly nats: NatsService,
  ) {}

  async status() {
    return await this.checkBcbStatus();
  }

  async generateQr(data: any) {
    const response = await this.send('POST', 'v1/qr', data);

    this.validateFinalizedResponse(response);

    if (!response?.datos?.idQr || !response?.datos?.imagenQr) {
      throw new HttpException(
        {
          finalizado: false,
          mensaje: 'BCB no devolvió idQr o imagenQr en la generación de QR',
          datos: response,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      finalizado: response?.finalizado,
      mensaje: response?.mensaje,
      datos: {
        idQr: response.datos.idQr,
        imagenQr: response.datos.imagenQr,
      },
      serviceStatus: true,
    };
  }

  async qrStatus(qrId: string) {
    if (!qrId) {
      throw new BadRequestException('El id QR es obligatorio');
    }

    const response = await this.send('GET', `v1/qr/${qrId}`);

    this.validateFinalizedResponse(response);

    return {
      ...response,
      serviceStatus: true,
      statusValidation: this.buildQrStatusValidation(response),
    };
  }

  async processPaymentNotification(payload: BcbPaymentNotificationDto) {
    const schema = String(payload.metaData?.schema ?? '');
    const message = String(payload.metaData?.message ?? '');
    const pattern = `${schema}.${message}`;

    return await this.nats.firstValue(pattern, payload);
  }

  buildErrorResponse(error: any) {
    const statusCode = error instanceof HttpException ? error.getStatus() : error?.status;
    const response = error instanceof HttpException ? error.getResponse() : error?.response;
    const rawMessage =
      typeof response === 'string'
        ? response
        : response?.mensaje ||
          response?.message ||
          error?.message ||
          'Error al comunicarse con BCB';
    const message = this.normalizeBcbErrorMessage(rawMessage);

    return {
      error: true,
      serviceStatus: false,
      finalizado: false,
      statusCode: statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      data: typeof response === 'object' ? response : null,
    };
  }

  async entities() {
    const response = await this.send('GET', `v1/entidades/${this.bcbEntityId}`);

    this.validateFinalizedResponse(response);

    return this.buildSuccessfulResponse(response);
  }

  async createAccount(data: any) {
    const payload = this.normalizeCreateAccountPayload(data);
    const response = await this.send('POST', 'v1/cuentas', payload);

    this.validateFinalizedResponse(response);

    return this.buildSuccessfulResponse(response);
  }

  async updateAccount(cta: string, data: any) {
    if (!cta) {
      throw new BadRequestException('La cuenta cta es obligatoria');
    }

    const payload = this.normalizeAccountPayload(data);
    const response = await this.send('PUT', `v1/cuentas/${encodeURIComponent(cta)}`, payload);

    this.validateFinalizedResponse(response);

    return this.buildSuccessfulResponse(response);
  }

  async send(method: BcbHttpMethod, endpoint: string, data?: any) {
    try {
      this.validateConfig();

      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

      if (path !== '/') {
        await this.checkBcbStatus();
      }

      const currentDate = new Date().toUTCString();

      const hasBody = BCB_BODY_METHODS.includes(method);
      const bodyString = hasBody ? JSON.stringify(data ?? {}) : undefined;

      const digestInput = hasBody ? bodyString : this.buildSigningPath(path);
      const computedDigest = await this.generateSha512Digest(digestInput);

      const headerHash = {
        'X-Date': currentDate,
        'X-Digest': computedDigest,
        'X-Entity-Id': this.bcbEntityId,
      };

      const signature = await this.computeHttpSignature(
        {
          algorithm: 'HmacSHA256',
          keyid: this.bcbKeyId,
          secretkey: this.bcbSecret,
          headers: BCB_SIGNATURE_HEADERS,
        },
        headerHash,
      );

      const headers = {
        ...headerHash,
        'X-Signature': signature,
        Authorization: `Bearer ${this.bcbToken}`,
        'Content-Type': 'application/json',
      };

      const response$ = this.httpService.request({
        method,
        url: this.buildUrl(path),
        headers,
        data: bodyString,
        timeout: BCB_REQUEST_TIMEOUT_MS,
        transformRequest: [(requestData) => requestData],
      });

      const { data: responseData, status } = await this.requestWithRetry(() =>
        firstValueFrom(response$),
      );

      if (status < 200 || status >= 300) {
        throw new HttpException(responseData || 'BCB respondió con estado HTTP inválido', status);
      }

      return responseData;
    } catch (error: any) {
      this.throwBcbHttpError(error);
    }
  }

  private async generateSha512Digest(data: string): Promise<string> {
    const hash = crypto.createHash('sha512').update(data, 'utf8').digest('base64');

    return `SHA-512=${hash}`;
  }

  private async computeHttpSignature(
    config: BcbSignatureConfig,
    headerHash: Record<string, string>,
  ): Promise<string> {
    let signingBase = '';

    config.headers.forEach((h, index) => {
      if (index > 0) signingBase += '\n';
      signingBase += `${h.toLowerCase()}: ${headerHash[h]}`;
    });

    const secretKeyBuffer = Buffer.from(config.secretkey, 'utf8');

    const signature = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(signingBase, 'utf8')
      .digest('base64');

    return `keyid="${config.keyid}", algorithm="${config.algorithm}", headers="${config.headers.join(
      ' ',
    )}", signature="${signature}"`;
  }

  private async checkBcbStatus() {
    try {
      if (!this.bcbUrl) {
        throw new HttpException('BCB_URL no está configurado', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const response$ = this.httpService.request({
        method: 'GET',
        url: this.buildUrl('/'),
        timeout: BCB_STATUS_TIMEOUT_MS,
      });

      const { data, status } = await this.requestWithRetry(() => firstValueFrom(response$));

      if (status === HttpStatus.NOT_FOUND) {
        throw new HttpException(
          {
            finalizado: false,
            mensaje: 'Status BCB inválido: el endpoint base respondió 404',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (status < 200 || status >= 300) {
        throw new HttpException(
          {
            finalizado: false,
            mensaje: `Status BCB inválido: HTTP ${status}`,
            datos: data,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.validateFinalizedResponse(data);

      return this.buildSuccessfulResponse(data);
    } catch (error: any) {
      this.throwBcbHttpError(error);
    }
  }

  private validateConfig() {
    const missing = [
      ['BCB_URL', this.bcbUrl],
      ['BCB_ENTITY_ID', this.bcbEntityId],
      ['BCB_KEY_ID', this.bcbKeyId],
      ['BCB_SECRET', this.bcbSecret],
      ['BCB_TOKEN', this.bcbToken],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new HttpException(
        `Configuración BCB incompleta: ${missing.join(', ')}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private normalizeCreateAccountPayload(data: any) {
    const payload = this.normalizeAccountPayload(data, true);
    const missingFields = ['eif', 'eifCuenta', 'ciNitTitular', 'nombreTitular'].filter((field) =>
      this.isBlank(payload[field]),
    );

    if (missingFields.length > 0) {
      throw new BadRequestException({
        finalizado: false,
        mensaje: 'Datos de cuenta BCB inválidos',
        errores: missingFields.map((field) => `${field}: es obligatorio`),
      });
    }

    return payload;
  }

  private normalizeAccountPayload(data: any, useCreateAliases = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException({
        finalizado: false,
        mensaje: 'Datos de cuenta BCB inválidos',
        errores: ['body: debe ser un objeto JSON'],
      });
    }

    const payload = { ...data };
    const eifCuenta = this.firstNonBlank(
      data.eifCuenta,
      data.eif_cuenta,
      data.accountNumber,
      useCreateAliases ? data.cta : undefined,
      useCreateAliases ? data.cuenta : undefined,
    );

    if (eifCuenta !== undefined) {
      payload.eifCuenta = String(eifCuenta);
    }

    delete payload.eif_cuenta;
    delete payload.accountNumber;
    delete payload.cta;
    delete payload.cuenta;

    return payload;
  }

  private firstNonBlank(...values: any[]) {
    return values.find((value) => !this.isBlank(value));
  }

  private isBlank(value: any) {
    return value === undefined || value === null || String(value).trim() === '';
  }

  private buildUrl(path: string) {
    const baseUrl = this.bcbUrl.replace(/\/+$/, '');
    return path === '/' ? `${baseUrl}/` : `${baseUrl}${path}`;
  }

  private buildSigningPath(path: string) {
    const url = new URL(this.buildUrl(path));
    return `${url.pathname}${url.search}`;
  }

  private buildSuccessfulResponse(response: any) {
    return {
      ...response,
      serviceStatus: true,
    };
  }

  private validateFinalizedResponse(response: any) {
    if (response && typeof response === 'object' && response.finalizado === false) {
      throw new HttpException(response, HttpStatus.BAD_GATEWAY);
    }

    const message = typeof response?.mensaje === 'string' ? response.mensaje.toLowerCase() : '';

    if (message.includes('no autorizado')) {
      throw new HttpException(response, HttpStatus.FORBIDDEN);
    }
  }

  private buildQrStatusValidation(response: any) {
    const orders = Array.isArray(response?.datos?.ordenes) ? response.datos.ordenes : [];
    const statuses = orders.map((order: any) => order?.estado).filter(Boolean);
    const invalidStatuses = statuses.filter(
      (status: string) => !this.validQrStatuses.includes(status as BcbQrStatus),
    );

    return {
      isValid: invalidStatuses.length === 0,
      qrId: response?.datos?.idQr,
      statuses,
      invalidStatuses,
      isPaid: statuses.includes(BcbQrStatus.PROCESADO),
      isRejected: statuses.includes(BcbQrStatus.RECHAZADO),
      isPending: statuses.length === 0 || statuses.includes(BcbQrStatus.NO_PROCESADO),
      allowedStatuses: this.validQrStatuses,
    };
  }

  private throwBcbHttpError(error: any): never {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();
      const responseMessage = this.extractBcbErrorMessage(response);

      if (
        BCB_UNAVAILABLE_HTTP_STATUSES.includes(status) ||
        this.isUnavailableBcbError(error, responseMessage)
      ) {
        this.throwUnavailableBcbException(responseMessage);
      }

      throw error;
    }

    const status = error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const responseData = error?.response?.data;
    const responseMessage = this.extractBcbErrorMessage(responseData);

    if (
      BCB_UNAVAILABLE_HTTP_STATUSES.includes(status) ||
      this.isUnavailableBcbError(error, responseMessage)
    ) {
      this.throwUnavailableBcbException(responseMessage);
    }

    if (status === HttpStatus.NOT_FOUND) {
      throw new HttpException(
        responseData || {
          finalizado: false,
          mensaje: 'BCB respondió 404: endpoint o recurso no encontrado',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    throw new HttpException(
      responseData || responseMessage || 'Error connecting to BCB service',
      status,
    );
  }

  private extractBcbErrorMessage(responseData: any): string | null {
    if (!responseData) {
      return null;
    }

    if (typeof responseData === 'string') {
      const cleaned = this.cleanBcbMessage(responseData);
      return cleaned || null;
    }

    return responseData?.mensaje ?? responseData?.message ?? responseData?.error ?? null;
  }

  private isUnavailableBcbError(error: any, message?: string | null): boolean {
    const normalizedMessage = String(message ?? error?.message ?? '').toLowerCase();

    return (
      BCB_RETRYABLE_ERROR_CODES.includes(error?.code) ||
      this.isUnavailableBcbMessage(normalizedMessage)
    );
  }

  private throwUnavailableBcbException(detail?: string | null): never {
    throw new HttpException(
      {
        finalizado: false,
        serviceStatus: false,
        mensaje: BCB_UNAVAILABLE_MESSAGE,
        detalle: detail,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private normalizeBcbErrorMessage(message: any) {
    const cleaned = this.cleanBcbMessage(message);

    if (this.isUnavailableBcbMessage(cleaned)) {
      return BCB_UNAVAILABLE_MESSAGE;
    }

    return cleaned || BCB_UNAVAILABLE_MESSAGE;
  }

  private cleanBcbMessage(message: any): string {
    const normalized = Array.isArray(message) ? message.join(', ') : String(message ?? '');

    return normalized
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isUnavailableBcbMessage(message: string): boolean {
    const normalizedMessage = message.toLowerCase();

    return BCB_UNAVAILABLE_MESSAGE_PARTS.some((part) => normalizedMessage.includes(part));
  }

  private async requestWithRetry<T>(request: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= BCB_REQUEST_RETRIES; attempt++) {
      try {
        return await request();
      } catch (error) {
        lastError = error;

        if (!this.isRetryableBcbError(error) || attempt === BCB_REQUEST_RETRIES) {
          throw error;
        }

        await this.delay(BCB_RETRY_DELAY_MS * (attempt + 1));
      }
    }

    throw lastError;
  }

  private isRetryableBcbError(error: any): boolean {
    if (error?.response) {
      return false;
    }

    return BCB_RETRYABLE_ERROR_CODES.includes(error?.code);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
