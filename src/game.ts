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

const BOARD_START: Board = [
    [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
    [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
    [GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE],
    [GOOSE, EMPTY, EMPTY, FOX, EMPTY, EMPTY, GOOSE],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
]

const BOARD_TEST: Board = [
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
    [WALL, WALL, EMPTY, GOOSE, EMPTY, WALL, WALL],
    [EMPTY, EMPTY, GOOSE, GOOSE, GOOSE, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY, FOX, EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
]

const ORTHOGONAL_MOVES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAGONAL_MOVES = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const printBoard = (board: Board) => {
    console.log(board.map(row => row.join(" ")).join("\n"));
}

const copyBoard = (board: Board): Board => {
    return board.map(row => row.map(piece => piece));
}

const canMoveDiagonally = (pos: Coord) => {
    return pos.x % 2 == pos.y % 2;
}
const isDiagonalMove = (from: Coord, to: Coord) => {
    return !(from.x - to.x === 0 || from.y - to.y === 0);
}
const isJump = (from: Coord, to: Coord) => {
    return (from.x + to.x) % 2 === 0 && (from.y + to.y) % 2 === 0
}

class Player {
    name: string;
    uuid: string;
    side: Side;

    constructor(name: string, side: Side) {
        this.name = name;
        this.uuid = crypto.randomUUID();
        this.side = side;
    }
}

const getPieceAtCoord = (board: Board, coord: Coord, xOffset: number = 0, yOffset: number = 0): Piece => {
    if (
        coord.x + xOffset < 0 ||
        coord.x + xOffset >= board[0].length ||
        coord.y + yOffset < 0 ||
        coord.y + yOffset >= board.length
    ) {
        return WALL;
    }
    return board[coord.y + yOffset][coord.x + xOffset];
}

const getPiecesByType = (board: Board, piece: Piece): Coord[] => {
    const pieces: Coord[] = [];
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] === piece) {
                pieces.push({ x, y });
            }
        }
    }
    return pieces;
}

const getPieceCount = (board: Board, piece: Piece): number => {
    return getPiecesByType(board, piece).length;
}

const makeMove = (oldBoard: Board, move: Move): Board => {
    // Make a copy of the board
    const board = copyBoard(oldBoard);
    if (move === 'pass') {
        return oldBoard;
    }
    const { from, to } = move;
    const piece = getPieceAtCoord(board, from);
    board[to.y][to.x] = piece;
    board[from.y][from.x] = EMPTY;

    // Jumps are always 2 spaces vertically and/or horizontally
    if (isJump(from, to)) {
        const mid = {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
        };
        board[mid.y][mid.x] = EMPTY;
    }
    return board;
}

const getValidMoves = (board: Board, turn: Side, jumpOnly: boolean = false): Move[] => {
    const moves: Move[] = [];
    const isFox = turn === Side.FOX;
    const pieces = getPiecesByType(board, turn === Side.FOX ? FOX : GOOSE);
    for (const piece of pieces) {
        for (const [x, y] of ORTHOGONAL_MOVES) {
            const to = { x: piece.x + x, y: piece.y + y };
            if (!jumpOnly) {
                if (getPieceAtCoord(board, to) === EMPTY) {
                    moves.push({ from: piece, to });
                }
            }
            // Foxes can jump over a GOOSE into EMPTY
            if (isFox) {
                const jumpTo = { x: piece.x + x * 2, y: piece.y + y * 2 };
                if (getPieceAtCoord(board, to) === GOOSE && getPieceAtCoord(board, jumpTo) === EMPTY) {
                    moves.push({ from: piece, to: jumpTo });
                }
            }
        }
        if (canMoveDiagonally(piece)) {
            for (const [x, y] of DIAGONAL_MOVES) {
                const to = { x: piece.x + x, y: piece.y + y };
                if (!jumpOnly) {
                    if (getPieceAtCoord(board, to) === EMPTY) {
                        moves.push({ from: piece, to });
                    }
                }
                // Foxes can jump over GOOSE into EMPTY
                if (isFox) {
                    const jumpTo = { x: piece.x + x * 2, y: piece.y + y * 2 };
                    if (getPieceAtCoord(board, to) === GOOSE && getPieceAtCoord(board, jumpTo) === EMPTY) {
                        moves.push({ from: piece, to: jumpTo });
                    }
                }
            }
        }
    }
    return moves;
}

