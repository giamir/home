import {
	pgTable,
	smallserial,
	serial,
	smallint,
	integer,
	text,
	boolean,
	timestamp,
	date,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';

export const households = pgTable('households', {
	id: smallserial('id').primaryKey(),
	name: text('name').notNull(),
	emoji: text('emoji').notNull().default('🏠'),
	timezone: text('timezone').notNull().default('Europe/Berlin'),
	reminderHour: smallint('reminder_hour').notNull().default(8),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const users = pgTable('users', {
	id: smallserial('id').primaryKey(),
	username: text('username').notNull().unique(),
	displayName: text('display_name').notNull(),
	emoji: text('emoji').notNull().default('🙂'),
	passwordHash: text('password_hash').notNull(),
	currentHouseholdId: smallint('current_household_id').references(() => households.id),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(), // sha256(token), never the raw token
	userId: smallint('user_id')
		.notNull()
		.references(() => users.id),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const areas = pgTable(
	'areas',
	{
		id: serial('id').primaryKey(),
		householdId: smallint('household_id')
			.notNull()
			.references(() => households.id),
		name: text('name').notNull(),
		icon: text('icon').notNull().default('house'), // lucide icon name
		ownerUserId: smallint('owner_user_id').references(() => users.id), // NULL = shared
		sortOrder: integer('sort_order').notNull().default(0),
		archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(t) => [index('areas_household_idx').on(t.householdId)]
);

export const areaResponsibilities = pgTable(
	'area_responsibilities',
	{
		id: serial('id').primaryKey(),
		areaId: integer('area_id')
			.notNull()
			.references(() => areas.id, { onDelete: 'cascade' }),
		text: text('text').notNull(),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('area_responsibilities_area_idx').on(t.areaId)]
);

export const tasks = pgTable(
	'tasks',
	{
		id: serial('id').primaryKey(),
		areaId: integer('area_id')
			.notNull()
			.references(() => areas.id),
		title: text('title').notNull(),
		notes: text('notes'),
		points: smallint('points').notNull().default(10),
		assignedUserId: smallint('assigned_user_id').references(() => users.id), // NULL = area owner
		isRecurring: boolean('is_recurring').notNull().default(false),
		recurrenceInterval: smallint('recurrence_interval'),
		recurrenceUnit: text('recurrence_unit', { enum: ['day', 'week', 'month'] }),
		// The single live due date ("this calendar day in the household's timezone").
		nextDueDate: date('next_due_date'),
		remindWhenAway: boolean('remind_when_away').notNull().default(false),
		lastRemindedAt: timestamp('last_reminded_at', { withTimezone: true, mode: 'date' }),
		archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(t) => [index('tasks_area_idx').on(t.areaId), index('tasks_due_idx').on(t.nextDueDate)]
);

export const completions = pgTable(
	'completions',
	{
		id: serial('id').primaryKey(),
		taskId: integer('task_id')
			.notNull()
			.references(() => tasks.id),
		userId: smallint('user_id')
			.notNull()
			.references(() => users.id),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow(),
		// Due date this completion satisfied; NULL for tasks completed without one.
		dueDate: date('due_date'),
		onTime: boolean('on_time').notNull(),
		pointsAwarded: smallint('points_awarded').notNull(),
		// Set when the doer wasn't the responsible person at completion time.
		coveredForUserId: smallint('covered_for_user_id').references(() => users.id)
	},
	(t) => [
		index('completions_completed_idx').on(t.completedAt),
		index('completions_task_idx').on(t.taskId, t.completedAt)
	]
);

export const completionReactions = pgTable(
	'completion_reactions',
	{
		id: serial('id').primaryKey(),
		completionId: integer('completion_id')
			.notNull()
			.references(() => completions.id, { onDelete: 'cascade' }),
		userId: smallint('user_id')
			.notNull()
			.references(() => users.id),
		emoji: text('emoji').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('completion_reactions_one_per_user').on(t.completionId, t.userId)]
);

export const pushSubscriptions = pgTable('push_subscriptions', {
	id: serial('id').primaryKey(),
	userId: smallint('user_id')
		.notNull()
		.references(() => users.id),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export type Household = typeof households.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type AreaResponsibility = typeof areaResponsibilities.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Completion = typeof completions.$inferSelect;
export type CompletionReaction = typeof completionReactions.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
