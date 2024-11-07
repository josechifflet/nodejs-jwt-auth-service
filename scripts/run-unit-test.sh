#!/usr/bin/env bash

set -e  # Exit on any command failure

DIR="$(cd "$(dirname "$0")" && pwd)"

# if script is called with flag --ci then we call setenv-ci.sh otherwise setenv.sh
if [[ $1 == "--ci" ]]; then
  echo "🟡 - Running Unit tests in CI mode"
  source $DIR/setenv-ci.sh
else
  echo "🟡 - Running Unit tests in local mode"
  source $DIR/setenv.sh
fi

# print env vars
echo "🔵 - NODE_ENV: ${NODE_ENV}"

# We'll use a trap to ensure the final echo is always printed, even if vitest fails
trap 'echo "🔴 - Unit tests failed"' ERR

if [[ $1 == "--ci" ]]; then
  vitest -c ./vitest.config.unit.mts --watch false --silent true --coverage
else
  vitest -c ./vitest.config.unit.mts --coverage
fi

echo "🟢 - Unit tests completed"
