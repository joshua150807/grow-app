import type { FastifyPluginAsync } from 'fastify';
import type {
  BetaRegistrationCompletionService,
} from '../../modules/betaRegistration/betaRegistrationService.js';
import type { CreatorService } from '../../modules/creator/creatorService.js';
import type { ProfileService } from '../../modules/profiles/profileService.js';
import type { ProfileStatsService } from '../../modules/profileStats/profileStatsService.js';
import type { DeepWorkSessionService } from '../../modules/profileStats/deepWorkSessionService.js';
import type { HabitCollectionService } from '../../modules/habitCollections/habitCollectionService.js';
import type { TrainingPlanService } from '../../modules/trainingPlans/trainingPlanService.js';
import type { TrainingExerciseService } from '../../modules/trainingExercises/trainingExerciseService.js';
import type { TrainingTemplateService } from '../../modules/trainingTemplates/trainingTemplateService.js';
import { authRoutes } from './auth.js';
import { creatorRoutes } from './creator.js';
import { healthRoutes } from './health.js';
import { meRoutes } from './me.js';
import { profileRoutes } from './profile.js';
import { habitCollectionRoutes } from './habitCollections.js';
import { trainingRoutes } from './training.js';

export type V1RoutesOptions = {
  betaRegistrationCompletionService?: BetaRegistrationCompletionService;
  creatorService?: CreatorService;
  profileService?: ProfileService;
  profileStatsService?: ProfileStatsService;
  deepWorkSessionService?: DeepWorkSessionService;
  habitCollectionService?: HabitCollectionService;
  trainingPlanService?: TrainingPlanService;
  trainingExerciseService?: TrainingExerciseService;
  trainingTemplateService?: TrainingTemplateService;
};

export const v1Routes: FastifyPluginAsync<V1RoutesOptions> = async (app, options) => {
  await app.register(healthRoutes);
  await app.register(meRoutes);
  await app.register(authRoutes, {
    betaRegistrationCompletionService: options.betaRegistrationCompletionService,
  });
  await app.register(creatorRoutes, {
    creatorService: options.creatorService,
  });
  await app.register(profileRoutes, {
    profileService: options.profileService,
    profileStatsService: options.profileStatsService,
    deepWorkSessionService: options.deepWorkSessionService,
  });
  await app.register(habitCollectionRoutes, {
    habitCollectionService: options.habitCollectionService,
  });
  await app.register(trainingRoutes, {
    trainingPlanService: options.trainingPlanService,
    trainingExerciseService: options.trainingExerciseService,
    trainingTemplateService: options.trainingTemplateService,
  });
};
