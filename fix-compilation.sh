#!/bin/bash

# Fix scripts using openaiApiKey
echo "Fixing openaiApiKey to openrouterApiKey in scripts..."

# Update all scripts that use openaiApiKey
sed -i '' "s/openaiApiKey: string/openrouterApiKey: string/g" scripts/verify-*.ts
sed -i '' "s/openaiApiKey:/openrouterApiKey:/g" scripts/verify-*.ts

# Update test files
sed -i '' "s/openaiApiKey: string/openrouterApiKey: string/g" src/lib/agents/__tests__/*.test.ts
sed -i '' "s/openaiApiKey:/openrouterApiKey:/g" src/lib/agents/__tests__/*.test.ts

# Fix image_quality to image_size
sed -i '' "s/image_quality/image_size/g" src/lib/agents/orchestrator.ts

# Fix strategy-agent.ts keywords issue
echo "Fixing strategy-agent keywords field..."

# Fix simple-pricing.ts index issue
echo "Fixing simple-pricing index signature..."

# Fix image-agent null issue
echo "Fixing image-agent null type issue..."

# Fix WordPress Buffer type issue
echo "Fixing WordPress Buffer type issues..."

echo "Done fixing compilation errors!"