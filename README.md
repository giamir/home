# Home 🏡

A private household chores PWA for Giamir & Nina, covering both houses:
**Gisela** 🇮🇹 (Italy) and **Helga** 🇩🇪 (Germany). Live at
[home.giamir.com](https://home.giamir.com).

## What it does

- **Areas & ownership** — the Household Ownership Agreement as living data:
  every area (Groceries, Kitchen, Plants, …) belongs to a house, has an owner
  (Giamir / Nina / Shared) and editable responsibilities.
- **Tasks** — one-off or recurring (every N days/weeks/months), with points,
  due dates and an optional assignee. Completing a recurring task rolls the
  next due date forward.
- **Two houses, one couple** — each person marks where they're staying
  ("I'm at Helga"). The Today feed shows the current house; reminders follow
  presence. Whoever is in a house does that house's chores — doing the
  other's job counts as "covering" and gets a shout-out.
- **Gamification** — points per chore, streaks for on-time recurring chores,
  a friendly weekly head-to-head plus team total, and a stats page.
- **Push reminders** — daily Vercel Cron pushes "due today" notifications;
  completing a chore pings the partner. An empty house stays silent unless a
  task is flagged *remind even when away* (plants, bills).

## Stack

SvelteKit 2 + Svelte 5 · Tailwind v4 · Drizzle + Neon Postgres ·
`@lucide/svelte` icons · `web-push` · Vercel (Node runtime + Cron).

## Development

```sh
npm install
cp .env.example .env   # fill in values
npm run db:push        # sync schema to Neon
npm run db:seed -- <giamir-pw> <nina-pw>   # first time only (--force to wipe)
npm run dev
```

`npm test` runs the unit tests (recurrence, reminder targeting, scoring).

## Deployment notes

- Env vars needed on Vercel: `DATABASE_URL`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUBLIC_VAPID_PUBLIC_KEY`,
  `CRON_SECRET` (Vercel sends it as the cron `Authorization` header).
- `vercel.json` schedules `/api/cron/reminders` daily at 06:00 UTC
  (production deployments only).
- iOS push only works from the **installed** PWA: Share → Add to Home
  Screen, then enable reminders in Settings.
- Test the cron by hand:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://home.giamir.com/api/cron/reminders`
