jest.mock('src/config', () => ({
  envsFtp: {
    ftpHost: 'ftp.test',
    ftpUsername: 'test',
    ftpPassword: 'test',
    ftpSsl: false,
    ftpRoot: '/test',
  },
}));

import { FtpService } from './ftp.service';

describe('FtpService connection status', () => {
  it('preserves the successful connection response', async () => {
    const service = new FtpService();
    jest.spyOn(service, 'connectToFtp').mockResolvedValue(true);

    await expect(service.connectSwitch('true')).resolves.toEqual({ statusConnect: true });
  });

  it('converts an access failure into a negative connection result', async () => {
    const service = new FtpService();
    jest.spyOn((service as any).client, 'access').mockRejectedValue(new Error('unavailable'));
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

    await expect(service.connectToFtp()).resolves.toBe(false);
  });

  it('does not report a failed connection as successful', async () => {
    const service = new FtpService();
    jest.spyOn(service, 'connectToFtp').mockResolvedValue(false);

    await expect(service.connectSwitch('true')).resolves.toEqual({ statusConnect: false });
  });
});
