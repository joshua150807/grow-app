import type { FastifyReply, FastifyRequest } from 'fastify';

export async function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} was not found.`,
      requestId: String(request.id),
    },
  });
}
