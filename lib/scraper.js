import { Binary } from 'mongodb';
import { fetchHtml, fetchImageAsBuffer } from './fetch.js';
import { parseProblemPage } from './parse.js';
import { getImagesCollection } from './db.js';

const CF_BASE = 'https://codeforces.com';

function buildProblemUrl(contestId, index) {
  return `${CF_BASE}/problemset/problem/${contestId}/${index}`;
}

function makeFilename(src, problemKey) {
  const url = src.startsWith('http') ? new URL(src) : new URL(src, CF_BASE);
  const ext  = url.pathname.match(/\.\w+$/)?.[0] || '.png';
  const base = url.pathname.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'img';
  return `${problemKey}_${base}${base.endsWith(ext) ? '' : ext}`;
}

async function saveImage(src, problemKey) {
  const absUrl  = src.startsWith('http') ? src : new URL(src, CF_BASE).href;
  const filename = makeFilename(src, problemKey);
  const imagesCol = await getImagesCollection();

  const existing = await imagesCol.findOne({ filename });
  if (existing) {
    console.log(`[scraper] Image already saved, skipping: ${filename}`);
    return filename;
  }

  console.log(`[scraper] Saving image to DB: ${filename}`);
  const { buffer, contentType } = await fetchImageAsBuffer(absUrl);

  await imagesCol.insertOne({
    problemId: problemKey,
    filename,
    contentType,
    data: new Binary(buffer),
    cachedAt: Math.floor(Date.now() / 1000),
  });

  console.log(`[scraper] ✓ Image saved: ${filename} (${contentType}, ${(buffer.length / 1024).toFixed(1)} KB)`);
  return filename;
}

async function rewriteImages(blocks, problemKey) {
  const imageBlocks = blocks.filter(b => b.type === 'image');
  if (imageBlocks.length > 0) {
    console.log(`[scraper] Processing ${imageBlocks.length} image(s) for ${problemKey}`);
  }
  for (const block of imageBlocks) {
    try {
      const filename = await saveImage(block.src, problemKey);
      block.src = `cf-image://${filename}`;
    } catch (e) {
      console.warn(`[scraper] ✗ Failed to save image for ${problemKey}: ${e.message}`);
    }
  }
}

export async function scrapeProblem(contestId, index) {
  const problemKey = `${contestId}-${index}`;
  const url = buildProblemUrl(contestId, index);

  console.log(`[scraper] ── Scraping ${problemKey} ──`);
  console.log(`[scraper] Fetching webpage: ${url}`);
  const html = await fetchHtml(url);

  console.log(`[scraper] Parsing ${problemKey} ...`);
  const statement = parseProblemPage(html, problemKey);
  if (!statement) {
    throw new Error(`Could not parse problem statement for ${problemKey}`);
  }

  const sections = [
    statement.description,
    statement.input,
    statement.output,
    ...(statement.note ? [statement.note] : []),
  ];

  const totalImages = sections.flat().filter(b => b.type === 'image').length;
  if (totalImages > 0) {
    console.log(`[scraper] Found ${totalImages} image(s) across all sections for ${problemKey}`);
  }

  for (const section of sections) {
    await rewriteImages(section, problemKey);
  }

  const result = {
    contestId,
    index,
    cachedAt: Math.floor(Date.now() / 1000),
    version: 1,
    statement,
  };

  console.log(`[scraper] ✓ Scrape complete for ${problemKey}: "${statement.title}"`);
  return result;
}
