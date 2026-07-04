import type { Session, User } from '$lib/server/db/schema';

declare global {
	namespace App {
		interface Locals {
			user: Omit<User, 'passwordHash'> | null;
			session: Session | null;
		}
	}
}

export {};
