import type { FastifyPluginAsync } from 'fastify';
import {
  createTrainingPlanService,
  type TrainingPlanService,
} from '../../modules/trainingPlans/trainingPlanService.js';
import {
  createTrainingExerciseService,
  type TrainingExerciseService,
} from '../../modules/trainingExercises/trainingExerciseService.js';
import {
  createTrainingTemplateService,
  type TrainingTemplateService,
} from '../../modules/trainingTemplates/trainingTemplateService.js';

export type TrainingRoutesOptions = {
  trainingPlanService?: TrainingPlanService;
  trainingExerciseService?: TrainingExerciseService;
  trainingTemplateService?: TrainingTemplateService;
};

export const trainingRoutes: FastifyPluginAsync<TrainingRoutesOptions> = async (app, options) => {
  let runtimeService: TrainingPlanService | null = null;
  const service = () => options.trainingPlanService
    ?? (runtimeService ??= createTrainingPlanService());
  let runtimeExerciseService: TrainingExerciseService | null = null;
  const exerciseService = () => options.trainingExerciseService
    ?? (runtimeExerciseService ??= createTrainingExerciseService());
  let runtimeTemplateService: TrainingTemplateService | null = null;
  const templateService = () => options.trainingTemplateService
    ?? (runtimeTemplateService ??= createTrainingTemplateService());
  const id = (request: { params: unknown }) => (request.params as { id: string }).id;

  app.get('/training/exercises', { preHandler: [app.requireAuth] }, async (request) => (
    exerciseService().list(request.auth.user!, request.query)
  ));
  app.get('/training/exercises/:exerciseId', { preHandler: [app.requireAuth] }, async (request) => (
    exerciseService().get(request.auth.user!, request.params)
  ));

  app.get('/training/templates', { preHandler: [app.requireAuth] }, async (request) => ({
    templates: await templateService().list(request.auth.user!),
  }));
  app.get('/training/templates/:templateId', { preHandler: [app.requireAuth] }, async (request) => {
    const result = await templateService().get(request.auth.user!, request.params);
    return { template: result.template, userPlan: result.userPlan };
  });

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
