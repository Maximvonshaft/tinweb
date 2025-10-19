import type { Response } from 'express';

export interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

export const sendSuccess = <T>(res: Response, data: T, message = 'ok', code = 0) => {
  const payload: Envelope<T> = { code, message, data };
  return res.json(payload);
};

export const sendError = (res: Response, status: number, code: number, message: string) => {
  const payload: Envelope<null> = { code, message, data: null };
  return res.status(status).json(payload);
};
