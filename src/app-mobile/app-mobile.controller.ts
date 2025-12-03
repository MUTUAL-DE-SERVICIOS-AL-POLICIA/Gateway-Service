import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthAppMobileGuard, Public } from 'src/auth/guards';
import { NatsService } from 'src/common';
import { Records } from 'src/records/records.interceptor';

@ApiTags('appMobile')
@UseGuards(AuthAppMobileGuard)
@UseInterceptors(Records)
@Controller('appMobile')
export class AppMobileController {
  constructor(private readonly nats: NatsService) {}

  @Public()
  @Get('globalCities')
  @ApiResponse({ status: 200, description: 'Obtener todas las ciudades' })
  async globalCities() {
    return await this.nats.firstValue('appMobile.global.cities', {});
  }

  @Post('version')
  @ApiResponse({ status: 200, description: 'Obtener version' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        store: { type: 'string', example: 'playstore' },
        version: { type: 'string', example: '4.0.1' },
      },
    },
  })
  @Public()
  async version(@Body() body: any) {
    return await this.nats.firstValue('appMobile.version', body);
  }

  @Get('loanInformation/:affiliateId')
  @ApiResponse({ status: 200, description: 'Obtener todos los préstamos' })
  async informationLoan(
    @Headers('authorization') authorization: string,
    @Param('affiliateId') affiliateId: string,
  ) {
    return await this.nats.firstValue('appMobile.loans.informationLoan', {
      authorization,
      affiliateId,
    });
  }

  @Get('loanPrintPlan/:loanId')
  @ApiResponse({ status: 200, description: 'Imprimir plan de préstamo' })
  async loanPrintPlan(
    @Headers('authorization') authorization: string,
    @Param('loanId') loanId: string,
    @Res() res: Response,
  ) {
    const response = await this.nats.firstValue('appMobile.loans.loanPrintPlan', {
      authorization,
      loanId,
    });

    if (!response.serviceStatus) {
      return response;
    }

    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${response.name}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }

  @Get('loanPrintKardex/:loanId')
  @ApiResponse({ status: 200, description: 'Imprimir kardex de préstamo' })
  async loanPrintKardex(
    @Headers('authorization') authorization: string,
    @Param('loanId') loanId: string,
    @Res() res: Response,
  ) {
    const response = await this.nats.firstValue('appMobile.loans.loanPrintKardex', {
      authorization,
      loanId,
    });

    if (!response.serviceStatus) {
      return response;
    }

    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${response.name}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }

  @Get('contributionsAll/:affiliateId')
  @ApiResponse({ status: 200, description: 'Obtener todas las contribuciones' })
  async allContributions(
    @Headers('authorization') authorization: string,
    @Param('affiliateId') affiliateId: string,
  ) {
    return await this.nats.firstValue('appMobile.contributions.allContributions', {
      authorization,
      affiliateId,
    });
  }

  @Get('contributionsPassive/:affiliateId')
  @ApiResponse({ status: 200, description: 'Obtener contribuciones pasivas' })
  async contributionsPassive(
    @Headers('authorization') authorization: string,
    @Param('affiliateId') affiliateId: string,
    @Res() res: Response,
  ) {
    const response = await this.nats.firstValue('appMobile.contributions.contributionsPassive', {
      authorization,
      affiliateId,
    });

    if (!response.serviceStatus) {
      return response;
    }

    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${response.name}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }

  @Get('contributionsActive/:affiliateId')
  @ApiResponse({ status: 200, description: 'Obtener contribuciones activas' })
  async contributionsActive(
    @Headers('authorization') authorization: string,
    @Param('affiliateId') affiliateId: string,
    @Res() res: Response,
  ) {
    const response = await this.nats.firstValue('appMobile.contributions.contributionsActive', {
      authorization,
      affiliateId,
    });

    if (!response.serviceStatus) {
      return response;
    }

    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${response.name}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }

  @Get('message/:type')
  @ApiResponse({ status: 200, description: 'Obtener mensaje' })
  @ApiParam({ name: 'type', type: 'string', example: 'before_liveness | verified' })
  async typeVerify(@Param('type') type: string, @Req() req: any) {
    const { tokenId } = req.user;
    return await this.nats.firstValue('appMobile.typeVerify', { type, tokenId });
  }

  @Get('ecoComAffiliateObservations/:affiliateId')
  @ApiResponse({ status: 200, description: 'Obtener observaciones del afiliado de complemento' })
  async ecoComAffiliateObservations(@Param('affiliateId') affiliateId: string) {
    return await this.nats.firstValue('appMobile.ecoComAffiliateObservations', { affiliateId });
  }

  @Get('ecoComLiveness')
  @ApiResponse({ status: 200, description: 'Obtener liveness del afiliado de complemento' })
  async ecoComLiveness(@Headers('authorization') authorization: string, @Req() req: any) {
    return await this.nats.firstValue('appMobile.ecoComLiveness', { authorization });
  }

  @Get('ecoComLivenessShow/:affiliateId')
  @ApiResponse({ status: 200, description: 'Mostrar liveness del afiliado de complemento' })
  async ecoComLivenessShow(@Headers('authorization') authorization: string, @Req() req: any) {
    const { affiliateId } = req.user;
    return await this.nats.firstValue('appMobile.ecoComLivenessShow', {
      authorization,
      affiliateId,
    });
  }

  @Post('ecoComLivenessStore')
  @ApiResponse({ status: 200, description: 'Guardar vivencia del afiliado de complemento' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', example: '82afc73734e3e1d7' },
        firebase_token: { type: 'string', example: 'cw6Kl5XS...' },
        image: { type: 'base64', example: 'data:image/png;base64,...' },
      },
    },
  })
  async ecoComLivenessStore(@Headers('authorization') authorization: string, @Body() data: any) {
    return await this.nats.firstValue('appMobile.ecoComLivenessStore', { authorization, data });
  }

  @Get('ecoComEconomicComplements')
  @ApiQuery({
    name: 'page',
    type: Number,
    required: true,
    description: 'Número de página',
  })
  @ApiQuery({
    name: 'current',
    type: Boolean,
    required: true,
    description: 'Si es true, obtiene solo los vigentes',
  })
  @ApiResponse({ status: 200, description: 'Obtener complemento económico' })
  async ecoComEconomicComplements(
    @Headers('authorization') authorization: string,
    @Query('page') page: number,
    @Query('current') current: boolean,
  ) {
    return await this.nats.firstValue('appMobile.ecoComEconomicComplements', {
      authorization,
      page,
      current,
    });
  }

  @Get('ecoComEconomicComplementsShow/:economicComplementId')
  @ApiResponse({ status: 200, description: 'Obtener complemento económico' })
  async ecoComEconomicComplementsShow(
    @Headers('authorization') authorization: string,
    @Param('economicComplementId') economicComplementId: string,
  ) {
    return await this.nats.firstValue('appMobile.ecoComEconomicComplementsShow', {
      authorization,
      economicComplementId,
    });
  }

  @Post('ecoComEconomicComplementsStore')
  @ApiResponse({ status: 200, description: 'Guardar complemento económico' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        eco_com_procedure_id: { type: 'string', example: '28' },
        cell_phone_number: { type: 'string', example: '(719)-31166' },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', example: 'ci_anverso' },
              content: { type: 'string', example: '/9j/4AAQSkZJRgABAQAAAQABAAD...' },
            },
          },
          example: [
            {
              filename: 'ci_anverso',
              content: '/9j/4AAQSkZJRgABAQAAAQABAAD...',
            },
            {
              filename: 'ci_reverso.jpg',
              content: '/9j/4AAQSkZJRgABAQAAAQABAAD...',
            },
          ],
        },
      },
    },
  })
  async ecoComEconomicComplementsStore(
    @Headers('authorization') authorization: string,
    @Body() data: any,
    @Res() res: Response,
  ) {
    const response = await this.nats.firstValue('appMobile.ecoComEconomicComplementsStore', {
      authorization,
      data,
    });
    if (!response.serviceStatus) {
      return response;
    }

    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${response.name}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }
  e;
  @Get('ecoComEconomicComplementsPrint/:economicComplementId')
  @ApiResponse({ status: 200, description: 'Imprimir complemento económico' })
  async ecoComEconomicComplementsPrint(
    @Headers('authorization') authorization: string,
    @Param('economicComplementId') economicComplementId: string,
    @Res() res: Response,
  ) {
    const response = await this.nats.firstValue('appMobile.ecoComEconomicComplementsPrint', {
      authorization,
      economicComplementId,
    });

    if (!response.serviceStatus) {
      return response;
    }

    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${response.name}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  }

  @Get('ecoComProcedure/:ecoComProcedureId')
  @ApiResponse({ status: 200, description: 'Obtener modalidad de complemento del afiliado' })
  async ecoComProcedure(
    @Headers('authorization') authorization: string,
    @Param('ecoComProcedureId') ecoComProcedureId: string,
  ) {
    return await this.nats.firstValue('appMobile.ecoComProcedure', {
      authorization,
      ecoComProcedureId,
    });
  }

  @Post('ecoComSaveIdentity')
  @ApiResponse({ status: 200, description: 'Guardar identidad del afiliado de complemento' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', example: 'ci_anverso' },
              content: { type: 'string', example: '/9j/4AAQSkZJRgABAQAAAQABAAD...' },
            },
          },
        },
      },
    },
  })
  async ecoComSaveIdentity(
    @Headers('authorization') authorization: string,
    @Body() data: any,
    @Req() req: any,
  ) {
    return await this.nats.firstValue('pvtBe.ecoComSaveIdentity', { authorization, data });
  }
}
