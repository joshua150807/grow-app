import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const betaAccessCodes = pgTable('beta_access_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  usedBy: uuid('used_by'),
  usedAt: timestamp('used_at', {
    withTimezone: true,
    mode: 'string',
  }),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

export type BetaAccessCodeRow = typeof betaAccessCodes.$inferSelect;
