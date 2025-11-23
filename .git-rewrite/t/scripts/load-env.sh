#!/bin/bash

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
  echo "✅ Environment variables loaded from .env.local"
else
  echo "❌ .env.local not found"
  exit 1
fi

exec "$@"
