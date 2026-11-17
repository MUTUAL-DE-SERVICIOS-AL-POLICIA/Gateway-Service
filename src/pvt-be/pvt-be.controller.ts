import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PvtEnvs } from 'src/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller('pvtBe')
export class PvtBeController {
  constructor(private readonly httpService: HttpService) {}

  @MessagePattern('pvtBe.validateBeneficiaryEcoCom')
  async validateBeneficiaryEcoCom(body: { identityCard: string }) {
    const { data } = await firstValueFrom(
      this.httpService.get(
        `${PvtEnvs.PvtBeApiServer}/validate_beneficiary_eco_com/${body.identityCard}`,
      ),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComAffiliateObservations')
  async validateBeneficiary(body: { affiliateId: string }) {
    const { data } = await firstValueFrom(
      this.httpService.get(`${PvtEnvs.PvtBeApiServer}/affiliate/${body.affiliateId}/observation`),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComLiveness')
  async ecoComLiveness(body: { authorization: string }) {
    const { authorization } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/liveness`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComLivenessShow')
  async ecoComLivenessShow(body: { authorization: string; affiliateId: string }) {
    const { authorization, affiliateId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/liveness/${affiliateId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComLivenessStore')
  async ecoComLivenessStore(body: { authorization: string; data: any }) {
    const { authorization } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/liveness`;
    const { data } = await firstValueFrom(
      this.httpService.post(url, body.data, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComEconomicComplements')
  async ecoComeEconomicComplements(body: {
    authorization: string;
    page: number;
    current: boolean;
  }) {
    const { authorization, page, current } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/economic_complement?page=${page}&current=${current}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComEconomicComplementsShow')
  async ecoComeEconomicComplementsShow(body: {
    authorization: string;
    economicComplementId: string;
  }) {
    const { authorization, economicComplementId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/economic_complement/${economicComplementId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComEconomicComplementsStore')
  async ecoComeEconomicComplementsStore(body: { authorization: string; data: any }) {
    const { authorization, data: dataBody } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/economic_complement_store_v2`;
    const { data } = await firstValueFrom(
      this.httpService.post(url, dataBody, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComEconomicComplementsPrint')
  async ecoComeEconomicComplementsPrint(body: {
    authorization: string;
    economicComplementId: string;
  }) {
    const { authorization, economicComplementId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/economic_complement/print_v2/${economicComplementId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComProcedure')
  async ecoComProcedure(body: { authorization: string; ecoComProcedureId: string }) {
    const { authorization, ecoComProcedureId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/eco_com_procedure/${ecoComProcedureId}`;

    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.ecoComSaveIdentity')
  async ecoComSaveIdentity(body: { authorization: string; data: any }) {
    const { authorization, data: dataBody } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/ecoComSaveIdentity`;
    const { data } = await firstValueFrom(
      this.httpService.post(url, dataBody, { headers: { authorization } }),
    );
    return data;
  }

  // --- App móvil: fondo de retiro y cuota/auxilio mortuorio ---
  // Proxy directo al API de PVT-BE. El afiliado sale del token (middleware api_auth).
  // Las respuestas son { error, message, data }; en las impresiones `data.content` viaja en base64.
  @MessagePattern('pvtBe.retFunRetirementFunds')
  async retFunRetirementFunds(body: { authorization: string }) {
    const { authorization } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/ret_fun`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.retFunLiquidationPrint')
  async retFunLiquidationPrint(body: {
    authorization: string;
    retirementFundId: string;
  }) {
    const { authorization, retirementFundId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/ret_fun/${retirementFundId}/print/liquidation`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.quotaAidMortuaries')
  async quotaAidMortuaries(body: { authorization: string }) {
    const { authorization } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/quota_aid`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtBe.quotaAidLiquidationPrint')
  async quotaAidLiquidationPrint(body: {
    authorization: string;
    quotaAidId: string;
  }) {
    const { authorization, quotaAidId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/quota_aid/${quotaAidId}/print/liquidation`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  // --- Kiosko: el afiliado se resuelve por `ci` (no hay token de afiliado) ---
  // Mismo formato que la app móvil: listas { error, message, data } e impresión con `data.content` en base64.
  // Si el API de PVT-BE falla, se normaliza con buildError para que el Kiosk-Service lo propague.
  @MessagePattern('pvtBe.kioskRetFunRetirementFunds')
  async kioskRetFunRetirementFunds(body: { authorization: string; ci: string }) {
    const { authorization, ci } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/ret_fun?ci=${encodeURIComponent(ci)}`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error: any) {
      return this.buildError(error, 'Error al obtener fondo de retiro');
    }
  }

  @MessagePattern('pvtBe.kioskQuotaAidMortuaries')
  async kioskQuotaAidMortuaries(body: { authorization: string; ci: string }) {
    const { authorization, ci } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/quota_aid?ci=${encodeURIComponent(ci)}`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error: any) {
      return this.buildError(
        error,
        'Error al obtener cuota y auxilio mortuorio',
      );
    }
  }

  @MessagePattern('pvtBe.kioskRetFunLiquidationPrint')
  async kioskRetFunLiquidationPrint(body: {
    authorization: string;
    retirementFundId: string;
  }) {
    const { authorization, retirementFundId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/ret_fun/${retirementFundId}/print/liquidation`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error: any) {
      return this.buildError(error, 'Error al obtener la liquidación');
    }
  }

  @MessagePattern('pvtBe.kioskQuotaAidLiquidationPrint')
  async kioskQuotaAidLiquidationPrint(body: {
    authorization: string;
    quotaAidId: string;
  }) {
    const { authorization, quotaAidId } = body;
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/quota_aid/${quotaAidId}/print/liquidation`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error: any) {
      return this.buildError(error, 'Error al obtener la liquidación');
    }
  }

  private buildError(error: any, fallbackMessage: string) {
    return {
      error: true,
      message: error?.response?.data?.message ?? fallbackMessage,
      statusCode: error?.response?.status ?? 500,
    };
  }
}
