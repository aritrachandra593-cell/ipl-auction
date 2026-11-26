// One-time asset builder: fills remaining photos from ESPNcricinfo headshots.
// Run from the ipl-auction folder: node tools/fetch-espn-missing.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('../public/players-data.js');
require('../public/seasons.js');

const utils = require('./fetch-ipl-player-images.js');
const Core = require('../public/auction-core.js');
const { normalize, keyFor, targetNames, slug } = utils;

const ROOT = path.join(__dirname, '..', 'public');
const IMAGE_DIR = path.join(ROOT, 'images', 'players');
const OUTPUT = path.join(ROOT, 'player-images.js');
const UA = 'IPL-Auction-Mock/1.0 (fan demo; source attribution included)';
const PLACEHOLDER_HASH = '1f9fb0ae0e050ad7c0521008e034e3f9';

const manifest = { ...utils.existing };

function hash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function shownNames() {
  const names = new Set();
  ['2025', '2027'].forEach((season) => {
    const game = Core.createGame({ season, mode: 'solo', ownerTeam: 'CSK' });
    game.players.forEach((p) => names.add(p.name));
    game.teams.forEach((t) => t.squad.forEach((p) => names.add(p.name)));
  });
  return [...names].filter(Boolean).sort();
}

async function findHeadshot(name) {
  const url = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=10&sport=cricket`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = await res.json();
  const candidates = (data.results || []).filter((r) => r.type === 'player').flatMap((r) => r.contents || []);
  const player = candidates.find((p) => /^s:200~a:\d+$/.test(p.uid || '') && normalize(p.displayName) === normalize(name));
  if (!player) return null;
  const image = player.image && player.image.default;
  if (!image || image.includes('default-player-logo')) return null;
  const id = (player.uid.match(/a:(\d+)/) || [])[1];
  const shot = await fetch(image, { headers: { 'User-Agent': UA } });
  if (!shot.ok) return null;
  const bytes = Buffer.from(await shot.arrayBuffer());
  if (bytes.length < 50000 || hash(bytes) === PLACEHOLDER_HASH) return null;
  return {
    bytes,
    id,
    source: player.link && player.link.web ? player.link.web : `https://www.espncricinfo.com/cricketers/${slug(name)}-${id}`
  };
}

async function main() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  // First repair alias spellings that already share a downloaded photo.
  const targets = targetNames();
  targets.forEach((name) => {
    if (manifest[name]) return;
    const key = keyFor(name);
    const match = targets.find((other) => other !== name && keyFor(other) === key && manifest[other]);
    if (match) manifest[name] = { ...manifest[match] };
  });

  const missing = shownNames().filter((name) => !manifest[name]);
  const added = [];

  for (const name of missing) {
    try {
      const found = await findHeadshot(name);
      if (!found) {
        process.stdout.write(`no photo ${name}\n`);
        continue;
      }
      const filename = `espn-${slug(name)}-${found.id}.png`;
      fs.writeFileSync(path.join(IMAGE_DIR, filename), found.bytes);
      const info = {
        src: `images/players/${filename}`,
        source: found.source,
        file: `ESPNcricinfo headshot ${found.id}`,
        license: '© ESPNcricinfo (source-linked fan use)',
        artist: 'ESPNcricinfo player headshot'
      };
      manifest[name] = info;
      targets.forEach((other) => {
        if (other !== name && keyFor(other) === keyFor(name) && !manifest[other]) manifest[other] = { ...info };
      });
      added.push(name);
      process.stdout.write(`saved ${name}\n`);
    } catch (err) {
      process.stdout.write(`skip ${name}: ${err.message}\n`);
    }
  }

  const sorted = {};
  Object.keys(manifest).sort().forEach((name) => { sorted[name] = manifest[name]; });
  const body = `// Generated from Wikipedia/Wikimedia Commons, official iplt20.com team thumbnails and ESPNcricinfo headshots.\n` +
    `// IPL and ESPN images are © their respective owners and are used here with source attribution.\n` +
    `(function (root) {\n` +
    `  root.IPL_PLAYER_IMAGES = ${JSON.stringify(sorted, null, 2)};\n\n` +
    `  if (typeof module !== "undefined" && module.exports) module.exports = root.IPL_PLAYER_IMAGES;\n` +
    `})(typeof window !== "undefined" ? window : globalThis);\n`;
  fs.writeFileSync(OUTPUT, body);

  const stillMissing = shownNames().filter((name) => !sorted[name]);
  process.stdout.write(`\nManifest: ${Object.keys(sorted).length} names. Added ${added.length} ESPN photos. Still missing ${stillMissing.length}: ${stillMissing.join(', ')}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
