import { getPgPool } from '../../../db/client.js';
import {
  createMentorActionRegistry,
  type MentorActionContext,
  type MentorActionRegistry,
} from '../actions/mentorActionRegistry.js';
import { createHabitActions } from './habitActions.js';
import { createTodoActions } from './todoActions.js';
import type { Queryable } from './toolShared.js';

/**
 * Actions available to the mentor in production.
 * M8: habits, todos. Training follows once its schema is confirmed.
 * M9/M10 add goals, planner, deep work, journal, notes, affirmations, guiding questions.
 */
export function createDefaultMentorActionRegistry(
  context: MentorActionContext,
  db: () => Queryable = getPgPool,
): MentorActionRegistry {
  return createMentorActionRegistry([
    ...createHabitActions(db, context),
    ...createTodoActions(db, context),
  ]);
}
