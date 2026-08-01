// Background worker that syncs new problems from CF to MongoDB

import { fetchAllProblems } from './cf-api.js';
import { scrapeProblem } from './scraper.js';
import { getProblemsCollection, getIndexCollection } from './db.js';

const SCRAPE_DELAY_MS = 10000; // 10 seconds between each problem

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main sync loop:
 * 1. Fetch problem list from CF API
 * 2. Get list of already-scraped IDs from MongoDB
 * 3. Find new problems
 * 4. Scrape each new problem with 10s delay
 * 5. Save to MongoDB
 */
export async function syncProblems() {
  console.log('[worker] Starting problem sync...');

  try {
    // 1. Fetch all problems from CF API
    console.log('[worker] Fetching problem list from CF API...');
    const allProblems = await fetchAllProblems();
    console.log(`[worker] Found ${allProblems.length} problems on CF`);

    // 2. Get already-scraped IDs from MongoDB
    const indexCol = await getIndexCollection();
    const indexDoc = await indexCol.findOne({});
    const scrapedIds = new Set(indexDoc?.ids || []);
    console.log(`[worker] Already scraped: ${scrapedIds.size} problems`);

    // 3. Find new problems (not yet scraped)
    const newProblems = allProblems.filter(p => {
      const id = `${p.contestId}-${p.index}`;
      return !scrapedIds.has(id);
    });

    console.log(`[worker] New problems to scrape: ${newProblems.length}`);

    if (newProblems.length === 0) {
      console.log('[worker] All problems up to date!');
      return { scraped: 0, total: allProblems.length };
    }

    // 4. Scrape each new problem with delay
    const problemsCol = await getProblemsCollection();
    let scraped = 0;

    for (const p of newProblems) {
      const id = `${p.contestId}-${p.index}`;

      try {
        console.log(`[worker] Scraping ${id}... (${scraped + 1}/${newProblems.length})`);
        const statement = await scrapeProblem(p.contestId, p.index);

        // Save to problems collection
        await problemsCol.insertOne(statement);

        // Add ID to index
        await indexCol.updateOne(
          {},
          { $addToSet: { ids: id } },
          { upsert: true }
        );

        scraped++;
        console.log(`[worker] ✓ Saved ${id}`);

        // Wait 10 seconds before next scrape (unless it's the last one)
        if (scraped < newProblems.length) {
          await sleep(SCRAPE_DELAY_MS);
        }
      } catch (err) {
        console.error(`[worker] ✗ Failed to scrape ${id}:`, err.message);
        // Continue with next problem
      }
    }

    console.log(`[worker] Sync complete. Scraped ${scraped}/${newProblems.length} new problems.`);
    return { scraped, total: allProblems.length };
  } catch (err) {
    console.error('[worker] Sync failed:', err);
    throw err;
  }
}
