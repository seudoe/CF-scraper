// Render.com entry point — persistent Node.js HTTP server
// No timeout limits, perfect for long-running sync worker

import { createServer } from 'http';
import handler from './api/index.js';

// Load .env.local when running locally
import './lib/env.js';

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  // Wrap the Vercel-style handler to work with Node's http module
  // Render injects PORT env var automatically
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };
  res.end = res.end.bind(res);

  handler(req, res).catch(err => {
    console.error('[server] Unhandled error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  });
});

server.listen(PORT, () => {
  console.log(`[server] CF Scraper running on port ${PORT}`);
  console.log(`[server] POST /sync   — start scraping`);
  console.log(`[server] GET  /       — health check`);
  console.log(`[server] GET  /problem/:contestId/:index`);
  console.log(`[server] GET  /image/:filename`);
  console.log(`[server] GET  /index  — list scraped IDs`);
});
