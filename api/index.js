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

  // GET /image/:filename — returns binary image from MongoDB
  if (pathname.startsWith('/image/')) {
    const filename = pathname.slice('/image/'.length);
    if (!filename) {
      return res.status(400).json({ error: 'Missing filename' });
    }

    try {
      const imagesCol = await getImagesCollection();
      const doc = await imagesCol.findOne({ filename });

      if (!doc) {
        return res.status(404).json({ error: `Image ${filename} not found` });
      }

      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).end(doc.data.buffer);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /problem/:contestId/:index — returns cached problem from MongoDB
  if (pathname.startsWith('/problem/')) {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid format. Use /problem/:contestId/:index' });
    }

    const contestId = parseInt(parts[1], 10);
    const index = parts[2].toUpperCase();

    if (isNaN(contestId)) {
      return res.status(400).json({ error: 'Invalid contestId' });
    }

    try {
      const problems = await getProblemsCollection();
      const cached = await problems.findOne({ contestId, index });

      if (!cached) {
        return res.status(404).json({ error: `Problem ${contestId}${index} not found. Try /sync first.` });
      }

      return res.status(200).json(cached);
    } catch (err) {
      console.error('[api] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /index — returns list of all scraped problem IDs
  if (pathname === '/index') {
    try {
      const indexCol = await getIndexCollection();
      const doc = await indexCol.findOne({});
      const ids = doc?.ids || [];
      return res.status(200).json({ ids, count: ids.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /sync — triggers background sync (scrapes new problems)
  if (pathname === '/sync' && req.method === 'POST') {
    try {
      // Run sync in background (don't await — let it run async)
      syncProblems()
        .then(result => console.log('[api] Sync complete:', result))
        .catch(err => console.error('[api] Sync error:', err));

      return res.status(202).json({
        message: 'Sync started in background. Check logs for progress.',
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET / — health check
  if (pathname === '/') {
    try {
      const indexCol = await getIndexCollection();
      const doc = await indexCol.findOne({});
      const count = doc?.ids?.length || 0;

      return res.status(200).json({
        status: 'ok',
        service: 'cf-scraper',
        scraped: count,
      });
    } catch (err) {
      return res.status(200).json({
        status: 'ok',
        service: 'cf-scraper',
        dbError: err.message,
      });
    }
  }

  res.status(404).json({ error: 'Not found' });
}
