import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PvtEnvs } from 'src/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller('pvtSti')
export class PvtStiController {
  constructor(private readonly httpService: HttpService) {}

  @MessagePattern('pvtSti.informationLoan')
  async informationLoan(body: { authorization: string; affiliateId: string }) {
    const { authorization, affiliateId } = body;
    const url = `${PvtEnvs.PvtBackendApiServer}/app/get_information_loan/${affiliateId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtSti.loanPrintPlan')
  async loanPrintPlan(body: { authorization: string; loanId: string }) {
    const { authorization, loanId } = body;
    const url = `${PvtEnvs.PvtBackendApiServer}/app/loan/${loanId}/print/plan_v2`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtSti.loanPrintKardex')
  async loanPrintKardex(body: { authorization: string; loanId: string }) {
    const { authorization, loanId } = body;
    const url = `${PvtEnvs.PvtBackendApiServer}/app/loan/${loanId}/print/kardex_v2`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtSti.allContributions')
  async allContributions(body: { authorization: string; affiliateId: string }) {
    const { authorization, affiliateId } = body;
    const url = `${PvtEnvs.PvtBackendApiServer}/app/all_contributions/${affiliateId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtSti.contributionsPassive')
  async contributionsPassive(body: { authorization: string; affiliateId: string }) {
    const { authorization, affiliateId } = body;
    const url = `${PvtEnvs.PvtBackendApiServer}/app/contributions_passive_v2/${affiliateId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }

  @MessagePattern('pvtSti.contributionsActive')
  async contributionsActive(body: { authorization: string; affiliateId: string }) {
    const { authorization, affiliateId } = body;
    const url = `${PvtEnvs.PvtBackendApiServer}/app/contributions_active_v2/${affiliateId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: { authorization } }),
    );
    return data;
  }
}
