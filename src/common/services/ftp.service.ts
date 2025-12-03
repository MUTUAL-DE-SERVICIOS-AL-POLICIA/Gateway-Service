import { Injectable, Logger } from '@nestjs/common';
import { envsFtp } from 'src/config';
import * as ftp from 'basic-ftp';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import * as servicePath from 'path';

@Injectable()
export class FtpService {
  private readonly logger = new Logger('FtpService');
  private client: ftp.Client;

  constructor() {
    this.client = new ftp.Client();
  }

  async connectToFtp() {
    try {
      await this.client.access({
        host: envsFtp.ftpHost,
        user: envsFtp.ftpUsername,
        password: envsFtp.ftpPassword,
        secure: envsFtp.ftpSsl,
      });
      this.logger.log('Connected to FTP server successfully');
    } catch (error) {
      this.logger.error('Failed to connect to FTP server:', error);
      throw new Error('Failed to connect to FTP server');
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
      throw new Error('Failed to switch connection');
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
      throw new Error('Failed to upload file');
    } finally {
      this.onDestroy();
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
      throw new Error('Failed to save chunk');
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
      throw new Error('Failed to concat and upload chunks');
    } finally {
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
      throw new Error('Failed to download file:');
    } finally {
      this.onDestroy();
    }
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
      throw new Error('Failed to remove file');
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
      throw new Error('Failed to list files');
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
      throw new Error(`Failed to move file`);
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
      throw new Error('Failed to save data');
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
    } catch (error) {
      return null;
    }
  }

  async onDestroy() {
    await this.client.close();
    this.logger.log('FTP connection closed');
  }
}
