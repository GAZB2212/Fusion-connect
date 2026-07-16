// Test environment configuration. This file runs before each test file's
// imports, so env vars set here are visible to module-load-time checks.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres@localhost:5433/fusion_test";
process.env.SESSION_SECRET = "test-session-secret-not-for-production";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
// NODE_ENV stays "test": dev-only endpoints must be gated (they check for
// "development") and webhooks must be rejected without a signing secret.
process.env.NODE_ENV = "test";
