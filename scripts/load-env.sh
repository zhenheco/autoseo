#!/bin/bash

if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
  echo "✅ Environment variables loaded from .env.local"
else
  echo "❌ .env.local not found"
  exit 1
fi

exec "$@"
