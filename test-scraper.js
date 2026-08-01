// Quick test to verify the scraper works without MongoDB
import { scrapeProblem } from './lib/scraper.js';

console.log('[test] Scraping problem 158A...');
try {
  const result = await scrapeProblem(158, 'A');
  console.log('[test] Success!');
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('[test] Failed:', err.message);
  process.exit(1);
}
