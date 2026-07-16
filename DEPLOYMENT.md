# Deployment Checklist

## Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon/PostgreSQL connection string |
| `SESSION_SECRET` | Signs web sessions **and** mobile JWTs. The server refuses to start without it. Use a long random value (`openssl rand -hex 32`) |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. **Required in production** — unverified webhook events are rejected |
| `NODE_ENV` | Must be `production` in production. Anything else enables dev-only endpoints and the free-match bypass |

## Optional environment variables

| Variable | Purpose |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated extra CORS origins. The Capacitor app origins (`capacitor://localhost`, `ionic://localhost`, `http(s)://localhost`) are always allowed; the web client is same-origin and needs nothing here |
| `ADMIN_SEED_KEY` | Enables `POST /api/admin/seed-demo-profiles` for staging. **Leave unset in production** — the endpoint returns 404 when unset |

Plus the existing integration secrets: Cloudflare R2, Sendbird, Agora, OpenAI, Resend, VAPID keys.

## Development-only behavior (NODE_ENV=development)

These exist only in development and return 404 in production:

- `POST /api/dev/activate-premium` — free premium
- `POST /api/dev-verify` — skip face verification
- `POST /api/dev/reset-matches` — wipes ALL matches/swipes
- `POST /api/dev/backfill-channels`, `/api/dev/cleanup-*`, `/api/dev/backfill-sendbird-users`
- Stripe webhooks accepted without signature verification (when no `STRIPE_WEBHOOK_SECRET`)
- Matches created without either user having a subscription

The corresponding client buttons (Skip Verification, Skip Payment, Testing Tools in Settings) only render in dev builds.

## Database migrations

Schema changes are tracked as SQL migrations in `migrations/` (the old
`db:push` workflow applied schema changes directly with no history).

- After editing `shared/schema.ts`, run `npm run db:generate` to create a
  migration, review the SQL, and commit it.
- Apply migrations with `npm run db:migrate` (uses `DATABASE_URL`).
- Fresh databases: just run `npm run db:migrate` — the baseline migration
  creates the full schema.
- **The existing production database** already has all tables, so the
  baseline must be marked as applied (once) instead of executed:

  ```sql
  CREATE SCHEMA IF NOT EXISTS drizzle;
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  );
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  VALUES ('e4f3d65d3c90388e0ed2a9741af9dc35b454cb98af438ebe0bf97ee6f23a46a0', 1784190989325);
  ```

  After that, future migrations apply normally with `npm run db:migrate`.

## Running tests

`npm test` runs the integration suite against a local PostgreSQL database
(default `postgres://postgres@localhost:5433/fusion_test`, override with
`TEST_DATABASE_URL`). Create it once with `./scripts/setup-test-db.sh`.

## Before go-live

1. Rotate `SESSION_SECRET` — the old JWT fallback secret was in source control, so existing tokens must be invalidated.
2. Delete any demo/test accounts from the production database (`*.demo@fusion.com`, `test10XX@fusion.com` — the seeded passwords were previously committed to this repo).
3. Confirm the Stripe webhook endpoint is registered in the Stripe dashboard and `STRIPE_WEBHOOK_SECRET` matches it.
4. Confirm `NODE_ENV=production` on the host.
