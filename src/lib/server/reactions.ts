import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { completionReactions, completions, tasks } from './db/schema';
import { sendPushToUser } from './push';
import { reactionCopy } from './push-copy';
import type { Doer } from './tasks';

export const REACTION_EMOJIS = ['💚', '😂', '👏', '🔥', '⭐'];

export async function getReactions(completionIds: number[]) {
	if (completionIds.length === 0) return [];
	return db
		.select({
			completionId: completionReactions.completionId,
			userId: completionReactions.userId,
			emoji: completionReactions.emoji
		})
		.from(completionReactions)
		.where(inArray(completionReactions.completionId, completionIds));
}

/** One reaction per person per completion; tapping the same emoji removes it. */
export async function toggleReaction(completionId: number, reactor: Doer, emoji: string) {
	if (!REACTION_EMOJIS.includes(emoji)) return;
	const [completion] = await db
		.select({ userId: completions.userId, taskTitle: tasks.title })
		.from(completions)
		.innerJoin(tasks, eq(completions.taskId, tasks.id))
		.where(eq(completions.id, completionId));
	if (!completion) return;

	const [existing] = await db
		.select()
		.from(completionReactions)
		.where(
			and(
				eq(completionReactions.completionId, completionId),
				eq(completionReactions.userId, reactor.id)
			)
		);

	if (existing && existing.emoji === emoji) {
		await db.delete(completionReactions).where(eq(completionReactions.id, existing.id));
		return;
	}
	if (existing) {
		await db
			.update(completionReactions)
			.set({ emoji })
			.where(eq(completionReactions.id, existing.id));
	} else {
		await db.insert(completionReactions).values({ completionId, userId: reactor.id, emoji });
	}

	if (completion.userId !== reactor.id) {
		try {
			await sendPushToUser(completion.userId, {
				...reactionCopy(reactor.displayName, emoji, completion.taskTitle),
				url: '/'
			});
		} catch (error) {
			console.error('Reaction push failed:', error);
		}
	}
}
