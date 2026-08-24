/**
 * Sitemap & URL Crawler Engine
 * Fetches and parses sitemap.xml or crawls page links.
 */

const https = require('https');
const http = require('http');

/**
 * Fetch text content from URL
 */
function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith('https') ? https : http;
    const req = client.get(urlStr, { headers: { 'User-Agent': 'HeadlessBrowserTest/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout fetching ' + urlStr));
    });
  });
}

/**
 * Parse XML sitemap and extract list of URLs
 */
async function parseSitemap(sitemapUrl) {
  try {
    const xml = await fetchUrl(sitemapUrl);
    const urls = [];
    const locRegex = /<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
      const url = match[1].trim();
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    return urls;
  } catch (err) {
    console.error('Failed to parse sitemap:', err.message);
    return [];
  }
}

module.exports = {
  parseSitemap,
  fetchUrl
};
