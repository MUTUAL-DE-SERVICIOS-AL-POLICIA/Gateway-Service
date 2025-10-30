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
}
