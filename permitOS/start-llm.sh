#!/bin/bash
echo "Starting PermitOS with LLM support..."

# Pass through Anthropic proxy env vars
export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN}"
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL}"
export ANTHROPIC_CUSTOM_HEADERS="${ANTHROPIC_CUSTOM_HEADERS}"

echo "ANTHROPIC_BASE_URL: ${ANTHROPIC_BASE_URL}"
echo "ANTHROPIC_AUTH_TOKEN length: ${#ANTHROPIC_AUTH_TOKEN}"
echo "ANTHROPIC_CUSTOM_HEADERS length: ${#ANTHROPIC_CUSTOM_HEADERS}"

cd /home/user/app/permitOS
exec node server/server.js