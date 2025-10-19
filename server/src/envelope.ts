import type { FastifyReply } from 'fastify';
import type { Envelope } from './types';

export function success<T>(reply: FastifyReply, data: T, message = 'OK') {
  const payload: Envelope<T> = { code: 0, message, data };
  reply.send(payload);
}

export function failure(reply: FastifyReply, status: number, code: number, message: string) {
  reply.code(status);
  const payload: Envelope<null> = { code, message, data: null };
  reply.send(payload);
}
