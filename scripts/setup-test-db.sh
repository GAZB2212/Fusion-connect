#!/usr/bin/env bash
# Creates the local PostgreSQL database the test suite expects and applies
# the Drizzle schema. Requires a PostgreSQL server (default port 5433).
#
# Usage:
#   TEST_DATABASE_URL=postgres://postgres@localhost:5433/fusion_test ./scripts/setup-test-db.sh
set -euo pipefail

TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres@localhost:5433/fusion_test}"

echo "Applying schema to ${TEST_DATABASE_URL}"
DATABASE_URL="$TEST_DATABASE_URL" npx drizzle-kit push --force
echo "Test database ready. Run: npm test"
