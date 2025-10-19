import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { sendError } from '../envelope.js';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (err instanceof AppError) {
    logger.warn({ err }, '业务异常');
    return sendError(res, err.status, mapStatusToCode(err.status), err.message);
  }

  logger.error({ err }, '未知异常');
  return sendError(res, 500, 500, err instanceof Error ? err.message : 'Internal Server Error');
};

const mapStatusToCode = (status: number) => {
  if (status >= 400 && status < 500) {
    return status;
  }
  return 500;
};
