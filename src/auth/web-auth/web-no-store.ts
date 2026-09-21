import { Response } from 'express';

export function setWebNoStoreHeaders(response: Response): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
}
