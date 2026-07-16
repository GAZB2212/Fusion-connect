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

## Before go-live

1. Rotate `SESSION_SECRET` — the old JWT fallback secret was in source control, so existing tokens must be invalidated.
2. Delete any demo/test accounts from the production database (`*.demo@fusion.com`, `test10XX@fusion.com` — the seeded passwords were previously committed to this repo).
3. Confirm the Stripe webhook endpoint is registered in the Stripe dashboard and `STRIPE_WEBHOOK_SECRET` matches it.
4. Confirm `NODE_ENV=production` on the host.
