import type { SupabaseClient } from '@supabase/supabase-js';
import type pg from 'pg';
import { getPgPool } from '../../db/client.js';
import { getSupabaseAdminClient } from '../../integrations/supabase/adminClient.js';
import type {
  CreateHabitCollectionInput,
  HabitCollectionMemberInput,
  UpdateHabitCollectionInput,
} from './habitCollectionSchemas.js';

export type HabitCollectionMemberRecord = {
  habit_id: string;
  name: string;
  days: number[];
  position: number;
  linked_tool_id: string | null;
  linked_tool_title: string | null;
  linked_tool_route: string | null;
  created_at: string;
};

export type HabitCollectionRecord = {
  id: string;
  name: string;
  days: number[];
  version: number;
  created_at: string;
  updated_at: string;
  members: HabitCollectionMemberRecord[];
};

export type HabitCollectionRepository = {
  list(userId: string): Promise<HabitCollectionRecord[]>;
  find(userId: string, collectionId: string): Promise<HabitCollectionRecord | null>;
  create(userId: string, input: CreateHabitCollectionInput): Promise<string>;
  update(userId: string, collectionId: string, input: UpdateHabitCollectionInput): Promise<void>;
  delete(userId: string, collectionId: string, expectedVersion: number): Promise<void>;
};

type Queryable = Pick<pg.Pool, 'query'>;

type CollectionQueryRow = {
  id: string;
  name: string;
  days: number[];
  version: number;
  created_at: string;
  updated_at: string;
  members: HabitCollectionMemberRecord[] | null;
};

const collectionSelect = `
  select
    collection.id,
    collection.name,
    collection.days,
    collection.version,
    collection.created_at,
    collection.updated_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'habit_id', habit.id,
          'name', habit.name,
          'days', habit.days,
          'position', membership.position,
          'linked_tool_id', habit.linked_tool_id,
          'linked_tool_title', habit.linked_tool_title,
          'linked_tool_route', habit.linked_tool_route,
          'created_at', habit.created_at
        ) order by membership.position
      ) filter (where membership.id is not null),
      '[]'::jsonb
    ) as members
  from public.habit_collections as collection
  left join public.habit_collection_memberships as membership
    on membership.collection_id = collection.id
   and membership.user_id = collection.user_id
   and membership.active_until is null
  left join public.habits as habit
    on habit.id = membership.habit_id
   and habit.user_id = membership.user_id
  where collection.user_id = $1
    and collection.deleted_at is null
`;

function mapRow(row: CollectionQueryRow): HabitCollectionRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    days: Array.isArray(row.days) ? row.days.map(Number) : [],
    version: Number(row.version),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    members: (Array.isArray(row.members) ? row.members : []).map((member) => ({
      habit_id: String(member.habit_id),
      name: String(member.name),
      days: Array.isArray(member.days) ? member.days.map(Number) : [],
      position: Number(member.position),
      linked_tool_id: typeof member.linked_tool_id === 'string' ? member.linked_tool_id : null,
      linked_tool_title: typeof member.linked_tool_title === 'string' ? member.linked_tool_title : null,
      linked_tool_route: typeof member.linked_tool_route === 'string' ? member.linked_tool_route : null,
      created_at: new Date(member.created_at).toISOString(),
    })),
  };
}

function serializeMembers(members: HabitCollectionMemberInput[]) {
  return members.map((member) => member.type === 'existing'
    ? { type: 'existing', habit_id: member.habit_id }
    : {
        type: 'new',
        name: member.name,
        linked_tool_id: member.linked_tool_id ?? null,
        linked_tool_title: member.linked_tool_title ?? null,
        linked_tool_route: member.linked_tool_route ?? null,
      });
}

function getRpcScalar(data: unknown): string {
  if (typeof data === 'string' || typeof data === 'number') return String(data);
  throw new Error('Habit collection mutation returned an invalid result.');
}

export function createHabitCollectionRepository(
  db: Queryable = getPgPool(),
  supabase: SupabaseClient = getSupabaseAdminClient(),
): HabitCollectionRepository {
  return {
    async list(userId) {
      const result = await db.query(
        `${collectionSelect}
         group by collection.id
         order by collection.created_at asc`,
        [userId],
      );
      return result.rows.map((row) => mapRow(row as CollectionQueryRow));
    },

    async find(userId, collectionId) {
      const result = await db.query(
        `${collectionSelect}
           and collection.id = $2
         group by collection.id`,
        [userId, collectionId],
      );
      return result.rows[0] ? mapRow(result.rows[0] as CollectionQueryRow) : null;
    },

    async create(userId, input) {
      const { data, error } = await supabase.rpc('create_habit_collection', {
        input_user_id: userId,
        input_name: input.name,
        input_days: input.days,
        input_members: serializeMembers(input.members),
      });
      if (error) throw error;
      return getRpcScalar(data);
    },

    async update(userId, collectionId, input) {
      const { data, error } = await supabase.rpc('update_habit_collection', {
        input_user_id: userId,
        input_collection_id: collectionId,
        input_expected_version: input.expected_version,
        input_name: input.name,
        input_days: input.days,
        input_members: serializeMembers(input.members),
      });
      if (error) throw error;
      getRpcScalar(data);
    },

    async delete(userId, collectionId, expectedVersion) {
      const { data, error } = await supabase.rpc('delete_habit_collection', {
        input_user_id: userId,
        input_collection_id: collectionId,
        input_expected_version: expectedVersion,
      });
      if (error) throw error;
      getRpcScalar(data);
    },
  };
}
