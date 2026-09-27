// The app's colours, spacing and type come from Shopify Polaris tokens; the generated file must match the package.
import fs from 'fs';
import path from 'path';

test('src/ui/polaris.ts is up to date with @shopify/polaris-tokens', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { body } = require('../../scripts/polaris-tokens.js');
  expect(fs.readFileSync(path.join(__dirname, '../../src/ui/polaris.ts'), 'utf8')).toBe(body);
});
