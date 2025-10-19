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

const parseToken = (header?: string): string => {
  if (!header) {
    throw createUnauthorizedError('缺少认证信息');
  }
  const [type, token] = header.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) {
    throw createUnauthorizedError('认证头格式错误');
  }
  return token;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = parseToken(req.header('authorization'));
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
