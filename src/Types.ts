type Coord = {
    x: number;
    y: number;
}

type Move = {
    from: Coord;
    to: Coord;
    pass?: boolean;
};

// Helpers
const EMPTY = "🟩";
const GOOSE = "🪿";
const FOX = "🦊";
const WALL = "🟫";

enum Side {
    GOOSE = "🪿",
    FOX = "🦊"
}

type Piece = typeof EMPTY | typeof GOOSE | typeof FOX | typeof WALL;
type Board = Piece[][];

export const MOVE_EVENT = 0;
export const PASS_EVENT = 1;
export const JUMP_EVENT = 2;

export type { Coord, Move, Piece, Board };
export { Side, EMPTY, GOOSE, FOX, WALL };