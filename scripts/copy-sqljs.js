#!/usr/bin/env node
// Copies the sql.js WebAssembly build into public/ so the web version loads it from its own site (no CDN).
const fs = require('fs');
const path = require('path');

const src = path.dirname(require.resolve('sql.js/dist/sql-wasm.js'));
const out = path.join(__dirname, '..', 'public');
fs.mkdirSync(out, { recursive: true });
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) fs.copyFileSync(path.join(src, f), path.join(out, f));
