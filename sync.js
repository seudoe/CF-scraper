// One-time migration script — run locally to populate MongoDB
// Usage: MONGODB_URI="mongodb+srv://..." node sync.js

import { config } from './lib/env.js';
import { syncProblems } from './lib/worker.js';

console.log('[sync] Starting one-time sync script...');
console.log('[sync] This will scrape all CF problems with 10s delay between each.');
console.log('[sync] Keep this terminal open — it will run for many hours.');
console.log('');

syncProblems()
  .then(result => {
    console.log('[sync] Done!', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('[sync] Fatal error:', err);
    process.exit(1);
  });
