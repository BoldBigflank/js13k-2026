type Coord = {
    x: number;
    y: number;
}

type Move = {
    from: Coord;
    to: Coord;
    pass?: boolean;
};

// // Helpers
// const EMPTY = "🟩";
// const GOOSE = "🪿";
// const FOX = "🦊";
// const WALL = "🟫";
// Helpers
const EMPTY = 1;
const GOOSE = 2;
const FOX = 3;
const WALL = 4;

const Side = { GOOSE, FOX } as const;
type Side = (typeof Side)[keyof typeof Side];

type PieceType = typeof EMPTY | typeof GOOSE | typeof FOX | typeof WALL;
// type Board = Piece[][];

type BoardPiece = {
    id: string;
    type: PieceType;
    coord: Coord;
    dead?: boolean;
}

type Board = BoardPiece[];

type GameState = {
    board: Board;
    turn: Side;
    jumpOnly: boolean;
    winner: Side | null;
    moves: Move[];
    selectedPiece: BoardPiece | null;
}

export const MOVE_EVENT = 0;
export const PASS_EVENT = 1;
export const JUMP_EVENT = 2;
export const SELECT_EVENT = 3;
export const GAME_START_EVENT = 4;
export const GAME_OVER_EVENT= 5;

export type { Coord, Move, PieceType, BoardPiece, Board, GameState };
export { Side, EMPTY, GOOSE, FOX, WALL };