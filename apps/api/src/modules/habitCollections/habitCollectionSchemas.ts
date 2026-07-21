import { z } from 'zod';

export const habitCollectionIdSchema = z.string().uuid();

export const habitCollectionDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, 'Days must be unique.');

const existingHabitMemberSchema = z.object({
  type: z.literal('existing'),
  habit_id: z.string().uuid(),
}).strict();

const newHabitMemberSchema = z.object({
  type: z.literal('new'),
  name: z.string().trim().min(1),
  linked_tool_id: z.string().trim().min(1).max(500).nullable().optional(),
  linked_tool_title: z.string().trim().min(1).max(500).nullable().optional(),
  linked_tool_route: z.string().trim().min(1).max(500).nullable().optional(),
}).strict();

export const habitCollectionMemberInputSchema = z.discriminatedUnion('type', [
  existingHabitMemberSchema,
  newHabitMemberSchema,
]);

const membersSchema = z.array(habitCollectionMemberInputSchema).superRefine((members, context) => {
  const existingIds = members
    .filter((member): member is z.infer<typeof existingHabitMemberSchema> => member.type === 'existing')
    .map((member) => member.habit_id);
  if (new Set(existingIds).size !== existingIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Existing habits may only appear once.',
    });
  }
  members.forEach((member, index) => {
    if (member.type !== 'new') return;
    const links = [member.linked_tool_id, member.linked_tool_title, member.linked_tool_route];
    const present = links.filter((value) => typeof value === 'string').length;
    if (present !== 0 && present !== links.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tool link fields must be provided together.',
        path: [index, 'linked_tool_id'],
      });
    }
  });
});

export const createHabitCollectionRequestSchema = z.object({
  name: z.string().trim().min(1).max(60),
  days: habitCollectionDaysSchema,
  members: membersSchema,
}).strict();

export const updateHabitCollectionRequestSchema = z.object({
  expected_version: z.number().int().min(1),
  name: z.string().trim().min(1).max(60),
  days: habitCollectionDaysSchema,
  members: membersSchema,
}).strict();

export const deleteHabitCollectionRequestSchema = z.object({
  expected_version: z.number().int().min(1),
}).strict();

export const habitCollectionMemberResponseSchema = z.object({
  habit_id: z.string().uuid(),
  name: z.string(),
  days: z.array(z.number().int()),
  position: z.number().int().min(0),
  linked_tool_id: z.string().nullable(),
  linked_tool_title: z.string().nullable(),
  linked_tool_route: z.string().nullable(),
  created_at: z.string(),
});

export const habitCollectionResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  days: z.array(z.number().int()),
  version: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
  members: z.array(habitCollectionMemberResponseSchema),
});

export type HabitCollectionMemberInput = z.infer<typeof habitCollectionMemberInputSchema>;
export type CreateHabitCollectionInput = z.infer<typeof createHabitCollectionRequestSchema>;
export type UpdateHabitCollectionInput = z.infer<typeof updateHabitCollectionRequestSchema>;
export type HabitCollectionResponse = z.infer<typeof habitCollectionResponseSchema>;
