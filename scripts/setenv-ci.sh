#!/usr/bin/env bash
# scripts/setenv-ci.sh

set -e  # Exit on any command failure

log() {
  echo "$1"
}

read_env() {
  local filePath="${1}"

  if [ ! -f "$filePath" ]; then
    log "Error: Missing ${filePath}"
    exit 1
  fi

  log "🟡 - Setting environment variables from $filePath"
  while IFS= read -r LINE; do
    # Remove leading and trailing whitespaces, and carriage return
    CLEANED_LINE=$(echo "$LINE" | awk '{$1=$1};1' | tr -d '\r')

    if [[ $CLEANED_LINE != '#'* ]] && [[ $CLEANED_LINE == *'='* ]]; then
      export "$CLEANED_LINE"
    fi
  done < "$filePath"
  log "🟢 - Environment variables set from $filePath"
}

# Call the read_env function to set environment variables from .env.ci file
read_env ".env.ci"
