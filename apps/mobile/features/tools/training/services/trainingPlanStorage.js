import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../../../../lib/logger';

const TRAINING_PLAN_CACHE_KEY = 'grow.training.plan.cache.v1';

export async function getCachedTrainingPlan() {
  try {
    const raw = await AsyncStorage.getItem(TRAINING_PLAN_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    logger.warn('[Training Plan Storage] Could not read cached plan:', error);
    return null;
  }
}

export async function saveCachedTrainingPlan(plan) {
  try {
    if (!plan) {
      await AsyncStorage.removeItem(TRAINING_PLAN_CACHE_KEY);
      return;
    }

    await AsyncStorage.setItem(TRAINING_PLAN_CACHE_KEY, JSON.stringify(plan));
  } catch (error) {
    logger.warn('[Training Plan Storage] Could not save cached plan:', error);
  }
}

export async function removeCachedTrainingPlan() {
  try {
    await AsyncStorage.removeItem(TRAINING_PLAN_CACHE_KEY);
  } catch (error) {
    logger.warn('[Training Plan Storage] Could not remove cached plan:', error);
  }
}