const hasValidMoves = (board: Board, turn: Side, jumpOnly: boolean = false): boolean => {
    return getValidMoves(board, turn, jumpOnly).length > 0;
}

class Game {
    board: Board;
    players: Player[];
    turn: Side;
    jumpOnly: boolean;
    winner: Side | null;
    moves: Move[];

    constructor() {
        this.board = copyBoard(BOARD_START);
        this.players = [];
        this.turn = Side.FOX;
        this.moves = [];
        this.jumpOnly = false;
        this.winner = null;
        this.reset()
    }

    addPlayer(name: string, side: Side) {
        this.players.push(new Player(name, side));
    }

    reset() {
        this.board = copyBoard(BOARD_START);
        this.players = [];
        this.turn = Side.FOX;
        this.moves = [];
        this.jumpOnly = false;
        this.winner = null;
    }

    pass() {
        // The game must not be over
        if (this.winner !== null) {
            console.log(`Invalid move: game is over`);
            return false;
        }
        // It must be the 🦊's turn
        if (this.turn !== Side.FOX) {
            console.log(`Invalid move: ${this.turn} cannot pass`);
            return false;
        }
        // The 🦊 must be in jump only mode
        if (!this.jumpOnly) {
            console.log(`Invalid move: ${this.turn} cannot pass`);
            return false;
        }
        console.log(`${this.turn} passed`);
        this.moves.push('pass');
        this.turn = Side.GOOSE
        this.jumpOnly = false;
        return true;
    }

    move(from: Coord, to: Coord) {
        // Validate the move
        // The game must not be over
        if (this.winner !== null) {
            console.log(`Invalid move: game is over`);
            return false;
        }
        // It must be the player's turn
        if (this.turn !== getPieceAtCoord(this.board, from)) {
            console.log(`Invalid move: ${getPieceAtCoord(this.board, from)} is not ${this.turn}`);
            return false;
        }
        // The to must be EMPTY
        if (getPieceAtCoord(this.board, to) !== EMPTY) {
            console.log(`Invalid move: ${getPieceAtCoord(this.board, to)} is not empty`);
            return false;
        }

        // Diagonal moves are only allowed on certain spaces
        if (isDiagonalMove(from, to)) {
            if (!canMoveDiagonally(from)) {
                console.log(`Invalid move: ${from} is not allowed diagonals`);
                return false;
            }
        }

        // Foxes must jump if they are in jump only mode
        if (this.jumpOnly && !isJump(from, to)) {
            console.log(`Invalid move: ${from} is not a jump`);
            return false;
        }


        // Validation complete, make the move
        this.board = makeMove(this.board, { from, to });
        this.moves.push({ from, to });
        printBoard(this.board);


        // Check win conditions
        // 🦊 wins if there are fewer than 4 🪿 on the board
        if (this.turn === Side.FOX && getPieceCount(this.board, GOOSE) < 4) {
            console.log(`🦊 wins!`);
            this.winner = Side.FOX;
        }

        // 🪿 wins if the fox has no valid moves or jumps
        if (this.turn === Side.GOOSE && !hasValidMoves(this.board, Side.FOX)) {
            console.log(`🪿 wins!`);
            this.winner = Side.GOOSE;
        }

        // Check if the fox can jump again
        if (isJump(from, to) && hasValidMoves(this.board, Side.FOX, true)) {
            this.jumpOnly = true;
            console.log(`Valid jump found, allowing the fox to keep his turn`);
        } else {
            this.jumpOnly = false;
            this.turn = this.turn === Side.FOX ? Side.GOOSE : Side.FOX;
        }

        return true;
    }
}

export { Game, printBoard };