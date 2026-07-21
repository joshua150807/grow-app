import type { FastifyPluginAsync } from 'fastify';
import {
  createHabitCollectionService,
  type HabitCollectionService,
} from '../../modules/habitCollections/habitCollectionService.js';

export type HabitCollectionRoutesOptions = {
  habitCollectionService?: HabitCollectionService;
};

export const habitCollectionRoutes: FastifyPluginAsync<HabitCollectionRoutesOptions> = async (
  app,
  options,
) => {
  let runtimeService: HabitCollectionService | null = null;
  const getService = () => options.habitCollectionService
    ?? (runtimeService ??= createHabitCollectionService());

  app.get('/habit-collections', { preHandler: [app.requireAuth] }, async (request) => ({
    collections: await getService().list(request.auth.user!),
  }));

  app.get('/habit-collections/:id', { preHandler: [app.requireAuth] }, async (request) => {
    const { id } = request.params as { id: string };
    return { collection: await getService().get(request.auth.user!, id) };
  });

  app.post('/habit-collections', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const collection = await getService().create(request.auth.user!, request.body);
    return reply.code(201).send({ collection });
  });

  app.patch('/habit-collections/:id', { preHandler: [app.requireAuth] }, async (request) => {
    const { id } = request.params as { id: string };
    return { collection: await getService().update(request.auth.user!, id, request.body) };
  });

  app.delete('/habit-collections/:id', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await getService().delete(request.auth.user!, id, request.body);
    return reply.code(204).send();
  });
};
