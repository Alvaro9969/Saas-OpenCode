<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Fast Start
- Use `npm` (`package-lock.json` is present).
- Core commands: `npm run dev`, `npm run lint`, `npm run build`, `npm run start`.
- No `test` or dedicated `typecheck` script exists; default verification is `npm run lint` then `npm run build`.
- Focused linting works with file args, for example: `npm run lint -- app/api/reservations/[id]/route.ts`.

## Architecture Map
- Single-package Next.js App Router app.
- API entrypoints live in `app/api/**/route.ts`.
- Reservations logic is split between `lib/reservations/*` (creation/checking/query) and `services/*` (slot/date utilities and cancellation).
- Auth/session helpers are in `lib/auth.ts` and `lib/session.ts`; Prisma singleton is `lib/prisma.ts`.
- Twilio webhook flow lives in `app/api/voice/twilio/{inbound,status}/route.ts` with shared signature helpers in `lib/voice/twilioWebhook.ts`.

## Next 16 Gotchas
- In App Router files, request-time APIs are async in Next 16: treat `params` and `searchParams` as Promises and `await` them.
- Route handlers here already follow the Promise-typed `context.params` pattern; keep new handlers consistent.
- If route typing drifts after edits, run `npx next typegen`.

## Auth And Tenant Boundaries
- NextAuth is credentials-only (`app/api/auth/[...nextauth]/route.ts`) and stores `role` + `restaurantId` in JWT/session.
- Tenant scoping for authenticated APIs should come from `getCurrentRestaurantIdFromRequest(request)`; it throws `UNAUTHORIZED` or `RESTAURANT_CONTEXT_MISSING`.
- `rest_1` is still hardcoded in bootstrap/seed scripts; do not copy that pattern into runtime API logic.

## Prisma And Database Reality
- Required env for core app paths: `DATABASE_URL`, `NEXTAUTH_SECRET`.
- Twilio webhook validation additionally needs `TWILIO_AUTH_TOKEN`; `TWILIO_WEBHOOK_BASE_URL` is optional for proxy-aware signature validation.
- Prisma CLI config is `prisma.config.ts` (loads dotenv, schema path `prisma/schema.prisma`).
- `lib/prisma.ts` uses `@prisma/adapter-pg` (`PrismaPg`) with `DATABASE_URL`.
- Migration history is incomplete relative to schema (`prisma/migrations/*` only creates `Reservation` while `prisma/schema.prisma` defines many models). Treat migration SQL as stale unless you regenerate/fix it.

## Seed And Ad Hoc Scripts
- `scripts/create-restaurant.ts` creates `rest_1` + default `RestaurantSettings`; run it before scripts that expect `rest_1` (`create-user.ts`, `seedOpeningHours.ts`, ad hoc slot checks).
- `scripts/create-user.ts` hardcodes demo credentials (`admin@demo.com` / `admin123456`).
- Voice bootstrap SQL lives in `scripts/seed_voice_setup.sql`; quick integrity check is `scripts/verify_voice_setup.sql` (run via `npx prisma db execute --file ...`).
