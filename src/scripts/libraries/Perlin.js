/*
 * Perlin noise for 2D and 3D.
 *
 * Based on Stefan Gustavson's public-domain implementation (2012-03-09).
 * Optimisations by Peter Eastman; rank ordering by Stefan Gustavson (2012).
 * Converted to JavaScript by Joseph Gentle.
 *
 * Attribution is appreciated.
 */

import { lerp, fade } from '../Utils';

const PERMUTATION = Uint8Array.from([
    151, 160, 137, 91, 90, 15,
    131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23,
    190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166,
    77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244,
    102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
    135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123,
    5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
    223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
    251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
    49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
    138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
]);

/** 12 gradient directions stored as flat [x, y, z] triples. */
const GRAD3 = new Float32Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

const perm = new Uint8Array(512);
const gradP = new Uint8Array(512);

function dot2(g, x, y) {
    const i = g * 3;
    return GRAD3[i] * x + GRAD3[i + 1] * y;
}

function dot3(g, x, y, z) {
    const i = g * 3;
    return GRAD3[i] * x + GRAD3[i + 1] * y + GRAD3[i + 2] * z;
}

/** Reseed the permutation table. Supports 2^16 distinct seeds. */
export function seed(rawSeed) {
    let s = rawSeed;
    if (s > 0 && s < 1) s *= 65536;
    s = Math.floor(s);
    if (s < 256) s |= s << 8;

    const lo = s & 255;
    const hi = (s >> 8) & 255;

    for (let i = 0; i < 256; i++) {
        const v = PERMUTATION[i] ^ (i & 1 ? lo : hi);
        perm[i] = perm[i + 256] = v;
        gradP[i] = gradP[i + 256] = v % 12;
    }
}

export function perlin2(x, y) {
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    x -= xi;
    y -= yi;
    xi &= 255;
    yi &= 255;

    const n00 = dot2(gradP[xi + perm[yi]], x, y);
    const n01 = dot2(gradP[xi + perm[yi + 1]], x, y - 1);
    const n10 = dot2(gradP[xi + 1 + perm[yi]], x - 1, y);
    const n11 = dot2(gradP[xi + 1 + perm[yi + 1]], x - 1, y - 1);

    const u = fade(x);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), fade(y));
}

/**
 * Fractal Brownian motion: sum octaves at doubling frequency with decaying amplitude.
 * Returns a value in [0, 1] (see adrianb.io/2014/08/09/perlinnoise.html).
 */
export function octavePerlin2(x, y, scale, octaves, persistence) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        total += perlin2(x * frequency * scale, y * frequency * scale) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }

    return (total / maxValue + 1) / 2;
}

export function perlin3(x, y, z) {
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    let zi = Math.floor(z);
    x -= xi;
    y -= yi;
    z -= zi;
    xi &= 255;
    yi &= 255;
    zi &= 255;

    const n000 = dot3(gradP[xi + perm[yi + perm[zi]]], x, y, z);
    const n001 = dot3(gradP[xi + perm[yi + perm[zi + 1]]], x, y, z - 1);
    const n010 = dot3(gradP[xi + perm[yi + 1 + perm[zi]]], x, y - 1, z);
    const n011 = dot3(gradP[xi + perm[yi + 1 + perm[zi + 1]]], x, y - 1, z - 1);
    const n100 = dot3(gradP[xi + 1 + perm[yi + perm[zi]]], x - 1, y, z);
    const n101 = dot3(gradP[xi + 1 + perm[yi + perm[zi + 1]]], x - 1, y, z - 1);
    const n110 = dot3(gradP[xi + 1 + perm[yi + 1 + perm[zi]]], x - 1, y - 1, z);
    const n111 = dot3(gradP[xi + 1 + perm[yi + 1 + perm[zi + 1]]], x - 1, y - 1, z - 1);

    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    return lerp(
        lerp(lerp(n000, n100, u), lerp(n001, n101, u), w),
        lerp(lerp(n010, n110, u), lerp(n011, n111, u), w),
        v,
    );
}

seed(0);

export default { seed, perlin2, perlin3, octavePerlin2 };
