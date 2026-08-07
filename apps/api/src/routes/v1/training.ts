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
import {
  createTrainingSessionService,
  type TrainingSessionService,
} from '../../modules/trainingSessions/trainingSessionService.js';

export type TrainingRoutesOptions = {
  trainingPlanService?: TrainingPlanService;
  trainingExerciseService?: TrainingExerciseService;
  trainingTemplateService?: TrainingTemplateService;
  trainingSessionService?: TrainingSessionService;
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
  let runtimeSessionService: TrainingSessionService | null = null;
  const sessionService = () => options.trainingSessionService
    ?? (runtimeSessionService ??= createTrainingSessionService());
  const id = (request: { params: unknown }) => (request.params as { id: string }).id;

  app.get('/training/exercises', { preHandler: [app.requireAuth] }, async (request) => (
    exerciseService().list(request.auth.user!, request.query)
  ));
  app.get('/training/exercises/:exerciseId', { preHandler: [app.requireAuth] }, async (request) => (
    exerciseService().get(request.auth.user!, request.params)
  ));
  app.post('/training/exercises', { preHandler: [app.requireAuth] }, async (request, reply) => (
    reply.code(201).send(await exerciseService().create(request.auth.user!, request.body))
  ));

  app.get('/training/templates', { preHandler: [app.requireAuth] }, async (request) => ({
    templates: await templateService().list(request.auth.user!),
  }));
  app.get('/training/templates/:templateId', { preHandler: [app.requireAuth] }, async (request) => {
    const result = await templateService().get(request.auth.user!, request.params);
    return { template: result.template, userPlan: result.userPlan };
  });
  app.put('/training/templates/:templateId/save', { preHandler: [app.requireAuth] }, async (request) => (
    templateService().save(request.auth.user!, request.params)
  ));
  app.delete('/training/templates/:templateId/save', { preHandler: [app.requireAuth] }, async (request) => (
    templateService().unsave(request.auth.user!, request.params)
  ));
  app.post('/training/templates/:templateId/activate', { preHandler: [app.requireAuth] }, async (request) => (
    templateService().activate(request.auth.user!, request.params)
  ));

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
  app.delete('/training/plans/:id', { preHandler: [app.requireAuth] }, async (request, reply) => {
    await service().delete(request.auth.user!, id(request));
    return reply.code(204).send();
  });

  app.get('/training/sessions', { preHandler: [app.requireAuth] }, async (request) => (
    sessionService().list(request.auth.user!, request.query)
  ));
  app.get('/training/sessions/:sessionId', { preHandler: [app.requireAuth] }, async (request) => (
    sessionService().get(request.auth.user!, request.params)
  ));
  app.post('/training/sessions', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const result = await sessionService().create(request.auth.user!, request.body);
    return reply.code(result.created ? 201 : 200).send(result);
  });
  app.get('/training/exercises/:exerciseId/last-note', { preHandler: [app.requireAuth] }, async (request) => (
    sessionService().getLastExerciseNote(request.auth.user!, request.params)
  ));
};
