import type { Coord } from "../Types.ts";

export const COLORS: Record<string, string> = {
    RED: '#ff6161',
    ORANGE: '#ffb359',
    YELLOW: '#fbff6a',
    GREEN: '#8bff73',
    BLUE: '#4fefff',
    INDIGO: '#0764ff',
    VIOLET: '#7b66ff',
    PINK: '#ff7aff',
}

export const LIGHT_COLORS: Record<string, string> = {
    LIGHT_RED: '#ffadad',
    LIGHT_ORANGE: '#ffd6a5',
    LIGHT_YELLOW: '#fdffb6',
    LIGHT_GREEN: '#caffbf',
    LIGHT_BLUE: '#9bf6ff',
    LIGHT_INDIGO: '#a0c4ff',
    LIGHT_VIOLET: '#bdb2ff',
    LIGHT_PINK: '#ffc6ff',
}
export const RAINBOW_COLORS: Record<string, string> = {
    RED: LIGHT_COLORS.LIGHT_RED,
    ORANGE: LIGHT_COLORS.LIGHT_ORANGE,
    YELLOW: LIGHT_COLORS.LIGHT_YELLOW,
    GREEN: LIGHT_COLORS.LIGHT_GREEN,
    BLUE: LIGHT_COLORS.LIGHT_BLUE,
    INDIGO: LIGHT_COLORS.LIGHT_INDIGO,
    VIOLET: LIGHT_COLORS.LIGHT_VIOLET
}

export const MODES = [
    { id: 0, name: 'PLAYER VS CPU' },
    { id: 1, name: 'CPU VS PLAYER' },
    { id: 2, name: 'PLAYER VS PLAYER' },
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

export const sample = (array: any[], count = 1) => {
    if (count === 1) {
        return array[Math.floor(Math.random() * array.length)];
    } else {
        return fisherYatesShuffle(array).slice(0, count);
    }
};

export const coordEquals = (a: Coord, b: Coord) => {
    if (a === null || b === null) return a === b;
    if (a.x !== b.x || a.y !== b.y) return false;
    return true;
};

export const rotateAxisAngle = (axis: [number, number, number], angle: number) => {
    const [x, y, z] = axis;
    const matrix = new DOMMatrix().rotateAxisAngle(x, y, z, angle);
    return matrix;
};

// Easing functions
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const squashAndStretch = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export const lookAt = (from: Coord, to: Coord): number => {
    // Calculate the angle between the two points
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    return angle * 180 / Math.PI
}