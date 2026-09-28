import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

import { NatsService, ImportCsvService } from 'src/common';
import { WebController, WebSessionOnly } from 'src/auth/decorators/web-authorization.decorators';

@ApiTags('collections')
@WebController('collections', 'bank_statements')
@Controller('collections/bankStatements')
export class BankStatementsController {
  constructor(
    private readonly nats: NatsService,
    private readonly importCsv: ImportCsvService,
  ) {}

  @Get('findAll')
  @WebSessionOnly()
  @ApiResponse({
    status: 200,
    description: 'Obtener todas las transacciones',
  })
  async findAll() {
    return this.nats.send('collections.findAllBankStatements', {});
  }

  @Post('import')
  @WebSessionOnly()
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: 200,
    description: 'Importar declaraciones bancarias',
  })
  async importBankStatements(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    const requiredColumns = [
      'date',
      'operationCode',
      'documentNumber',
      'gloss',
      'transferredAccount',
      'credits',
      'state',
    ];
    const { error, message, data } = await this.importCsv.importCsv(file, requiredColumns);

    if (error) {
      return {
        error: error,
        message,
      };
    }

    return await this.nats.firstValue('collections.importBankStatements', { data });
  }
}
