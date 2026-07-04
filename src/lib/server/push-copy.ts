/** Playful, randomized notification copy — same news, never the same sentence. */

function pick<T>(options: T[]): T {
	return options[Math.floor(Math.random() * options.length)];
}

export function completionCopy(doer: string, task: string, points: number, house: string) {
	return {
		title: pick([
			`${doer} strikes again 💪`,
			`Breaking news from ${house} 📰`,
			`${doer} is on fire 🔥`,
			`Chore down! ✅`,
			`${doer} did a thing ✨`
		]),
		body: pick([
			`${task} — handled. +${points} pts`,
			`${task} is officially toast. +${points}`,
			`${task}? Done and dusted. +${points}`,
			`One less thing: ${task} (+${points})`
		])
	};
}

export function coveredCopy(doer: string, task: string, points: number) {
	return {
		title: pick([
			`${doer} covered for you 💚`,
			`${doer}'s got your back 💚`,
			`Surprise! It's already done 💚`
		]),
		body: pick([
			`${task} — taken off your plate (+${points} for ${doer})`,
			`Consider ${task} handled. Smooth, right? 😎`,
			`${doer} quietly took care of ${task} for you`
		])
	};
}

export function togetherCopy(task: string, points: number) {
	return {
		title: pick([`Team effort 🤝`, `Dynamic duo strikes 🤝`, `Better together 💞`]),
		body: pick([
			`You two crushed ${task} together (+${points} split)`,
			`${task}, tag-teamed. That's the spirit! (+${points} split)`
		])
	};
}

export function reminderBody(area: string, overdueDays: number, isRepeat: boolean): string {
	if (overdueDays > 0) {
		const days = `${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
		return pick([
			`${area} · ${days} overdue 👀`,
			`${area} · feeling lonely for ${days} 🥺`,
			`${area} · ${days} past due — quick win? 💪`
		]);
	}
	if (isRepeat) {
		return pick([
			`${area} · still open today`,
			`${area} · gentle evening nudge 🌙`,
			`${area} · last call for today ⏰`
		]);
	}
	return pick([
		`${area} · due today`,
		`${area} · today's quest ⚔️`,
		`${area} · on today's menu 📋`
	]);
}

export function reactionCopy(reactor: string, emoji: string, task: string) {
	return {
		title: `${reactor} sent you ${emoji}`,
		body: pick([
			`for ${task} — it didn't go unnoticed`,
			`${task} = appreciated ✨`,
			`your work on ${task} made their day`
		])
	};
}

export function levelUpCopy(level: number, title: string) {
	return {
		title: `🎉 Level up! You two are now ${title}`,
		body: `Team level ${level} reached. Keep being great together.`
	};
}
