// One-time asset builder: downloads free player thumbnails from Wikipedia/Wikimedia Commons.
// Run from the ipl-auction folder: node tools/fetch-player-images.js
const fs = require('fs');
const path = require('path');

require('../public/players-data.js');

const ROOT = path.join(__dirname, '..', 'public');
const IMAGE_DIR = path.join(ROOT, 'images', 'players');
const OUTPUT = path.join(ROOT, 'player-images.js');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'IPL-Auction-Mock/1.0 (local demo; image attribution included)';
const BATCH = 50;
const CONCURRENCY = 8;

const players = globalThis.IPL_PLAYER_DATA || [];

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

async function api(params) {
  const url = new URL(API);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return res.json();
}

function resolveAliasMap(data) {
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

async function collectPageImages() {
  const byName = {};
  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH);
    const data = await api({
      action: 'query',
      prop: 'pageimages',
      piprop: 'thumbnail|name',
      pithumbsize: '420',
      format: 'json',
      redirects: '1',
      titles: batch.map((p) => p.name).join('|')
    });
    const aliases = resolveAliasMap(data);
    const pages = Object.values(data.query.pages);
    batch.forEach((p) => {
      const title = canonicalTitle(p.name, aliases);
      const page = pages.find((item) => item.title === title);
      if (page && page.thumbnail && page.thumbnail.source && page.pageimage) {
        byName[p.name] = {
          title,
          file: `File:${page.pageimage}`,
          source: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          thumb: page.thumbnail.source
        };
      }
    });
    process.stdout.write(`page images: ${Math.min(i + BATCH, players.length)}/${players.length}\n`);
  }
  return byName;
}

async function collectCredits(entries) {
  const files = [...new Set(Object.values(entries).map((e) => e.file))];
  const byFile = {};
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const data = await api({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'extmetadata',
      format: 'json',
      titles: batch.join('|')
    });
    Object.values(data.query.pages).forEach((page) => {
      const info = page.imageinfo && page.imageinfo[0];
      if (!info) return;
      const meta = info.extmetadata || {};
      byFile[page.title.replace(/ /g, '_')] = {
        license: stripHTML(meta.LicenseShortName && meta.LicenseShortName.value) || 'See source',
        artist: stripHTML(meta.Artist && meta.Artist.value) || 'Wikimedia Commons contributor'
      };
    });
    process.stdout.write(`credits: ${Math.min(i + BATCH, files.length)}/${files.length}\n`);
  }
  return byFile;
}

function extensionFromURL(url) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
}

async function downloadOne(entry) {
  const res = await fetch(entry.thumb, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) throw new Error('tiny image');
  const filename = `${slug(entry.name)}${extensionFromURL(entry.thumb)}`;
  fs.writeFileSync(path.join(IMAGE_DIR, filename), bytes);
  return `images/players/${filename}`;
}

async function downloadAll(entries) {
  const names = Object.keys(entries);
  const output = {};
  let cursor = 0;
  async function worker() {
    while (cursor < names.length) {
      const name = names[cursor++];
      try {
        output[name] = await downloadOne({ ...entries[name], name });
      } catch (err) {
        process.stdout.write(`skip ${name}: ${err.message}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return output;
}

async function main() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const pages = await collectPageImages();
  const credits = await collectCredits(pages);
  const thumbs = await downloadAll(pages);
  const manifest = {};

  Object.keys(thumbs).sort().forEach((name) => {
    const page = pages[name];
    const credit = credits[page.file] || {};
    manifest[name] = {
      src: thumbs[name],
      source: page.source,
      file: page.file,
      license: credit.license || 'See source',
      artist: credit.artist || 'Wikimedia Commons contributor'
    };
  });

  const body = `// Generated by tools/fetch-player-images.js from Wikipedia/Wikimedia Commons.\n` +
    `(function (root) {\n` +
    `  root.IPL_PLAYER_IMAGES = ${JSON.stringify(manifest, null, 2)};\n\n` +
    `  if (typeof module !== "undefined" && module.exports) module.exports = root.IPL_PLAYER_IMAGES;\n` +
    `})(typeof window !== "undefined" ? window : globalThis);\n`;
  fs.writeFileSync(OUTPUT, body);
  process.stdout.write(`\nSaved ${Object.keys(manifest).length} player photos for ${players.length} players.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
