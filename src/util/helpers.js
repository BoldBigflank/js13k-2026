export const fade = (t) => {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

export const lerp = (a, b, t) => {
    return a + (b - a) * t;
}

export const colorLerp = (color1, color2, t) => {
    const [r1, g1, b1] = color1.match(/\w\w/g).map(c => parseInt(c, 16));
    const [r2, g2, b2] = color2.match(/\w\w/g).map(c => parseInt(c, 16));
    // pad left 0s to 2 digits
    const r = Math.round(lerp(r1, r2, t)).toString(16).padStart(2, '0');
    const g = Math.round(lerp(g1, g2, t)).toString(16).padStart(2, '0');
    const b = Math.round(lerp(b1, b2, t)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

export const fisherYatesShuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
