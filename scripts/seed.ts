/**
 * Seed the database with the two users, both households, and the areas from
 * the Household Ownership Agreement (into BOTH houses — prune in-app).
 *
 * Usage: npm run db:seed -- <giamir-password> <nina-password> [--force]
 * --force wipes all existing data first.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { hash } from '@node-rs/argon2';
import { sql } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const { users, households, areas, areaResponsibilities, tasks } = schema;

const [giamirPassword, ninaPassword] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
if (!giamirPassword || !ninaPassword) {
	console.error('Usage: npm run db:seed -- <giamir-password> <nina-password> [--force]');
	process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });

const AGREEMENT: { name: string; icon: string; responsibilities: string[] }[] = [
	{
		name: 'Groceries',
		icon: 'shopping-cart',
		responsibilities: [
			'Notice when food or household items are running low.',
			'Keep the shopping list up to date.',
			'Plan grocery trips before supplies run out.',
			'Purchase groceries within the agreed budget.',
			'Put groceries away and rotate older items to the front.',
			'Check for expired food and dispose of it.',
			'Ensure the household has what it needs for planned meals.'
		]
	},
	{
		name: 'Meal Planning',
		icon: 'chef-hat',
		responsibilities: [
			'Plan meals for the coming days or week.',
			'Take schedules and preferences into account.',
			'Check that ingredients are available.',
			'Coordinate with the grocery owner when items are needed.',
			'Decide what to cook before meal times.',
			'Minimize food waste by using existing ingredients.'
		]
	},
	{
		name: 'Kitchen',
		icon: 'utensils',
		responsibilities: [
			'Keep the kitchen in a usable and hygienic state.',
			'Empty and load the dishwasher as needed.',
			'Wash items that cannot go in the dishwasher.',
			'Wipe counters and sink.',
			'Clean up after cooking.',
			'Regularly clean appliances and the refrigerator.',
			'Notice when deeper cleaning is required.'
		]
	},
	{
		name: 'Cleaning',
		icon: 'sparkles',
		responsibilities: [
			'Monitor the overall cleanliness of shared spaces.',
			'Vacuum and mop when needed.',
			'Dust furniture and clean mirrors.',
			'Empty household bins.',
			'Keep common areas tidy.',
			'Plan and complete deeper cleaning tasks on a regular schedule.'
		]
	},
	{
		name: 'Bathrooms',
		icon: 'shower-head',
		responsibilities: [
			'Clean the toilet, sink, shower, and mirrors.',
			'Refill soap and toilet paper before they run out.',
			'Replace towels when needed.',
			'Keep the bathroom hygienic and pleasant to use.',
			'Notice when supplies or cleaning are needed.'
		]
	},
	{
		name: 'Laundry',
		icon: 'washing-machine',
		responsibilities: [
			'Monitor laundry baskets.',
			'Wash clothing, towels, and bedding as needed.',
			'Dry, fold, and put laundry away.',
			'Ensure clean towels and clothing are available.',
			'Identify special washing requirements.'
		]
	},
	{
		name: 'Bedroom & Bedding',
		icon: 'bed',
		responsibilities: [
			'Change bed sheets regularly.',
			'Wash and remake the bed.',
			'Keep bedroom surfaces reasonably tidy.',
			'Notice when bedding needs refreshing.'
		]
	},
	{
		name: 'Household Supplies',
		icon: 'package',
		responsibilities: [
			'Monitor stock levels of everyday supplies (toilet paper, soap, dishwasher tablets, detergent, cleaning products, trash bags, sponges).',
			'Purchase replacements before items run out.',
			'Store supplies in an organized way.',
			'Inform the grocery owner if items should be included in the next shopping trip.'
		]
	},
	{
		name: 'Plants',
		icon: 'sprout',
		responsibilities: [
			'Water plants according to their needs.',
			'Check plant health.',
			'Fertilize and repot when appropriate.',
			'Remove dead leaves.',
			'Notice signs of pests or disease.'
		]
	},
	{
		name: 'Trash & Recycling',
		icon: 'trash-2',
		responsibilities: [
			'Empty indoor bins before they overflow.',
			'Sort recycling correctly.',
			'Put bins out for collection.',
			'Bring bins back after collection.',
			'Replace bin liners.'
		]
	},
	{
		name: 'Home Maintenance',
		icon: 'wrench',
		responsibilities: [
			'Notice when repairs are needed.',
			'Arrange repairs or maintenance.',
			'Track warranties and manuals.',
			'Replace light bulbs and batteries.',
			'Keep essential tools organized.',
			'Coordinate with contractors if necessary.'
		]
	},
	{
		name: 'Household Administration',
		icon: 'wallet',
		responsibilities: [
			'Pay bills on time.',
			'Track recurring expenses.',
			'Review shared finances periodically.',
			'Maintain household documents.',
			'Ensure subscriptions and insurance remain current.'
		]
	},
	{
		name: 'Planning & Scheduling',
		icon: 'calendar',
		responsibilities: [
			'Schedule household-related appointments.',
			"Coordinate with each other's calendars.",
			'Keep track of important dates.',
			'Plan for visitors, holidays, and events.',
			'Communicate upcoming commitments in advance.'
		]
	}
];

// Starter recurring tasks per house: [area, title, points, interval, unit, remindWhenAway]
const STARTER_TASKS: [string, string, number, number, 'day' | 'week' | 'month', boolean?][] = [
	['Groceries', 'Weekly grocery shop', 10, 1, 'week'],
	['Meal Planning', 'Plan meals for the week', 10, 1, 'week'],
	['Kitchen', 'Deep-clean kitchen', 20, 1, 'week'],
	['Cleaning', 'Vacuum & mop floors', 20, 1, 'week'],
	['Bathrooms', 'Clean bathroom', 20, 1, 'week'],
	['Laundry', 'Wash & fold laundry', 10, 1, 'week'],
	['Bedroom & Bedding', 'Change bed sheets', 10, 2, 'week'],
	['Plants', 'Water the plants', 5, 3, 'day', true],
	['Trash & Recycling', 'Take out trash & recycling', 5, 1, 'week'],
	['Household Administration', 'Check bills & payments', 10, 1, 'month', true]
];

function localToday(timezone: string): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

async function main() {
	const existing = await db.select({ id: users.id }).from(users).limit(1);
	if (existing.length > 0) {
		if (!force) {
			console.error('Database already seeded. Re-run with --force to wipe and reseed.');
			process.exit(1);
		}
		console.log('Wiping existing data…');
		await db.execute(sql`
			TRUNCATE completions, push_subscriptions, tasks, area_responsibilities, areas,
			         sessions, users, households RESTART IDENTITY CASCADE
		`);
	}

	console.log('Creating households…');
	const [gisela, helga] = await db
		.insert(households)
		.values([
			{ name: 'Gisela', emoji: '🇮🇹', timezone: 'Europe/Rome' },
			{ name: 'Helga', emoji: '🇩🇪', timezone: 'Europe/Berlin' }
		])
		.returning();

	console.log('Creating users…');
	const hashOpts = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
	await db.insert(users).values([
		{
			username: 'giamir',
			displayName: 'Giamir',
			emoji: '🧑‍🚀',
			passwordHash: await hash(giamirPassword, hashOpts),
			currentHouseholdId: helga.id
		},
		{
			username: 'nina',
			displayName: 'Nina',
			emoji: '🦊',
			passwordHash: await hash(ninaPassword, hashOpts),
			currentHouseholdId: helga.id
		}
	]);

	for (const household of [gisela, helga]) {
		console.log(`Seeding areas for ${household.name}…`);
		const today = localToday(household.timezone);
		for (const [sortOrder, spec] of AGREEMENT.entries()) {
			const [area] = await db
				.insert(areas)
				.values({ householdId: household.id, name: spec.name, icon: spec.icon, sortOrder })
				.returning();
			await db.insert(areaResponsibilities).values(
				spec.responsibilities.map((text, i) => ({ areaId: area.id, text, sortOrder: i }))
			);
			for (const [areaName, title, points, interval, unit, remindWhenAway] of STARTER_TASKS) {
				if (areaName !== spec.name) continue;
				await db.insert(tasks).values({
					areaId: area.id,
					title,
					points,
					isRecurring: true,
					recurrenceInterval: interval,
					recurrenceUnit: unit,
					nextDueDate: today,
					remindWhenAway: remindWhenAway ?? false
				});
			}
		}
	}

	console.log('Done. Both of you are marked as staying at Helga — change it in the app.');
}

main();
