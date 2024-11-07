#!/usr/bin/env bash

set -e  # Exit on any command failure

DIR="$(cd "$(dirname "$0")" && pwd)"

# if script is called with flag --ci then we call setenv-ci.sh otherwise setenv.sh
if [[ $1 == "--ci" ]]; then
  echo "🟡 - Running integration tests in CI mode"
  source $DIR/setenv-ci.sh
else
  echo "🟡 - Running integration tests in local mode"
  source $DIR/setenv.sh
fi

# print env vars
echo "🔵 - NODE_ENV: ${NODE_ENV}"
echo "🟡 - Waiting for database to be ready..."
echo "🔵 - DATABASE_URL: ${DATABASE_URL}"

# Extract the host and port from the DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | awk -F[@:] '{print $4}')
DB_PORT=$(echo $DATABASE_URL | awk -F[@:] '{print $5}' | awk -F/ '{print $1}')
$DIR/wait-for-it.sh "${DB_HOST}:${DB_PORT}" -t 0 -- echo "🟢 - Database is ready!"

npx prisma migrate deploy

# We'll use a trap to ensure the final echo is always printed, even if vitest fails
trap 'echo "🔴 - Integration tests failed"' ERR

if [[ $1 == "--ci" ]]; then
  vitest -c ./vitest.config.integration.mts --watch false --silent true
else
  vitest -c ./vitest.config.integration.mts
fi

echo "🟢 - Integration tests completed"
