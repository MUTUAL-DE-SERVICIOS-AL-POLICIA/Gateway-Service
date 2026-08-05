import { Readable, Transform } from 'stream';
import { createHash } from 'crypto';
import { FtpService } from '../services/ftp.service';

export function ftpStorage(ftpService: FtpService, target: string) {
  return {
    _handleFile(
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

      const counter = new Transform({
        transform(chunk: Buffer, _encoding: string, callback: (error?: any, data?: any) => void) {
          fileSize += chunk.length;
          hash.update(chunk);
          callback(null, chunk);
        },
      });

      file.stream.pipe(counter);

      // Manejar errores en el stream de entrada (cliente desconectado, etc.)
      file.stream.on('error', (err) => {
        counter.destroy(err);
        cb(err);
      });

      counter.on('error', (err) => {
        file.stream.unpipe(counter);
        cb(err);
      });

      ftpService
        .uploadStream(counter, ftpPath)
        .then(() => {
          cb(null, {
            ftpPath,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: fileSize,
            fileHash: hash.digest('hex'),
          });
        })
        .catch((err: Error) => {
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
