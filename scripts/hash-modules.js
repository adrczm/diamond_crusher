// Regenerates src/content/en/questionnaires/manifest.json (QST-033). Run: node scripts/hash-modules.js
const fs = require('fs');
const path = require('path');
const { sha256 } = require('@noble/hashes/sha256');
const { bytesToHex, utf8ToBytes } = require('@noble/hashes/utils');

const dir = path.join(__dirname, '../src/content/en/questionnaires');
const out = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  .sort()
  .map((f) => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const { licence, ...rest } = m; // must match canonicalContent() in src/domain/questionnaire.ts
    void licence;
    return { moduleId: m.moduleId, version: m.version, contentHash: bytesToHex(sha256(utf8ToBytes(JSON.stringify(rest)))) };
  });
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
console.log(out);
