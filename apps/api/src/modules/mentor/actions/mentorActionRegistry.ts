import type { z } from 'zod';

/**
 * A capability the mentor can use inside Grow.
 *
 * - kind 'read': executed immediately while the mentor answers; the result is
 *   returned to the model as data (never shown as a card).
 * - kind 'write': only stored as a proposal; executed after the user confirms.
 *
 * Every execute() receives the authenticated user id from the backend, never
 * from the model, and must bind all data access to it.
 */
export type MentorActionDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  /** e.g. 'habit.create' – also stored in mentor_actions.type */
  type: string;
  kind: 'read' | 'write';
  /** Instruction for the model: what it does and when to use it. */
  description: string;
  inputSchema: TSchema;
  /** JSON schema of the input, given to the model. */
  jsonSchema: Record<string, unknown>;
  /**
   * Short German text for the confirmation card (write actions). May look up
   * the target for the authenticated user and throw an AppError if it does
   * not exist; the error is returned to the model instead of a proposal.
   */
  summarize(input: z.infer<TSchema>, userId: string): string | Promise<string>;
  execute(userId: string, input: z.infer<TSchema>): Promise<MentorActionResult>;
  /**
   * Data-access switch the user must have turned on (mentor_settings). Without
   * it the tool is not offered and cannot be confirmed.
   */
  requiresSetting?: MentorAccessSetting;
};

export type MentorAccessSetting = 'journal_access_enabled' | 'notes_access_enabled';
export type MentorAccessSettings = Partial<Record<MentorAccessSetting, boolean>>;

export type MentorActionResult = {
  /** Reference to what was created or changed, e.g. { habit_id }. */
  resultRef?: Record<string, unknown>;
  /** Data returned to the model (read actions). Keep it small. */
  data?: unknown;
};

export type MentorActionRegistry = {
  list(): MentorActionDefinition[];
  get(type: string): MentorActionDefinition | undefined;
};

/** Tool names must be ^[a-zA-Z0-9_-]+$ for LLM APIs: 'habit.create' -> 'habit__create'. */
export function toolNameForType(type: string): string {
  return type.replace('.', '__');
}

export function typeForToolName(name: string): string {
  return name.replace('__', '.');
}

export function createMentorActionRegistry(definitions: MentorActionDefinition[] = []): MentorActionRegistry {
  const byType = new Map<string, MentorActionDefinition>();
  for (const definition of definitions) {
    if (!/^[a-z_]+\.[a-z_]+$/.test(definition.type)) {
      throw new Error(`Invalid mentor action type: ${definition.type}`);
    }
    if (byType.has(definition.type)) {
      throw new Error(`Duplicate mentor action type: ${definition.type}`);
    }
    byType.set(definition.type, definition);
  }
  return {
    list: () => [...byType.values()],
    get: (type) => byType.get(type),
  };
}

export type MentorActionContext = {
  /** IANA time zone used for "today" (user dates). */
  timeZone: string;
  now: () => Date;
};
