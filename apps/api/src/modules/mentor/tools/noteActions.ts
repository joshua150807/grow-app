import { z } from 'zod';
import { AppError } from '../../../errors/appError.js';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { iso, targetNotFound, type Queryable } from './toolShared.js';

const BODY_MAX = 5000;
const APPEND_MAX = 2000;
const READ_BODY_MAX = 1500;
/** Upper bound for a note grown by appends. */
const NOTE_TOTAL_MAX = 20000;

const bodySchema = (max: number) => z
  .string()
  .transform((value) => value.normalize('NFC').trim())
  .pipe(z.string().min(1).max(max));

function firstLine(body: string): string {
  const line = body.split('\n').find((entry) => entry.trim()) ?? body;
  const clean = line.trim();
  return clean.length > 40 ? `${clean.slice(0, 39)}…` : clean;
}

async function requireNote(db: Queryable, userId: string, noteId: string) {
  const result = await db.query<{ id: string; body: string; pinned: boolean | null }>(
    'select id, body, pinned from public.notes where id = $1 and user_id = $2',
    [noteId, userId],
  );
  if (!result.rows[0]) throw targetNotFound('Note');
  return result.rows[0];
}

/**
 * Notes are private: every tool requires "notes_access_enabled". The mentor can
 * create notes, append to them and pin them, but never rewrites or deletes text.
 */
export function createNoteActions(db: () => Queryable, _context: MentorActionContext): MentorActionDefinition[] {
  const createSchema = z.object({ body: bodySchema(BODY_MAX) }).strict();
  const appendSchema = z.object({ note_id: z.string().uuid(), text: bodySchema(APPEND_MAX) }).strict();
  const pinSchema = z.object({ note_id: z.string().uuid(), pinned: z.boolean() }).strict();

  return [
    {
      type: 'notes.list',
      kind: 'read',
      requiresSetting: 'notes_access_enabled',
      description: "Read the user's notes (pinned first, newest first, max 30). Private data: use it only when it helps.",
      inputSchema: z.object({}).strict(),
      jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
      summarize: () => 'Notizen lesen',
      async execute(userId) {
        const result = await db().query<{ id: string; body: string; pinned: boolean | null; updated_at: Date | string | null }>(
          `select id, body, pinned, updated_at from public.notes
           where user_id = $1
           order by coalesce(pinned, false) desc, updated_at desc nulls last
           limit 30`,
          [userId],
        );
        return {
          data: {
            notes: result.rows.map((note) => ({
              id: note.id,
              body: note.body.length > READ_BODY_MAX ? `${note.body.slice(0, READ_BODY_MAX)}…` : note.body,
              pinned: note.pinned === true,
              updated_at: iso(note.updated_at),
            })),
          },
        };
      },
    },
    {
      type: 'note.create',
      kind: 'write',
      requiresSetting: 'notes_access_enabled',
      description: 'Propose a new note, e.g. a plan, list or summary the user wants to keep. First line works as the title.',
      inputSchema: createSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['body'],
        properties: { body: { type: 'string', maxLength: BODY_MAX } },
      },
      summarize: (input: z.infer<typeof createSchema>) => `Notiz „${firstLine(input.body)}“ anlegen`,
      async execute(userId, input: z.infer<typeof createSchema>) {
        const created = await db().query<{ id: string }>(
          'insert into public.notes (user_id, body) values ($1, $2) returning id',
          [userId, input.body],
        );
        return { resultRef: { note_id: created.rows[0].id } };
      },
    },
    {
      type: 'note.append',
      kind: 'write',
      requiresSetting: 'notes_access_enabled',
      description: 'Propose appending text to the end of an existing note (existing text stays unchanged). Use notes.list first.',
      inputSchema: appendSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['note_id', 'text'],
        properties: {
          note_id: { type: 'string', description: 'id from notes.list' },
          text: { type: 'string', maxLength: APPEND_MAX },
        },
      },
      async summarize(input: z.infer<typeof appendSchema>, userId) {
        const note = await requireNote(db(), userId, input.note_id);
        return `Text an Notiz „${firstLine(note.body)}“ anhängen`;
      },
      async execute(userId, input: z.infer<typeof appendSchema>) {
        const note = await requireNote(db(), userId, input.note_id);
        if (note.body.length + input.text.length > NOTE_TOTAL_MAX) {
          throw new AppError(409, 'MENTOR_ACTION_CONFLICT', 'The note would become too long.');
        }
        const updated = await db().query(
          `update public.notes
           set body = rtrim(body) || E'\\n\\n' || $3, updated_at = now()
           where id = $1 and user_id = $2
           returning id`,
          [input.note_id, userId, input.text],
        );
        if (!updated.rowCount) throw targetNotFound('Note');
        return { resultRef: { note_id: input.note_id } };
      },
    },
    {
      type: 'note.pin',
      kind: 'write',
      requiresSetting: 'notes_access_enabled',
      description: 'Propose pinning or unpinning a note. Use notes.list first.',
      inputSchema: pinSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['note_id', 'pinned'],
        properties: {
          note_id: { type: 'string', description: 'id from notes.list' },
          pinned: { type: 'boolean' },
        },
      },
      async summarize(input: z.infer<typeof pinSchema>, userId) {
        const note = await requireNote(db(), userId, input.note_id);
        return `Notiz „${firstLine(note.body)}“ ${input.pinned ? 'anpinnen' : 'nicht mehr anpinnen'}`;
      },
      async execute(userId, input: z.infer<typeof pinSchema>) {
        const updated = await db().query(
          'update public.notes set pinned = $3, updated_at = now() where id = $1 and user_id = $2 returning id',
          [input.note_id, userId, input.pinned],
        );
        if (!updated.rowCount) throw targetNotFound('Note');
        return { resultRef: { note_id: input.note_id } };
      },
    },
  ];
}
