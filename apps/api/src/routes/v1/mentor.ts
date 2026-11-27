import type { FastifyPluginAsync } from 'fastify';
import { createMentorService, type MentorService } from '../../modules/mentor/mentorService.js';

export type MentorRoutesOptions = {
  mentorService?: MentorService;
};

export const mentorRoutes: FastifyPluginAsync<MentorRoutesOptions> = async (app, options) => {
  let runtimeService: MentorService | null = null;
  const getService = () => options.mentorService
    ?? (runtimeService ??= createMentorService({ logger: app.log }));

  // Mentor replies can take a while; keep request bodies small.
  const bodyLimit = 32 * 1024;

  app.get('/mentor/settings', { preHandler: [app.requireAuth] }, async (request) => ({
    settings: await getService().getSettings(request.auth.user!),
  }));

  app.patch('/mentor/settings', { preHandler: [app.requireAuth], bodyLimit }, async (request) => ({
    settings: await getService().updateSettings(request.auth.user!, request.body),
  }));

  app.get('/mentor/memories', { preHandler: [app.requireAuth] }, async (request) => ({
    memories: await getService().memories.list(request.auth.user!),
  }));

  app.patch('/mentor/memories/:id', { preHandler: [app.requireAuth], bodyLimit }, async (request) => {
    const { id } = request.params as { id: string };
    return { memory: await getService().memories.update(request.auth.user!, id, request.body) };
  });

  app.delete('/mentor/memories/:id', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await getService().memories.delete(request.auth.user!, id);
    return reply.code(204).send();
  });

  app.delete('/mentor/memories', { preHandler: [app.requireAuth] }, async (request) => (
    getService().memories.deleteAll(request.auth.user!)
  ));

  app.post('/mentor/actions/:id/confirm', { preHandler: [app.requireAuth] }, async (request) => {
    const { id } = request.params as { id: string };
    return { action: await getService().confirmAction(request.auth.user!, id) };
  });

  app.post('/mentor/actions/:id/reject', { preHandler: [app.requireAuth] }, async (request) => {
    const { id } = request.params as { id: string };
    return { action: await getService().rejectAction(request.auth.user!, id) };
  });

  app.put('/mentor/consent', { preHandler: [app.requireAuth], bodyLimit }, async (request) => ({
    settings: await getService().grantConsent(request.auth.user!, request.body),
  }));

  app.delete('/mentor/consent', { preHandler: [app.requireAuth] }, async (request) => ({
    settings: await getService().withdrawConsent(request.auth.user!),
  }));

  app.get('/mentor/usage', { preHandler: [app.requireAuth] }, async (request) => ({
    usage: await getService().getUsage(request.auth.user!),
  }));

  app.get('/mentor/conversations', { preHandler: [app.requireAuth] }, async (request) => (
    getService().listConversations(request.auth.user!, request.query)
  ));

  app.get('/mentor/conversations/:id/messages', { preHandler: [app.requireAuth] }, async (request) => {
    const { id } = request.params as { id: string };
    return getService().listMessages(request.auth.user!, id, request.query);
  });

  app.patch('/mentor/conversations/:id', { preHandler: [app.requireAuth], bodyLimit }, async (request) => {
    const { id } = request.params as { id: string };
    return { conversation: await getService().renameConversation(request.auth.user!, id, request.body) };
  });

  app.delete('/mentor/conversations/:id', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await getService().deleteConversation(request.auth.user!, id);
    return reply.code(204).send();
  });

  app.post('/mentor/messages', { preHandler: [app.requireAuth], bodyLimit }, async (request, reply) => {
    const result = await getService().sendMessage(request.auth.user!, request.body);
    return reply.code(201).send(result);
  });
};
