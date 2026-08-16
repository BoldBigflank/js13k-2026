import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "textures");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// textures.js builds canvases via document.createElement at import time —
// polyfill before the dynamic import so colorTextures can run under Node.
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`Unsupported element: ${tag}`);
    return createCanvas(1, 1);
  },
};

const { textures } = await import("../src/textures.js");

for (let i = 0; i < textures.length; i++) {
  const entry = textures[i];
  const canvas = typeof entry === "function" ? entry() : entry;
  const name =
    typeof entry === "function" ? entry.name || `texture-${i}` : `color-${i}`;
  const file = join(outDir, `${i}_${name}.png`);
  await writeFile(file, canvas.toBuffer("image/png"));
  console.log(`wrote ${file} (${canvas.width}x${canvas.height})`);
}
