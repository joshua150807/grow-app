import type { FastifyPluginAsync } from 'fastify';
import {
  createTrainingPlanService,
  type TrainingPlanService,
} from '../../modules/trainingPlans/trainingPlanService.js';

export type TrainingRoutesOptions = { trainingPlanService?: TrainingPlanService };

export const trainingRoutes: FastifyPluginAsync<TrainingRoutesOptions> = async (app, options) => {
  let runtimeService: TrainingPlanService | null = null;
  const service = () => options.trainingPlanService
    ?? (runtimeService ??= createTrainingPlanService());
  const id = (request: { params: unknown }) => (request.params as { id: string }).id;

  app.get('/training/plans', { preHandler: [app.requireAuth] }, async (request) => ({
    plans: await service().list(request.auth.user!),
  }));
  app.get('/training/plans/:id', { preHandler: [app.requireAuth] }, async (request) => ({
    plan: await service().get(request.auth.user!, id(request)),
  }));
  app.post('/training/plans', { preHandler: [app.requireAuth] }, async (request, reply) => (
    reply.code(201).send({ plan: await service().create(request.auth.user!, request.body) })
  ));
  app.patch('/training/plans/:id', { preHandler: [app.requireAuth] }, async (request) => ({
    plan: await service().update(request.auth.user!, id(request), request.body),
  }));
  app.post('/training/plans/:id/activate', { preHandler: [app.requireAuth] }, async (request) => ({
    plan: await service().activate(request.auth.user!, id(request), request.body),
  }));
  app.post('/training/plans/:id/schedule', { preHandler: [app.requireAuth] }, async (request) => ({
    plan: await service().schedule(request.auth.user!, id(request), request.body),
  }));
  app.post('/training/plans/:id/reactivate', { preHandler: [app.requireAuth] }, async (request) => ({
    plan: await service().reactivate(request.auth.user!, id(request), request.body),
  }));
  app.post('/training/plans/:id/archive', { preHandler: [app.requireAuth] }, async (request) => ({
    plan: await service().archive(request.auth.user!, id(request), request.body),
  }));
  app.put('/training/plans/:id/weekly-goal', { preHandler: [app.requireAuth] }, async (request) => ({
    plan: await service().updateWeeklyGoal(request.auth.user!, id(request), request.body),
  }));
};
