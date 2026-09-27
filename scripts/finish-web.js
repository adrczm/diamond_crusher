#!/usr/bin/env node
// After `expo export --platform web`: fills in the site path in index.html and adds 404.html, so a page reload on a
// deeper address (e.g. /settings) still opens the app on static hosts such as GitHub Pages.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const base = (process.env.DC_WEB_BASE ?? '').replace(/\/$/, '');
const file = path.join(dist, 'index.html');
const html = fs.readFileSync(file, 'utf8').replaceAll('%WEB_PUBLIC_URL%', base);
fs.writeFileSync(file, html);
fs.writeFileSync(path.join(dist, '404.html'), html);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`Web build ready in dist/ (site path: ${base || '/'})`);
