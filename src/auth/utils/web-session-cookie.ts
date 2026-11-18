import { HttpException } from '@nestjs/common';
import { publicWebAuthError } from '../errors/web-auth.errors';

const SID_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export function sidFromCookie(cookieHeader: string | undefined): string {
  const values = (cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('sid='))
    .map((part) => part.slice(4));
  if (values.length !== 1 || !SID_PATTERN.test(values[0])) {
    const error = publicWebAuthError('SESSION_INVALID');
    throw new HttpException(error.body, error.status);
  }
  return values[0];
}
