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

export type { Coord, Move, PieceType, BoardPiece, Board, GameState };
export { Side, EMPTY, GOOSE, FOX, WALL };