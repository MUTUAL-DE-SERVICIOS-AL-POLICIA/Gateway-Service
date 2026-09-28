import { IsUUID } from 'class-validator';

export class AnalyzeDocumentsDto {}

export class ImportDocumentsDto {
  @IsUUID()
  importId: string;
}
