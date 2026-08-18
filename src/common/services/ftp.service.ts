import { Injectable, Logger } from '@nestjs/common';
import { envsFtp } from 'src/config';
import * as ftp from 'basic-ftp';
import { Readable, Transform, PassThrough, Writable } from 'stream';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as servicePath from 'path';

@Injectable()
export class FtpService {
  private readonly logger = new Logger('FtpService');
  private client: ftp.Client;

  constructor() {
    this.client = new ftp.Client();
  }

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
        return { statusConnect: true };
      } else {
        await this.onDestroy();
        return { statusConnect: false };
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
      return { statusRemoved: true, message: 'File remove successfully' };
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
      return { statusMoved: true, message: 'File moved successfully' };
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

  async removeDataTmp(path: string, name: string) {
    try {
      const tempDir = '/tmp/' + path;
      const filePath = servicePath.join(tempDir, name);

      if (!fs.existsSync(filePath)) {
        return { statusRemoved: true, message: 'Data tmp not found' };
      }

      fs.unlinkSync(filePath);
      this.logger.log(`Data removed from ${filePath} successfully`);

      return { statusRemoved: true, message: 'Data tmp removed successfully' };
    } catch (error) {
      this.logger.error('Failed to remove temp data:', error);
    }
  }

  async onDestroy() {
    await this.client.close();
    this.logger.log('FTP connection closed');
  }
}

/**
 * Multer storage engine para subir archivos a FTP.
 * Calcula SHA256 hash y sube a FTP usando PassThrough (sin /tmp/).
 */
const ftpStorageLogger = new Logger('FtpStorage');

export function ftpStorage(ftpService: FtpService, target: string) {
  return {
    async _handleFile(
      req: any,
      file: { fieldname: string; originalname: string; encoding: string; mimetype: string; stream: Readable },
      cb: (error?: any, info?: any) => void,
    ) {
      const dateStr = new Date().toISOString().split('T')[0];
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ftpPath = `/imports/${target}/${dateStr}/${timestamp}_${safeName}`;

      let fileSize = 0;
      const hash = createHash('sha256');

      // Validar que el stream no esté consumido
      if (file.stream.destroyed) {
        cb(new Error('Stream ya fue consumido'));
        return;
      }

      // Crear PassThrough para duplicar el stream
      const tee = new PassThrough();
      const chunks: Buffer[] = [];
      const hashCounter = new Transform({
        transform(chunk: Buffer, _encoding: string, callback: (error?: any, data?: any) => void) {
          fileSize += chunk.length;
          hash.update(chunk);
          callback(null, chunk);
        },
      });

      // Manejar errores del hashCounter
      hashCounter.on('error', (err) => {
        tee.destroy();
        cb(err);
      });

      // Recopilar chunks del tee
      tee.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      // Cuando termine el stream, subir a FTP
      tee.on('end', async () => {
        try {
          const fileBuffer = Buffer.concat(chunks);
          const { Readable } = await import('stream');
          const ftpStream = Readable.from(fileBuffer);
          await ftpService.uploadStream(ftpStream, ftpPath);
          ftpStorageLogger.log(`FTP upload successful: ${ftpPath}`);

          const fileHash = hash.digest('hex');
          cb(null, {
            ftpPath,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: fileSize,
            fileHash,
          });
        } catch (ftpErr) {
          cb(ftpErr);
        }
      });

      // Manejar errores del tee
      tee.on('error', (err) => {
        cb(err);
      });

      // Conectar streams
      file.stream.pipe(hashCounter);
      file.stream.pipe(tee);

      // Manejar errores del tee
      tee.on('error', (err) => {
        cb(err);
      });
    },

    _removeFile(req: any, file: any, cb: (error?: any) => void) {
      if (file.ftpPath) {
        ftpService
          .removeFile([file.ftpPath])
          .then(() => cb(null))
          .catch((err: Error) => cb(err));
      } else {
        cb(null);
      }
    },
  };
}
