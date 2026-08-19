export const COLORS: Record<string, string> = {
    RED: '#ffadad',
    ORANGE: '#ffd6a5',
    YELLOW: '#fdffb6',
    GREEN: '#caffbf',
    BLUE: '#9bf6ff',
    INDIGO: '#a0c4ff',
    VIOLET: '#bdb2ff',
    PINK: '#ffc6ff',
}

export const MODES = [
    { id: 0, name: 'PLAYER VS CPU', players: ['player', 'cpu'] },
    { id: 1, name: 'CPU VS PLAYER', players: ['cpu', 'player'] },
    { id: 2, name: 'PLAYER VS PLAYER', players: ['player', 'player'] },
]

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const fade = (t: number) => {
    return t * t * t * (t * (t * 6 - 15) + 10);
};

export const lerp = (a: number, b: number, t: number) => {
    return a + (b - a) * t;
};

export const colorLerp = (color1: string, color2: string, t: number) => {
    const [r1, g1, b1] = color1.match(/\w\w/g)?.map((c) => parseInt(c, 16)) ?? [0, 0, 0];
    const [r2, g2, b2] = color2.match(/\w\w/g)?.map((c) => parseInt(c, 16)) ?? [0, 0, 0];
    // pad left 0s to 2 digits
    const r = Math.round(lerp(r1, r2, t))
        .toString(16)
        .padStart(2, "0");
    const g = Math.round(lerp(g1, g2, t))
        .toString(16)
        .padStart(2, "0");
    const b = Math.round(lerp(b1, b2, t))
        .toString(16)
        .padStart(2, "0");
    return `#${r}${g}${b}`;
};

export const floatVal = (val: number) => parseFloat(`${val || 0}`);

export const fisherYatesShuffle = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

export const sample = (array: any[], count = 1) => {
    if (count === 1) {
        return array[Math.floor(Math.random() * array.length)];
    } else {
        return fisherYatesShuffle(array).slice(0, count);
    }
};

/**
 * Extrudes a 2D polygon (vector2d array) into a 3D model along the z-axis.
 * Returns a { vertices, uv, indices } object suitable for W.add().
 * UVs are computed by projecting [x, y] onto the bbox so that
 * (minX, minY) -> (0,0), (maxX, maxY) -> (1,1)
 *
 * @param {Array<[number, number]>} vector2ds - An array of [x, y] points describing the polygon
 * @param {number} depth - The depth to extrude the shape along the z axis
 * @returns {Object} model - {vertices, uv, indices}
 */
export function extrude2DTo3DModel(vector2ds: any[], depth: number) {
    if (!Array.isArray(vector2ds) || vector2ds.length < 3)
        throw new Error("vector2ds must be an array of at least 3 [x, y] points");
    const numPoints = vector2ds.length;
    const half = depth / 2;

    // Compute min/max for uv mapping
    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
    for (const [x, y] of vector2ds) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;

    // Helpers for uv normalization
    const toUV = ([x, y]: [number, number]) => [(x - minX) / dx, (y - minY) / dy];

    // Vertices: [x, y, z, ...]
    const vertices = [];
    const uv = [];

    // Top face (z = +half)
    for (let i = 0; i < numPoints; i++) {
        const [x, y] = vector2ds[i];
        vertices.push(x, y, +half);
        const [u, v] = toUV([x, y]);
        uv.push(u, v);
    }
    // Bottom face (z = -half)
    for (let i = 0; i < numPoints; i++) {
        const [x, y] = vector2ds[i];
        vertices.push(x, y, -half);
        const [u, v] = toUV([x, y]);
        uv.push(u, v);
    }

    const indices = [];

    // Top face (CCW)
    for (let i = 1; i < numPoints - 1; i++) {
        indices.push(0, i, i + 1);
    }
    // Bottom face (CW to flip normal, offset by numPoints)
    for (let i = 1; i < numPoints - 1; i++) {
        indices.push(numPoints, numPoints + i + 1, numPoints + i);
    }

    // Side faces (two triangles per side)
    for (let i = 0; i < numPoints; i++) {
        const next = (i + 1) % numPoints;
        const topA = i;
        const topB = next;
        const botA = numPoints + i;
        const botB = numPoints + next;
        // 1st triangle (topA, botA, topB)
        indices.push(topA, botA, topB);
        // 2nd triangle (topB, botA, botB)
        indices.push(topB, botA, botB);
    }

    return {
        vertices,
        uv,
        indices,
    };
}

export const rotateAxisAngle = (axis: [number, number, number], angle: number) => {
    const [x, y, z] = axis;
    const matrix = new DOMMatrix().rotateAxisAngle(x, y, z, angle);
    return matrix;
};
