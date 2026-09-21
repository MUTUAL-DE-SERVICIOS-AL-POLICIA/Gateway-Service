import {
  Controller,
  UseGuards,
  Get,
  Post,
  Body,
  UploadedFile,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { NatsService, ImportCsvService } from 'src/common';
import { AuthGuard } from 'src/auth/guards';

@ApiTags('collections')
@ApiBearerAuth('msp')
@UseGuards(AuthGuard)
@Controller('collections/bankStatements')
export class BankStatementsController {
  constructor(
    private readonly nats: NatsService,
    private readonly importCsv: ImportCsvService,
  ) {}

  @Get('findAll')
  @ApiResponse({
    status: 200,
    description: 'Obtener todas las transacciones',
  })
  async findAll() {
    return this.nats.send('collections.findAllBankStatements', {});
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: 200,
    description: 'Importar declaraciones bancarias',
  })
  async importBankStatements(@UploadedFile() file: Express.Multer.File, @Body() body: any) {

    const requiredColumns = ['date', 'operationCode', 'documentNumber', 'gloss', 'transferredAccount', 'credits', 'state'];
    const { error, message, data } = await this.importCsv.importCsv(file, requiredColumns);
    
    if (error) {
      return {
        error: error,
        message,
      }
    }

    return await this.nats.firstValue('collections.importBankStatements', { data });

  }

}






