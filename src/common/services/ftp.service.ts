import { Injectable, Logger } from '@nestjs/common';
import { envsFtp } from 'src/config';
import * as ftp from 'basic-ftp';
import { Readable, Writable, PassThrough } from 'stream';
import * as fs from 'fs';
import * as servicePath from 'path';

@Injectable()
export class FtpService {
  private readonly logger = new Logger('FtpService');
  private client: ftp.Client;

  constructor() {
    this.client = new ftp.Client();
  }

  /**
   * Helper para lanzar errores preservando la causa original.
   * Satisface la regla preserve-caught-error del linter.
   */
  private wrapError(message: string, cause: unknown): never {
    const err = new Error(message);
    (err as any).cause = cause;
    throw err;
  }

  async connectToFtp() {
    try {
      await this.client.access({
        host: envsFtp.ftpHost,
        user: envsFtp.ftpUsername,
        password: envsFtp.ftpPassword,
        secure: envsFtp.ftpSsl,
        secureOptions: { rejectUnauthorized: false },
      });
      this.logger.log('Connected to FTP server successfully');
    } catch (error) {
      this.logger.error('Failed to connect to FTP server:', error);
      this.wrapError('Failed to connect to FTP server', error);
    }
  }

  async connectSwitch(value: string) {
    try {
      if (value === 'true') {
        await this.connectToFtp();
        return {
          statusConnect: true,
        };
      } else {
        await this.onDestroy();
        return {
          statusConnect: false,
        };
      }
    } catch (error) {
      this.logger.error('Failed to switch connection:', error);
      this.wrapError('Failed to switch connection', error);
    }
  }

  async uploadFile(files: any, data: any, convert?: string) {
    try {
      await this.connectToFtp();
      const docsMap = new Map<string, Buffer>();
      for (const file of files) {
        const code = file.fieldname;
        if (convert === 'true') {
          file.buffer = Buffer.from(file.buffer, 'base64');
        }
        docsMap.set(code, file.buffer);
      }
      for (const res of data) {
        const { fileId, path } = res;

        const verifyPath = `${envsFtp.ftpRoot}${servicePath.dirname(path)}`;
        const remotePath = `${envsFtp.ftpRoot}${path}`;

        const documentStream = Readable.from(docsMap.get(`file[${fileId}]`));

        await this.client.ensureDir(verifyPath);
        await this.client.uploadFrom(documentStream, remotePath);
        this.logger.log(`'Uploaded ${path} successfully'`);
      }
    } catch (error) {
      this.logger.error('Failed to upload file:', error);
      this.wrapError('Failed to upload file', error);
    } finally {
      this.onDestroy();
    }
  }

  /**
   * Sube un stream (Readable) al FTP sin bufferizar en memoria.
   *
   * Creado específicamente para el ImportService, donde el archivo
   * llega como stream desde multer (ftpStorage) o desde otro origen
   * y necesitamos pipearlo directo a FTP sin acumularlo en RAM,
   * porque el Gateway tiene poca memoria disponible.
   *
   * A diferencia de uploadFile() que recibe buffers y usa this.client,
   * este método crea su propia conexión FTP (client local) para no
   * interferir con las operaciones existentes del servicio.
   */
  async uploadStream(stream: Readable, remotePath: string): Promise<void> {
    const fullPath = `${envsFtp.ftpRoot}${remotePath}`;
    const client = new ftp.Client();
    try {
      await client.access({
        host: envsFtp.ftpHost,
        user: envsFtp.ftpUsername,
        password: envsFtp.ftpPassword,
        secure: envsFtp.ftpSsl,
        secureOptions: { rejectUnauthorized: false },
      });
      await client.ensureDir(servicePath.dirname(fullPath));
      await client.uploadFrom(stream, fullPath);
    } catch (error) {
      this.logger.error('Failed to upload stream:', error);
      this.wrapError('Failed to upload stream', error);
    } finally {
      client.close();
    }
  }

