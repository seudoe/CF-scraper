import { Binary } from 'mongodb';
import { fetchHtml, fetchImageAsBuffer } from './fetch.js';
import { parseProblemPage } from './parse.js';
import { getImagesCollection } from './db.js';

const CF_BASE = 'https://codeforces.com';

function buildProblemUrl(contestId, index) {
  return `${CF_BASE}/problemset/problem/${contestId}/${index}`;
}

/**
 * Generates a stable filename for an image given its src URL and problem key.
 * e.g. "1234-A_img_espou3jk.png"
 */
function makeFilename(src, problemKey) {
  const url = src.startsWith('http') ? new URL(src) : new URL(src, CF_BASE);
  const ext = url.pathname.match(/\.\w+$/)?.[0] || '.png';
  // Take last segment of the path, sanitized
  const base = url.pathname.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'img';
  return `${problemKey}_${base}${base.endsWith(ext) ? '' : ext}`;
}

/**
 * Downloads an image, saves it to the images collection as binary,
 * and returns the filename reference (used in the problem JSON).
 * If already saved, skips the download.
 */
async function saveImage(src, problemKey) {
  const absUrl = src.startsWith('http') ? src : new URL(src, CF_BASE).href;
  const filename = makeFilename(src, problemKey);

  const imagesCol = await getImagesCollection();

  // Skip if already saved
  const existing = await imagesCol.findOne({ filename });
  if (existing) {
    return filename;
  }

  const { buffer, contentType } = await fetchImageAsBuffer(absUrl);

  await imagesCol.insertOne({
    problemId: problemKey,          // index: which problem owns this image
    filename,                       // unique stable name
    contentType,
    data: new Binary(buffer),       // raw binary blob
    cachedAt: Math.floor(Date.now() / 1000),
  });

  return filename;
}

/**
 * Walk blocks and replace src URLs with saved filenames.
 * Block becomes: { type: 'image', src: 'cf-image://1234-A_img.png', alt: '...' }
 * The extension fetches GET /image/:filename to retrieve the binary.
 */
async function rewriteImages(blocks, problemKey) {
  for (const block of blocks) {
    if (block.type === 'image') {
      try {
        const filename = await saveImage(block.src, problemKey);
        block.src = `cf-image://${filename}`;
      } catch (e) {
        console.warn(`[scraper] Failed to save image for ${problemKey}: ${e.message}`);
        // Leave original src intact as fallback
      }
    }
  }
}

/**
 * Scrapes a Codeforces problem page, saves images to MongoDB images collection,
 * and returns a structured CachedProblem object ready to insert into problems collection.
 */
export async function scrapeProblem(contestId, index) {
  const problemKey = `${contestId}-${index}`;
  const url = buildProblemUrl(contestId, index);

  console.log(`[scraper] Fetching ${url}`);
  const html = await fetchHtml(url);

  const statement = parseProblemPage(html);
  if (!statement) {
    throw new Error(`Could not parse problem statement from ${url}`);
  }

  // Save all images to DB and rewrite srcs to cf-image:// refs
  const sections = [
    statement.description,
    statement.input,
    statement.output,
    ...(statement.note ? [statement.note] : []),
  ];
  for (const section of sections) {
    await rewriteImages(section, problemKey);
  }

  return {
    contestId,
    index,
    cachedAt: Math.floor(Date.now() / 1000),
    version: 1,
    statement,
  };
}
