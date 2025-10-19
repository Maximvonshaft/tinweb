import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Envelope } from './types';

export function success<T>(request: FastifyRequest, reply: FastifyReply, data: T, message = 'OK') {
  const payload: Envelope<T> = { code: 0, message, data, requestId: String(request.id) };
  reply.send(payload);
}

export function failure(request: FastifyRequest, reply: FastifyReply, status: number, code: number, message: string) {
  reply.code(status);
  const payload: Envelope<null> = { code, message, data: null, requestId: String(request.id) };
  reply.send(payload);
}
