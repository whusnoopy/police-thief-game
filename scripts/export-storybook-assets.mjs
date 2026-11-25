// Optional asset-authoring utility; normal builds use the committed WebP files.
// Run with sharp installed, or pass its module directory as the first argument.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const source = new URL('../experiments/storybook/assets/', import.meta.url);
const destination = new URL('../src/assets/storybook/', import.meta.url);
await mkdir(destination, { recursive: true });
const EDITOR_ASSETS = [
  'bank',
  'barrier',
  'building',
  'construction-site',
  'farm',
  'mountain',
  'police',
  'police-station',
  'thief',
  'thief-base',
];
for (const name of EDITOR_ASSETS) {
  await sharp(fileURLToPath(new URL(`${name}.png`, source)))
    .resize({ width: 192, height: 192, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 100, effort: 6 })
    .toFile(fileURLToPath(new URL(`${name}.webp`, destination)));
}
