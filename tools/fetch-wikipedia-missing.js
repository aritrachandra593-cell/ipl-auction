// One-time asset builder: fills the remaining player photos from Wikipedia.
// Run from the ipl-auction folder: node tools/fetch-wikipedia-missing.js
const fs = require('fs');
const path = require('path');

const utils = require('./fetch-ipl-player-images.js');
const { normalize, keyFor, targetNames, slug } = utils;

const ROOT = path.join(__dirname, '..', 'public');
const IMAGE_DIR = path.join(ROOT, 'images', 'players');
const OUTPUT = path.join(ROOT, 'player-images.js');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'IPL-Auction-Mock/1.1 (local demo; image attribution included)';
const BATCH = 40;
const CONCURRENCY = 1;

const manifest = { ...utils.existing };

async function api(params, attempt = 0) {
  const url = new URL(API);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 && attempt < 8) {
    await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)));
    return api(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const data = await res.json();
  if (!data.query && !data.error) throw new Error('Wikipedia API returned no query data');
  return data;
}

function stripHTML(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function aliasesFrom(data) {
  const aliases = {};
  (data.query.normalized || []).forEach((n) => { aliases[n.from] = n.to; });
  (data.query.redirects || []).forEach((r) => { aliases[r.from] = r.to; });
  return aliases;
}

function canonicalTitle(name, aliases) {
  let title = name;
  const seen = new Set();
  while (aliases[title] && !seen.has(title)) {
    seen.add(title);
    title = aliases[title];
  }
  return title;
}

function scoreMatch(name, title) {
  const wanted = normalize(name).split(' ').filter(Boolean);
  const found = normalize(title).split(' ').filter(Boolean);
  const overlap = wanted.filter((word) => found.includes(word)).length;
  return overlap / Math.max(wanted.length, found.length);
}

async function exactImages(names) {
  const found = {};
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    const data = await api({
      action: 'query',
      prop: 'pageimages',
      piprop: 'thumbnail|name',
      pithumbsize: '420',
      redirects: '1',
      format: 'json',
      titles: batch.join('|')
    });
    const aliases = aliasesFrom(data);
    const pages = Object.values(data.query.pages || {});
    batch.forEach((name) => {
      const title = canonicalTitle(name, aliases);
      const page = pages.find((item) => item.title === title);
      if (page && page.thumbnail && page.thumbnail.source && page.pageimage) {
        found[name] = {
          title,
          file: `File:${page.pageimage}`,
          source: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          thumb: page.thumbnail.source
        };
      }
    });
    process.stdout.write(`exact pages: ${Math.min(i + BATCH, names.length)}/${names.length}\n`);
  }
  return found;
}

async function searchImage(name) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: name,
    gsrnamespace: '0',
    gsrlimit: '5',
    prop: 'pageimages',
    piprop: 'thumbnail|name',
    pithumbsize: '420',
    redirects: '1',
    format: 'json'
  });
  const candidates = Object.values(data.query.pages || {})
    .filter((page) => page.thumbnail && page.thumbnail.source && page.pageimage)
    .filter((page) => !/\((actor|sportscaster|soldier|politician|footballer|musician|singer|journalist|baseball|basketball|rugby)\)/i.test(page.title))
    .map((page) => ({ page, score: scoreMatch(name, page.title) }))
    .filter((item) => item.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const { page } = candidates[0];
  return {
    title: page.title,
    file: `File:${page.pageimage}`,
    source: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    thumb: page.thumbnail.source
  };
}

async function collectCredits(entries) {
  const files = [...new Set(Object.values(entries).map((entry) => entry.file))];
  const credits = {};
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const data = await api({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'extmetadata',
      format: 'json',
      titles: batch.join('|')
    });
    Object.values(data.query.pages || {}).forEach((page) => {
      const info = page.imageinfo && page.imageinfo[0];
      if (!info) return;
      const meta = info.extmetadata || {};
      credits[page.title.replace(/ /g, '_')] = {
        license: stripHTML(meta.LicenseShortName && meta.LicenseShortName.value) || 'See source',
        artist: stripHTML(meta.Artist && meta.Artist.value) || 'Wikimedia Commons contributor'
      };
    });
  }
  return credits;
}

function extensionFromURL(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
}

async function download(name, entry) {
  const res = await fetch(entry.thumb, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) throw new Error('tiny image');
  const filename = `wiki-${slug(name)}${extensionFromURL(entry.thumb)}`;
  fs.writeFileSync(path.join(IMAGE_DIR, filename), bytes);
  return `images/players/${filename}`;
}

async function main() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  const allTargets = targetNames().filter((name) => !manifest[name]);
  const exact = await exactImages(allTargets);
  const stillMissing = allTargets.filter((name) => !exact[name]);

  let cursor = 0;
  async function worker() {
    while (cursor < stillMissing.length) {
      const name = stillMissing[cursor++];
      try {
        const found = await searchImage(name);
        if (found) exact[name] = found;
      } catch (err) {
        process.stdout.write(`search skip ${name}: ${err.message}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const credits = await collectCredits(exact);
  let cursorDownload = 0;
  const downloaded = {};
  async function downloadWorker() {
    while (cursorDownload < allTargets.length) {
      const name = allTargets[cursorDownload++];
      const entry = exact[name];
      if (!entry) continue;
      try {
        downloaded[name] = await download(name, entry);
        process.stdout.write(`saved ${name}\n`);
      } catch (err) {
        process.stdout.write(`download skip ${name}: ${err.message}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, downloadWorker));

  Object.keys(downloaded).forEach((name) => {
    const entry = exact[name];
    const credit = credits[entry.file] || {};
    const info = {
      src: downloaded[name],
      source: entry.source,
      file: entry.file,
      license: credit.license || 'See source',
      artist: credit.artist || 'Wikimedia Commons contributor'
    };
    manifest[name] = info;
    // All spellings of the same player share one photo.
    targetNames().forEach((other) => {
      if (other !== name && keyFor(other) === keyFor(name) && !manifest[other]) manifest[other] = { ...info };
    });
  });

  const sorted = {};
  Object.keys(manifest).sort().forEach((name) => { sorted[name] = manifest[name]; });
  const body = `// Generated from Wikipedia/Wikimedia Commons and official iplt20.com team thumbnails.\n` +
    `// IPL images are © IPL/franchises and are used here with source attribution.\n` +
    `(function (root) {\n` +
    `  root.IPL_PLAYER_IMAGES = ${JSON.stringify(sorted, null, 2)};\n\n` +
    `  if (typeof module !== "undefined" && module.exports) module.exports = root.IPL_PLAYER_IMAGES;\n` +
    `})(typeof window !== "undefined" ? window : globalThis);\n`;
  fs.writeFileSync(OUTPUT, body);

  const missing = allTargets.filter((name) => !sorted[name]);
  process.stdout.write(`\nManifest: ${Object.keys(sorted).length} names. Added ${Object.keys(downloaded).length} Wikipedia photos. Still missing ${missing.length}: ${missing.join(', ')}\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
