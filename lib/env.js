// Loads .env.local when running locally (not on Vercel)
// Vercel injects env vars automatically, so this only runs in dev

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { continue; }
    const eq = trimmed.indexOf('=');
    if (eq === -1) { continue; }
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
  console.log('[env] Loaded .env.local');
}

export const config = process.env;
