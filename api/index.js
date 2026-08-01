import { getProblemsCollection, getIndexCollection, getImagesCollection } from '../lib/db.js';
import { syncProblems } from '../lib/worker.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[api] ${req.method} ${pathname}`);

  // ── GET /image/:filename ──────────────────────────────────────────────────
  if (pathname.startsWith('/image/')) {
    const filename = pathname.slice('/image/'.length);
    if (!filename) {
      return res.status(400).json({ error: 'Missing filename' });
    }
    console.log(`[api] Fetching image from DB: ${filename}`);
    try {
      const imagesCol = await getImagesCollection();
      const doc = await imagesCol.findOne({ filename });
      if (!doc) {
        console.warn(`[api] Image not found: ${filename}`);
        return res.status(404).json({ error: `Image ${filename} not found` });
      }
      console.log(`[api] ✓ Serving image: ${filename} (${doc.contentType})`);
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).end(doc.data.buffer);
    } catch (err) {
      console.error(`[api] ✗ Error fetching image ${filename}:`, err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /problem/:contestId/:index ────────────────────────────────────────
  if (pathname.startsWith('/problem/')) {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid format. Use /problem/:contestId/:index' });
    }
    const contestId = parseInt(parts[1], 10);
    const index     = parts[2].toUpperCase();

    if (isNaN(contestId)) {
      return res.status(400).json({ error: 'Invalid contestId' });
    }

    console.log(`[api] Looking up problem ${contestId}-${index} in DB ...`);
    try {
      const problems = await getProblemsCollection();
      const cached = await problems.findOne({ contestId, index });
      if (!cached) {
        console.warn(`[api] Problem ${contestId}-${index} not found in DB`);
        return res.status(404).json({ error: `Problem ${contestId}${index} not found. Run /sync first.` });
      }
      console.log(`[api] ✓ Returning problem ${contestId}-${index}: "${cached.statement?.title}"`);
      return res.status(200).json(cached);
    } catch (err) {
      console.error(`[api] ✗ Error fetching problem ${contestId}-${index}:`, err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /index ────────────────────────────────────────────────────────────
  if (pathname === '/index') {
    console.log('[api] Fetching problem index ...');
    try {
      const indexCol = await getIndexCollection();
      const doc = await indexCol.findOne({});
      const ids = doc?.ids || [];
      console.log(`[api] ✓ Index has ${ids.length} scraped problems`);
      return res.status(200).json({ ids, count: ids.length });
    } catch (err) {
      console.error('[api] ✗ Error fetching index:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /sync (GET also accepted for easy browser testing) ─────────────
  if (pathname === '/sync') {
    console.log('[api] Sync requested — starting background worker ...');
    try {
      syncProblems()
        .then(result => console.log(`[api] Sync finished:`, result))
        .catch(err   => console.error('[api] Sync error:', err.message));

      return res.status(202).json({ message: 'Sync started. Check server logs for progress.' });
    } catch (err) {
      console.error('[api] ✗ Failed to start sync:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET / ─────────────────────────────────────────────────────────────────
  if (pathname === '/') {
    try {
      const indexCol = await getIndexCollection();
      const doc = await indexCol.findOne({});
      const count = doc?.ids?.length || 0;
      console.log(`[api] Health check — scraped problems: ${count}`);
      return res.status(200).json({ status: 'ok', service: 'cf-scraper', scraped: count });
    } catch (err) {
      console.error('[api] ✗ DB connection failed:', err.message);
      return res.status(200).json({ status: 'ok', service: 'cf-scraper', dbError: err.message });
    }
  }

  console.warn(`[api] 404 — unknown route: ${pathname}`);
  res.status(404).json({ error: 'Not found' });
}
