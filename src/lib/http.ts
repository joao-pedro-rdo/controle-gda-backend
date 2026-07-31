import type { FastifyReply } from "fastify";

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200
): T {
  reply.status(statusCode);
  return data;
}
