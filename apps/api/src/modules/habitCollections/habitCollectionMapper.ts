import {
  habitCollectionResponseSchema,
  type HabitCollectionResponse,
} from './habitCollectionSchemas.js';
import type { HabitCollectionRecord } from './habitCollectionRepository.js';

export function mapHabitCollection(record: HabitCollectionRecord): HabitCollectionResponse {
  return habitCollectionResponseSchema.parse({
    id: record.id,
    name: record.name,
    days: record.days,
    version: record.version,
    created_at: new Date(record.created_at).toISOString(),
    updated_at: new Date(record.updated_at).toISOString(),
    members: record.members.map((member) => ({
      habit_id: member.habit_id,
      name: member.name,
      days: member.days,
      position: member.position,
      linked_tool_id: member.linked_tool_id,
      linked_tool_title: member.linked_tool_title,
      linked_tool_route: member.linked_tool_route,
      created_at: new Date(member.created_at).toISOString(),
    })),
  });
}
