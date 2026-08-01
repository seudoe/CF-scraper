import { fetchAllProblems } from './cf-api.js';
import { scrapeProblem } from './scraper.js';
import { getProblemsCollection, getIndexCollection } from './db.js';

const SCRAPE_DELAY_MS = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function syncProblems() {
  console.log('[worker] ════════════════════════════════');
  console.log('[worker] Starting problem sync');
  console.log('[worker] ════════════════════════════════');

  try {
    // 1. Fetch all problems from CF API
    const allProblems = await fetchAllProblems();

    // 2. Load already-scraped IDs from MongoDB
    console.log('[worker] Checking MongoDB for already-scraped problems ...');
    const indexCol = await getIndexCollection();
    const indexDoc = await indexCol.findOne({});
    const scrapedIds = new Set(indexDoc?.ids || []);
    console.log(`[worker] Already scraped: ${scrapedIds.size} / ${allProblems.length} problems`);

    // 3. Diff — only new problems
    const newProblems = allProblems.filter(p => !scrapedIds.has(`${p.contestId}-${p.index}`));
    console.log(`[worker] New problems to scrape: ${newProblems.length}`);

    if (newProblems.length === 0) {
      console.log('[worker] ✓ All problems are up to date — nothing to do');
      return { scraped: 0, skipped: 0, total: allProblems.length };
    }

    const problemsCol = await getProblemsCollection();
    let scraped = 0;
    let failed  = 0;

    for (const p of newProblems) {
      const id = `${p.contestId}-${p.index}`;
      const progress = `(${scraped + failed + 1}/${newProblems.length})`;

      try {
        console.log(`[worker] ${progress} Starting: ${id} — "${p.name}"`);

        const doc = await scrapeProblem(p.contestId, p.index);

        // Save problem JSON to problems collection
        await problemsCol.insertOne(doc);
        console.log(`[worker] ✓ Saved ${id} to problems collection`);

        // Update the index
        await indexCol.updateOne({}, { $addToSet: { ids: id } }, { upsert: true });
        console.log(`[worker] ✓ Updated problem_index with ${id}`);

        scraped++;
        console.log(`[worker] ${progress} Done: ${id} ✓  (total scraped: ${scraped})`);
      } catch (err) {
        failed++;
        console.error(`[worker] ${progress} ✗ Failed: ${id} — ${err.message}`);
      }

      // Wait 10s before next (skip delay after last one)
      if (scraped + failed < newProblems.length) {
        console.log(`[worker] Waiting ${SCRAPE_DELAY_MS / 1000}s before next problem...`);
        await sleep(SCRAPE_DELAY_MS);
      }
    }

    console.log('[worker] ════════════════════════════════');
    console.log(`[worker] Sync complete — scraped: ${scraped}, failed: ${failed}, total CF: ${allProblems.length}`);
    console.log('[worker] ════════════════════════════════');
    return { scraped, failed, total: allProblems.length };

  } catch (err) {
    console.error('[worker] ✗ Sync crashed:', err.message);
    throw err;
  }
}
