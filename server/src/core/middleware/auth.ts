import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { createUnauthorizedError } from '../errors.js';
import type { RequestUser } from '../types.js';

interface AccessTokenPayload {
  sub: number;
  tenantId: string;
  username: string;
  role: 'ADMIN' | 'USER';
  exp: number;
}

const pickFirstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
  }
  return undefined;
};

export const extractAccessToken = (req: Request): string => {
  const header = req.header('authorization');
  if (header) {
    const [type, token] = header.split(' ');
    if (type?.toLowerCase() !== 'bearer' || !token) {
      throw createUnauthorizedError('认证头格式错误');
    }
    return token;
  }

  const fromQuery = pickFirstQueryValue(req.query?.access_token);
  if (fromQuery) {
    return fromQuery;
  }

  throw createUnauthorizedError('缺少认证信息');
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractAccessToken(req);
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    const user: RequestUser = {
      id: payload.sub,
      tenantId: payload.tenantId,
      username: payload.username,
      role: payload.role
    };
    req.currentUser = user;
    next();
  } catch {
    next(createUnauthorizedError('访问令牌无效'));
  }
};
