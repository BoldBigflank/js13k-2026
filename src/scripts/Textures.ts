import { octavePerlin2 } from "./libraries/Perlin";
import { COLORS, colorLerp } from "./Utils";

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

export const makeTexture = (size = 64) => {
  const key = `make-${size}`;
  if (_textures[key]) {
    return _textures[key];
  }
  const c = uniqueCanvas(size);
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get context");
  }
  ctx.imageSmoothingEnabled = false;
  const cells = 4;
  const cell = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#4a90d9" : "#e8c547";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  _textures[key] = c;
  return c;
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
    throw new Error("Failed to get context");
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

export const testTexture = (size = 64) => {
  const key = `test-${size}`;
  if (_textures[key]) {
    return _textures[key];
  }
  // grid of high contrasting squares
  const c = uniqueCanvas(size);
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get context");
  }
  ctx.imageSmoothingEnabled = false;
  const squareSize = size / 4;
  let index = 0;
  for (let y = 0; y < size; y += squareSize) {
    for (let x = 0; x < size; x += squareSize) {
      // Random opaque color
      const color = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, squareSize, squareSize);
      // Write the index of the square to the canvas
      ctx.font = `${squareSize}px Arial`;
      ctx.textBaseline = "top";
      ctx.fillStyle = "#000000";
      ctx.fillText(`${index}`, x, y);
      index++;
    }
  }
  _textures[key] = c;
  return c;
};

export const starTexture = (canvasSize = 1024) => {
  const key = `star-${canvasSize}`;
  if (_textures[key]) {
    return _textures[key];
  }
  const c = uniqueCanvas(canvasSize);
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get context");
  }
  ctx.imageSmoothingEnabled = false;
  // Draw a horizontal gradient from black to white
  const grad = ctx.createLinearGradient(0, 0, 0, canvasSize);
  grad.addColorStop(0, "#000000");
  grad.addColorStop(0.4, "#0a0206");
  grad.addColorStop(0.5, "#1c0206");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  // Draw a white star
  const starCount = canvasSize * canvasSize * 0.01;
  const starSize = 1;
  for (let i = 0; i < starCount; i++) {
    // Pick a uniformly random point on the unit sphere: a longitude
    // (theta, 0 to 2*PI) and a colatitude (phi, 0 to PI) whose cosine
    // is uniformly distributed so points don't bunch up at the poles.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const opacity = Math.pow(octavePerlin2(theta, phi, 2, 4, 0.75), 2);
    const color = "#ffffff";
    // const opacity = Math.random();
    // const color = colorLerp('#ff00ff', '#00ff00', octavePerlin2(theta, phi, 2, 4, 0.5));

    // Convert to the same equirectangular uv used by W's sphere model
    // (u = longitude / 2*PI, v = colatitude / PI, see src/util/w-extensions.js)
    const x = (theta / (Math.PI * 2)) * canvasSize;
    const y = (phi / Math.PI) * canvasSize;

    // The scale is the diameter of the sphere's cross-section at the equator over the diameter of the sphere's cross-section at the star's y position. We would expect the scale to be between 1 and size.
    const xScale = canvasSize / (canvasSize * Math.sin(phi));

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(xScale, 1);
    // Fill a circle with the fill size, using a radial gradient
    ctx.beginPath();
    ctx.arc(0, 0, starSize / 2, 0, Math.PI * 2);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.imageSmoothingEnabled = false;

    ctx.fill();
    ctx.restore();
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
    throw new Error("Failed to get context");
  }
  ctx.imageSmoothingEnabled = false;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasSize);
  let i = 0;
  for (const color of Object.values(COLORS)) {
    gradient.addColorStop(i / Object.values(COLORS).length, color);
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
    throw new Error("Failed to get context");
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
  makeTexture(),
  perlinTexture(),
  testTexture(),
  starTexture(),
];

export const getTextureByIndex = (textureIndex: number): HTMLCanvasElement | undefined => {
  if (textureIndex < 0 || textureIndex >= textures.length) {
    return undefined;
  }
  return textures[textureIndex];
};
