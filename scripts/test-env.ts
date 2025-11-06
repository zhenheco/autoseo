#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

console.log('Environment variables check:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ?
  '✅ SET' :
  '❌ NOT SET');
console.log('Key length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('Key format valid:', process.env.OPENAI_API_KEY?.startsWith('sk-') ? '✅' : '❌');