  async uploadChunk(chunk: any, name: string) {
    try {
      const tempDir = '/tmp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        this.logger.log(`Created temp dir: ${tempDir}`);
      }
      const chunkPath = servicePath.join(tempDir, `${name}`);
      await fs.writeFileSync(chunkPath, chunk.buffer);
      this.logger.log(`Saved chunk to ${chunkPath} success`);
    } catch (error) {
      this.logger.error('Failed to save chunk:', error);
      this.wrapError('Failed to save chunk', error);
    }
  }

  async concatChunks(fieldname: number, nameInitial: string, totalChunks: number) {
    try {
      const tempDir = '/tmp';
      const buffers: Buffer[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = servicePath.join(tempDir, `${nameInitial}-${i}`);
        if (!fs.existsSync(chunkPath)) {
          this.logger.error(`Chunk ${chunkPath} not found`);
          throw new Error(`Chunk ${chunkPath} not found`);
        }
        buffers.push(fs.readFileSync(chunkPath));
        fs.unlinkSync(chunkPath);
      }
      const fileBuffer = Buffer.concat(buffers);

      const fileObject = {
        fieldname: `file[${fieldname}]`,
        originalname: `${nameInitial}.pdf`,
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: fileBuffer,
        size: fileBuffer.length,
      };

      this.logger.log(`Concatenated chunks to successfully`);
      return [fileObject];
    } catch (error) {
      this.logger.error('Failed to concat and upload chunks:', error);
      this.wrapError('Failed to concat and upload chunks', error);
    }
  }

  async downloadFile(data: any, convert?: string) {
    try {
      await this.connectToFtp();
      const finalData = [];

      for (const res of data) {
        const { path } = res;
        const remoteFilePath = `${envsFtp.ftpRoot}${path}`;
        const chunks: Buffer[] = [];
        const writableStream = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
          },
        });
        await this.client.downloadTo(writableStream, remoteFilePath);
        this.logger.log(`'Downloaded: ${path} successfully`);
        const file = Buffer.concat(chunks);
        finalData.push({
          ...res,
          ...(convert === 'true' ? { wsqBase64: file.toString('base64') } : { pdfBuffer: file }),
        });
      }
      return finalData;
    } catch (error) {
      this.logger.error('Failed to download file:', error);
      this.wrapError('Failed to download file:', error);
    } finally {
      this.onDestroy();
    }
  }

  /**
   * Descarga un archivo completo del FTP y lo devuelve como Buffer.
   *
   * Creado para el ImportService cuando necesita procesar archivos
   * .xls (formato binario antiguo) con SheetJS, que requiere el
   * archivo completo en RAM sí o sí. Solo se usa para archivos
   * pequeños (<500KB) para no exceder el límite de memoria.
   *
   * A diferencia de downloadFile() que usa this.client y devuelve
   * un formato específico (pdfBuffer/wsqBase64), este método es
   * genérico: solo da el Buffer crudo. Crea su propia conexión
   * FTP para no interferir con operaciones concurrentes.
   */
  async downloadBuffer(remotePath: string): Promise<Buffer> {
    const fullPath = `${envsFtp.ftpRoot}${remotePath}`;
    const client = new ftp.Client();
    try {
      await client.access({
        host: envsFtp.ftpHost,
        user: envsFtp.ftpUsername,
        password: envsFtp.ftpPassword,
        secure: envsFtp.ftpSsl,
        secureOptions: { rejectUnauthorized: false },
      });
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk: Buffer | string, _encoding: string, callback: (error?: Error | null) => void) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      await client.downloadTo(writable, fullPath);
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error('Failed to download buffer:', error);
      this.wrapError('Failed to download buffer', error);
    } finally {
      client.close();
    }
  }

  /**
   * Devuelve un PassThrough(puente) conectado al archivo en FTP para leerlo
   * en streaming, sin descargar todo a memoria.
   *
   * Creado para el ImportService, que necesita leer archivos grandes
   * (CSV, .xlsx) desde FTP y pipearlos directamente a un parser
   * (csv-parser, exceljs) sin bufferizar el contenido completo.
   *
   * Cómo funciona:
   * 1. Crea un PassThrough (stream readable+writable)
   * 2. Inicia la descarga FTP en segundo plano (.then chain)
   * 3. Devuelve el PassThrough inmediatamente
   * 4. El consumidor (ej: csv-parser) se conecta al PassThrough
   *    y recibe los datos a medida que llegan del FTP
   * 5. Cuando la descarga termina, se cierra el stream y la conexión
   *
   * La conexión FTP se cierra automáticamente al terminar (o fallar)
   * la descarga. El consumidor solo ve un Readable estándar.
   *
   * Uso típico:
   *   const stream = await ftpService.downloadToPassThrough(ruta);
   *   stream.pipe(csvParser).on('data', ...);
   */
  async downloadToPassThrough(remotePath: string): Promise<PassThrough> {
    const fullPath = `${envsFtp.ftpRoot}${remotePath}`;
    const client = new ftp.Client();
    const passThrough = new PassThrough();

    client
      .access({
        host: envsFtp.ftpHost,
        user: envsFtp.ftpUsername,
        password: envsFtp.ftpPassword,
        secure: envsFtp.ftpSsl,
        secureOptions: { rejectUnauthorized: false },
      })
      .then(() => client.downloadTo(passThrough, fullPath))
      .then(() => passThrough.end())
      .catch((err) => {
        passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => client.close());

    return passThrough;
  }

  async removeFile(data: string[]) {
    try {
      await this.connectToFtp();
      for (const path of data) {
        const remoteFilePath = `${envsFtp.ftpRoot}${path}`;
        try {
          await this.client.remove(remoteFilePath);
          this.logger.log(`Removed: ${path}`);
        } catch {
          this.logger.warn(`Not found: ${path}`);
        }
      }
      return {
        statusRemoved: true,
        message: 'File remove successfully',
      };
    } catch (error) {
      this.logger.error('Failed to remove file:', error);
      this.wrapError('Failed to remove file', error);
    } finally {
      this.onDestroy();
    }
  }

  async listFiles(path: string, key?: boolean) {
    try {
      const remotePath = key ? `${path}` : `${envsFtp.ftpRoot}${path}`;
      const files = await this.client.list(remotePath);
      this.logger.log(`Listed files in ${remotePath} success`);
      return files;
    } catch (error) {
      this.logger.error('Failed to list files:', error);
      this.wrapError('Failed to list files', error);
    }
  }

  async renameFile(remoteFilePath: string, destinationFilePath: string) {
    try {
      const destinationDir = `${envsFtp.ftpRoot}${destinationFilePath.substring(0, destinationFilePath.lastIndexOf('/'))}`;

      await this.client.ensureDir(destinationDir);
      await this.client.rename(
        `${envsFtp.ftpRoot}${remoteFilePath}`,
        `${envsFtp.ftpRoot}${destinationFilePath}`,
      );
      this.logger.log(`File moved successfully ${destinationFilePath}`);
      return {
        statusMoved: true,
        message: 'File moved successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to move file from ${envsFtp.ftpRoot}${remoteFilePath} to ${envsFtp.ftpRoot}${destinationFilePath}`,
        error,
      );
      this.wrapError(`Failed to move file`, error);
    }
  }

  async saveDataTmp(path: string, name: string, data: Record<string, any>, ttlMs = 120000) {
    try {
      const tempDir = '/tmp/' + path;
      const filePath = servicePath.join(tempDir, name);

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');

      this.logger.log(`Data saved to ${filePath} successfully`);
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Data removed from ${filePath} successfully`);
        }
      }, ttlMs);
      return { statusSaved: true, message: 'Data saved successfully' };
    } catch (error) {
      this.logger.error('Failed to save data:', error);
      this.wrapError('Failed to save data', error);
    }
  }

  async getDataTmp(path: string, name: string) {
    try {
      const tempDir = '/tmp/' + path;
      const filePath = servicePath.join(tempDir, name);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const raw = fs.readFileSync(filePath, 'utf8');

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async onDestroy() {
    await this.client.close();
    this.logger.log('FTP connection closed');
  }
}
