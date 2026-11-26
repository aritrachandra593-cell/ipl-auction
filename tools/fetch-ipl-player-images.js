// One-time asset builder: adds official IPL squad thumbnails for players that
// do not already have a free Wikipedia/Wikimedia photo. Source snapshot comes
// from tools/ipl-squad-images.json, captured from iplt20.com team squad pages.
// Run from the ipl-auction folder: node tools/fetch-ipl-player-images.js
const fs = require('fs');
const path = require('path');

require('../public/players-data.js');
require('../public/seasons.js');

const ROOT = path.join(__dirname, '..', 'public');
const IMAGE_DIR = path.join(ROOT, 'images', 'players');
const OUTPUT = path.join(ROOT, 'player-images.js');
const SNAPSHOT = path.join(__dirname, 'ipl-squad-images.json');
const UA = 'IPL-Auction-Mock/1.0 (fan demo; source attribution included)';
const CONCURRENCY = 6;

const existing = require('../public/player-images.js');
const squadTeams = require(SNAPSHOT);
const cfg = globalThis.IPL_SEASONS['2027'] || {};

// Names that refer to the same player on different lists / on the IPL site.
const ALIAS_GROUPS = [
  ['Mitch Marsh', 'Mitchell Marsh'],
  ['Mitch Santner', 'Mitchell Santner'],
  ['R. Sai Kishore', 'Sai Kishore'],
  ['Digvesh Rathi', 'Digvesh Singh Rathi'],
  ['Akshat Raghuvanshi', 'Akshat Raghuwanshi'],
  ['Krans Fuletra', 'Krains Fuletra'],
  ['Smaran Ravichandran', 'Ravichandran Smaran'],
  ['Lhuan-dre Pretorius', 'Lhuan-dré Pretorius'],
  ['Aman Rao', 'Aman Rao Perala'],
  ['Harnoor Pannu', 'Harnoor Singh'],
  ['V Vyshak', 'Vijaykumar Vyshak'],
  ['Raj Angad Bawa', 'Raj Bawa'],
  ['AM Ghazanfar', 'Allah Ghazanfar'],
  ['MS Dhoni', 'Mahendra Singh Dhoni'],
  ['Fazalhaq Farooqi', 'Fazal Farooqi'],
  ['Varun Chakaravarthy', 'Varun Chakravarthy'],
  ['Digvesh Singh Rathi', 'Digvesh Singh'],
  ['Gurnoor Brar', 'Gurnoor Singh Brar'],
  ['Yarra Prithviraj', 'Prithviraj Yarra'],
  ['Avinash Pyla', 'Pyla Avinash'],
  ['Tejasvi Dahiya', 'Tejasvi Singh Dahiya'],
  ['Yudhvir Singh Charak', 'Yudhvir Charak', 'Yudhvir Singh'],
  ['Luvnith Sisodia', 'Luvinith Sisodia'],
  ['Mohammed Izhar', 'Md. Izhar'],
  ['Arshad Khan', 'Mohammad Arshad Khan'],
  ['Manimaran Siddharth', 'M Siddharth'],
  ['Abishek Porel', 'Abhishek Porel'],
  ['Pravin Dubey', 'Praveen Dubey'],
  ['Blessing Muzarabani', 'Blessing Muzarbani']
];

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const groupByVariant = new Map();
ALIAS_GROUPS.forEach((group) => {
  const canonical = normalize(group[0]);
  group.forEach((name) => groupByVariant.set(normalize(name), canonical));
});

function keyFor(name) {
  const key = normalize(name);
  return groupByVariant.get(key) || key;
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function targetNames() {
  const names = new Set((globalThis.IPL_PLAYER_DATA || []).map((p) => p.name));
  Object.values(cfg.retained || {}).flat().forEach((name) => names.add(name));
  Object.values(cfg.released || {}).flat().forEach((name) => names.add(name));
  (cfg.extraReleased || []).forEach((entry) => names.add(typeof entry === 'string' ? entry : entry.name));
  Object.keys(existing).forEach((name) => names.add(name));
  return [...names].filter(Boolean).sort();
}

function variantMap() {
  const map = new Map();
  ALIAS_GROUPS.forEach((group) => {
    const canonical = normalize(group[0]);
    map.set(canonical, group.slice());
  });
  return map;
}

function imageURL(entry) {
  const inner = `/api/team-assets?pathname=${encodeURIComponent(entry.path)}&brand=ipl`;
  return `https://www.iplt20.com/_next/image?url=${encodeURIComponent(inner)}&w=384&q=75`;
}

async function download(entry, displayName) {
  const res = await fetch(imageURL(entry), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000 || !String(res.headers.get('content-type') || '').includes('image')) throw new Error('invalid image');
  const id = entry.path.split('/').pop().replace(/\.png$/i, '');
  const filename = `ipl-${slug(displayName)}-${id}.png`;
  fs.writeFileSync(path.join(IMAGE_DIR, filename), bytes);
  return `images/players/${filename}`;
}

async function main() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  const targets = targetNames();
  const squad = new Map();
  squadTeams.forEach((team) => {
    (team.images || []).forEach((entry) => {
      const key = keyFor(entry.name);
      if (!squad.has(key)) squad.set(key, { ...entry, team: team.team });
    });
  });

  const haveByKey = new Map();
  Object.keys(existing).forEach((name) => {
    const key = keyFor(name);
    if (!haveByKey.has(key)) haveByKey.set(key, name);
  });

  const variants = variantMap();
  const needed = [];
  targets.forEach((name) => {
    const key = keyFor(name);
    if (haveByKey.has(key) || !squad.has(key) || needed.some((item) => item.key === key)) return;
    const group = variants.get(key) || [name];
    const displayName = group.find((n) => normalize(n) === key) || squad.get(key).name || name;
    needed.push({ key, displayName, entry: squad.get(key) });
  });

  let cursor = 0;
  const downloaded = new Map();
  async function worker() {
    while (cursor < needed.length) {
      const item = needed[cursor++];
      try {
        downloaded.set(item.key, await download(item.entry, item.displayName));
        process.stdout.write(`saved ${item.displayName}\n`);
      } catch (err) {
        process.stdout.write(`skip ${item.displayName}: ${err.message}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const manifest = { ...existing };

  // Copy existing photos across alias spellings used by different seasons.
  targets.forEach((name) => {
    if (manifest[name]) return;
    const sourceName = haveByKey.get(keyFor(name));
    if (sourceName && manifest[sourceName]) manifest[name] = { ...manifest[sourceName] };
  });

  // Add the newly downloaded official thumbnails under every known spelling.
  downloaded.forEach((src, key) => {
    const entry = squad.get(key);
    const info = {
      src,
      source: `https://www.iplt20.com/teams/${entry.team}/squad`,
      file: `Official IPL player thumbnail: ${entry.path}`,
      license: '© IPL / franchise (official team asset)',
      artist: 'IPL official team asset'
    };
    const names = new Set(targets.filter((name) => keyFor(name) === key));
    names.add(entry.name);
    (variants.get(key) || []).forEach((name) => names.add(name));
    names.forEach((name) => { manifest[name] = { ...info }; });
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

  const stillMissing = targets.filter((name) => !sorted[name]);
  process.stdout.write(`\nManifest: ${Object.keys(sorted).length} names. Downloaded ${downloaded.size} IPL photos. Still missing ${stillMissing.length}: ${stillMissing.join(', ')}\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { normalize, keyFor, targetNames, slug, existing, ALIAS_GROUPS };
