const { join } = require('path');

/**
 * Puppeteer cache config.
 * On Render: Chrome installs to /opt/render/.cache/puppeteer (set via env var).
 * Locally: uses default ~/.cache/puppeteer.
 */
module.exports = {
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(process.env.HOME || '.', '.cache', 'puppeteer'),
};
