import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from 'canvas';
import * as textures from '../src/textures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'textures');

// textures.js builds canvases via document.createElement — polyfill with node-canvas.
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`Unsupported element: ${tag}`);
    return createCanvas(1, 1);
  },
};

await mkdir(outDir, { recursive: true });

for (const [name, fn] of Object.entries(textures)) {
  if (typeof fn !== 'function') continue;
  const canvas = fn();
  const file = join(outDir, `${name}.png`);
  await writeFile(file, canvas.toBuffer('image/png'));
  console.log(`wrote ${file} (${canvas.width}x${canvas.height})`);
}
