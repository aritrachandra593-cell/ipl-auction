// One-time cleanup: remove Wikipedia search matches that were not cricketers.
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, '..', 'public', 'player-images.js');
const images = require(MANIFEST);
const wrongNames = ['Daryl Mitchell', 'David Warner', 'Jack Edwards', 'Mohit Sharma'];

wrongNames.forEach((name) => {
  const entry = images[name];
  if (!entry) return;
  const file = path.join(__dirname, '..', 'public', entry.src);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  delete images[name];
});

const sorted = {};
Object.keys(images).sort().forEach((name) => { sorted[name] = images[name]; });

const body = '// Generated from Wikipedia/Wikimedia Commons, official iplt20.com team thumbnails and ESPNcricinfo headshots.\n' +
  '// IPL and ESPN images are © their respective owners and are used here with source attribution.\n' +
  '(function (root) {\n' +
  '  root.IPL_PLAYER_IMAGES = ' + JSON.stringify(sorted, null, 2) + ';\n\n' +
  '  if (typeof module !== "undefined" && module.exports) module.exports = root.IPL_PLAYER_IMAGES;\n' +
  '})(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(MANIFEST, body);
process.stdout.write(`Removed ${wrongNames.length} mismatched photos. Manifest now has ${Object.keys(sorted).length} names.\n`);
