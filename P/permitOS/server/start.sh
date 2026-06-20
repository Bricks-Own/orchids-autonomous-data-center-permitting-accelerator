#!/bin/bash
# Start server with ANTHROPIC_API_KEY from ANTHROPIC_AUTH_TOKEN
export ANTHROPIC_API_KEY="${ANTHROPIC_AUTH_TOKEN}"
export PORT=3099
cd /home/user/app/permitOS/server
exec node server.js