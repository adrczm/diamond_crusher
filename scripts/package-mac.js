#!/usr/bin/env node
// Packages the web build (dist/, built with no site path) as a folder you run on a Mac: the app files, a tiny local
// server that uses the Mac's own Perl, and a double-click launcher. Output: build/diamond-crusher-mac-<version>.zip
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const version = require('../package.json').version;
const out = path.join(root, 'build');
const folder = path.join(out, 'Diamond Crusher');
const zip = path.join(out, `diamond-crusher-mac-${version}.zip`);

if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Run the web build first: npm run build:web');
if (fs.readFileSync(path.join(dist, 'index.html'), 'utf8').includes('src="/diamond_crusher/'))
  throw new Error('dist/ was built for a site path; rebuild without DC_WEB_BASE.');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(folder, { recursive: true });
fs.cpSync(dist, path.join(folder, 'app'), { recursive: true });
for (const f of ['Start Diamond Crusher.command', 'app-server.pl', 'Read me.txt']) {
  fs.copyFileSync(path.join(root, 'mac', f), path.join(folder, f));
}
fs.chmodSync(path.join(folder, 'Start Diamond Crusher.command'), 0o755);
fs.chmodSync(path.join(folder, 'app-server.pl'), 0o755);

// zip keeps the executable bit, which the Mac needs to run the launcher.
execFileSync('zip', ['-qr', '-X', zip, 'Diamond Crusher'], { cwd: out, stdio: 'inherit' });
console.log(`Mac archive: ${path.relative(root, zip)}`);
