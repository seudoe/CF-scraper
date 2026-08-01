# CF Scraper Service

Serverless API for scraping and caching Codeforces problem statements. Deployed on Vercel, stores data in MongoDB.

## Setup

**Note:** The scraper may fail locally with HTTP 403 due to Cloudflare bot detection. This is expected — it works fine when deployed to Vercel.

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your MongoDB URI to `.env.local`:
   ```
   MONGODB_URI=mongodb+srv://...
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. **Skip local testing** — deploy directly to Vercel (CF blocks local scraping).

## Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Add the `MONGODB_URI` environment variable in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `MONGODB_URI` with your connection string
   - Redeploy

## API Endpoints

### `POST /sync`
Triggers background sync — fetches problem list from CF, scrapes new problems not yet in MongoDB. **10-second delay between each problem scrape.**

**Example:**
```bash
curl -X POST https://your-vercel-url.vercel.app/sync
```

**Response:**
```json
{
  "message": "Sync started in background. Check logs for progress."
}
```

**How it works:**
1. Fetches all problems from `https://codeforces.com/api/problemset.problems`
2. Compares with `problem_index` collection to find new problems
3. Scrapes each new problem HTML with 10s delay
4. Saves to `problems` collection
5. Updates `problem_index` with new IDs

### `GET /problem/:contestId/:index`
Returns a cached problem from MongoDB (must be scraped via `/sync` first).

**Example:**
```
GET https://your-vercel-url.vercel.app/problem/1234/A
```

**Response:**
```json
{
  "contestId": 1234,
  "index": "A",
  "cachedAt": 1704067200,
  "version": 1,
  "statement": {
    "title": "Beautiful Matrix",
    "timeLimit": "2 seconds",
    "memoryLimit": "256 megabytes",
    "description": [...],
    "input": [...],
    "output": [...],
    "examples": [
      { "input": "...", "output": "..." }
    ]
  }
}
```

### `GET /index`
Returns list of all scraped problem IDs.

**Response:**
```json
{
  "ids": ["1234-A", "1234-B", "5678-C"],
  "count": 3
}
```

### `GET /`
Health check + scraped problem count.

**Response:**
```json
{
  "status": "ok",
  "service": "cf-scraper",
  "scraped": 3
}
```

## MongoDB Collections

### `problems`
Stores full problem statements.

```js
{
  contestId: 1234,
  index: "A",
  cachedAt: 1704067200,
  version: 1,
  statement: { ... }
}
```

### `problem_index`
Tracks which problems have been scraped.

```js
{
  ids: ["1234-A", "1234-B", ...]
}
```

## Extension Integration

Update the VS Code extension to call your deployed service instead of scraping directly:

```ts
const SCRAPER_URL = 'https://your-vercel-url.vercel.app';

async function fetchProblem(contestId: number, index: string) {
  const res = await fetch(`${SCRAPER_URL}/problem/${contestId}/${index}`);
  return res.json();
}
```
