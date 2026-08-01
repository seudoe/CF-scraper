import puppeteer from 'puppeteer';

const PAGE_TIMEOUT_MS = 30000;

let browser;

async function getBrowser() {
  if (browser && browser.connected) { return browser; }

  console.log('[fetch] Launching headless Chrome...');

  // On Render, Chrome is installed to /opt/render/.cache/puppeteer by the build step.
  // Puppeteer reads PUPPETEER_CACHE_DIR env var — set it in Render dashboard if needed.
  // Locally, puppeteer finds Chrome automatically from its default cache.
  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',           // more stable on low-memory containers
    ],
  });

  console.log('[fetch] ✓ Browser launched');
  return browser;
}

/** Fetches a URL using headless Chrome — bypasses Cloudflare bot detection. */
export async function fetchHtml(targetUrl) {
  console.log(`[fetch] Fetching HTML: ${targetUrl}`);
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_TIMEOUT_MS,
    });

    const html = await page.content();
    console.log(`[fetch] ✓ Got HTML for ${targetUrl} (${(html.length / 1024).toFixed(1)} KB)`);
    return html;
  } finally {
    await page.close();
  }
}

/** Fetches an image and returns { buffer, contentType }. */
export async function fetchImageAsBuffer(targetUrl) {
  console.log(`[fetch] Fetching image: ${targetUrl}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://codeforces.com/',
        'Accept': 'image/*,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${targetUrl}`);
  }

  const contentType = res.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[fetch] ✓ Got image (${contentType}, ${(buffer.length / 1024).toFixed(1)} KB)`);
  return { buffer, contentType };
}

process.on('exit', () => { browser?.close(); });
process.on('SIGINT', () => { browser?.close(); process.exit(); });
