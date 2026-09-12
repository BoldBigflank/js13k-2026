import { octavePerlin2 } from "./libraries/Perlin.js";
import { COLORS, colorLerp, RAINBOW_COLORS } from "./Utils.ts";

// W caches uploaded GL textures by canvas.id (see W.textures / W.setState), so every
// generated texture canvas needs a unique id or later textures will silently reuse
// whichever GL texture was cached first (they all default to id === '' otherwise).
let pc = 0;

const _textures: Record<string, HTMLCanvasElement> = {};

const uniqueCanvas = (size: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.id = `w-texture-${pc++}`;
  c.width = c.height = size;
  return c;
};

export const textTexture = (canvasSize: number, lines: string[]) => {
  const canvasRatio = 5
  const key = `text-${lines.join('-')}-${canvasSize}`;
  if (_textures[key]) {
    return _textures[key];
  }
  const canvas = uniqueCanvas(canvasSize);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error();
  }

  ctx.scale(1, canvasRatio);
  // ctx.fillStyle = '#ff00ff';
  // ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.font = `${canvasSize / (4 * canvasRatio)}px Arial`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'black';
  let y = 0;
  for (const line of lines) {
    ctx.fillText(line, 0.5 * canvasSize, y);
    y += canvasSize / (4 * canvasRatio);
  }
  _textures[key] = canvas;
  return canvas;
};

export const perlinTexture = (
  startColor = "#000000",
  endColor = "#ffffff",
  size = 64,
  scale = 2,
  octaves = 2,
  persistence = 0.5,
) => {
  const key = `perlin-${startColor}-${endColor}-${size}-${scale}-${octaves}-${persistence}`;
  if (_textures[key]) {
    return _textures[key];
  }
  const c = uniqueCanvas(size);
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error();
  }
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const value = octavePerlin2(nx, ny, scale, octaves, persistence);
      ctx.fillStyle = colorLerp(startColor, endColor, value);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  _textures[key] = c;
  return c;
};

export const rainbowTexture = (canvasSize = 1024) => {
  const key = `rainbow-${canvasSize}`;
  if (_textures[key]) {
    return _textures[key];
  }
  const c = uniqueCanvas(canvasSize);
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error();
  }
  ctx.imageSmoothingEnabled = false;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasSize);
  let i = 0;
  for (const color of Object.values(RAINBOW_COLORS)) {
    gradient.addColorStop(i / Object.values(RAINBOW_COLORS).length, color);
    i++;
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  _textures[key] = c;
  return c;
};

export const colorTexture = (canvasSize = 1024, color = COLORS.RED) => {
  const key = `${canvasSize}-${color}`;
  if (_textures[key]) {
    return _textures[key];
  }
  const c = uniqueCanvas(canvasSize);
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error();
  }
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  _textures[key] = c;
  return c;
};

const colorTextures = Object.values(COLORS).map((color) =>
  colorTexture(1024, color),
);
// return an array of each texture function
// The order determines the index when exporting, so add new textures to the end.
export const textures = [
  ...colorTextures,
  rainbowTexture(),
  perlinTexture(),
];

export const getTextureByIndex = (textureIndex: number): HTMLCanvasElement | undefined => {
  if (textureIndex < 0 || textureIndex >= textures.length) {
    return undefined;
  }
  return textures[textureIndex];
};
