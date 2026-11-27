import { getPgPool } from '../../../db/client.js';
import {
  createMentorActionRegistry,
  type MentorActionContext,
  type MentorActionRegistry,
} from '../actions/mentorActionRegistry.js';
import { createDeepWorkActions } from './deepWorkActions.js';
import { createGoalActions } from './goalActions.js';
import { createHabitActions } from './habitActions.js';
import { createPlannerActions } from './plannerActions.js';
import { createTodoActions } from './todoActions.js';
import type { Queryable } from './toolShared.js';

/**
 * Actions available to the mentor in production.
 * M8: habits, todos. Training follows once its data model is clarified.
 * M9: goals, daily planner, deep work (read-only).
 * M10 adds journal, notes, affirmations, guiding questions.
 */
export function createDefaultMentorActionRegistry(
  context: MentorActionContext,
  db: () => Queryable = getPgPool,
): MentorActionRegistry {
  return createMentorActionRegistry([
    ...createHabitActions(db, context),
    ...createTodoActions(db, context),
    ...createGoalActions(db, context),
    ...createPlannerActions(db, context),
    ...createDeepWorkActions(db, context),
  ]);
}
