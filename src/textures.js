import { octavePerlin2 } from './util/perlin.js';
import { colorLerp } from './util/helpers.js';

export const makeTexture = (size = 64) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const cells = 4;
    const cell = size / cells;
    for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#4a90d9' : '#e8c547';
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    return c;
}

export const perlinTexture = (startColor = '#000000', endColor = '#ffffff', size = 64, scale = 2, octaves = 2, persistence = 0.5) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = (x / size);
            const ny = (y / size);
            const value = octavePerlin2(nx, ny, scale, octaves, persistence);
            ctx.fillStyle = colorLerp(startColor, endColor, value);
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return c;
}