
enum Side {
    GOOSE = '🪿',
    FOX = '🦊'
}

type Coord = {
    x: number;
    y: number;
}

type Move = {
    from: Coord;
    to: Coord;
} | 'pass';

// Helpers
const EMPTY = "🟩";
const GOOSE = "🪿";
const FOX = "🦊";
const WALL = "🟫";

type Piece = typeof EMPTY | typeof GOOSE | typeof FOX | typeof WALL;
type Board = Piece[][];

export type { Coord, Move, Piece, Board };
export { Side, EMPTY, GOOSE, FOX, WALL };