import { ReportContentType } from './report-format.type';

export interface ReportFileResult {
  buffer: Buffer;
  fileName: string;
  contentType: ReportContentType;
  disposition: 'inline' | 'attachment';
}
