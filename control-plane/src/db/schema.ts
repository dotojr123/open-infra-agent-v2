import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['ADMIN', 'USER'] }).notNull().default('USER'),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'BLOCKED'] })
    .notNull()
    .default('PENDING'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// status ainda não cobre provisionamento real (isso é Etapa 2) — toda conta
// nasce com uma linha NOT_PROVISIONED, o provisionador só atualiza depois.
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  containerId: text('container_id'),
  status: text('status', {
    enum: ['NOT_PROVISIONED', 'STOPPED', 'RUNNING', 'ERROR'],
  })
    .notNull()
    .default('NOT_PROVISIONED'),
  port: integer('port'),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
