import { sample } from './util/helpers';

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

type GameState = {
    board: Board;
    turn: Side;
    jumpOnly: boolean;
    winner: Side | null;
    moves: Move[];
}

const BOARD_START: Board = [
    [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
    [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
    [GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE],
    [GOOSE, EMPTY, EMPTY, FOX, EMPTY, EMPTY, GOOSE],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
]

// const BOARD_TEST: Board = [
//     [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
//     [WALL, WALL, EMPTY, GOOSE, EMPTY, WALL, WALL],
//     [EMPTY, EMPTY, GOOSE, GOOSE, GOOSE, EMPTY, EMPTY],
//     [EMPTY, EMPTY, EMPTY, FOX, EMPTY, EMPTY, EMPTY],
//     [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
//     [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
//     [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
// ]

const ORTHOGONAL_MOVES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAGONAL_MOVES = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const printBoard = (board: Board) => {
    console.log(board.map(row => row.join(" ")).join("\n"));
}

const moveToString = (move: Move) => {
    if (move === 'pass') {
        return 'PASS';
    }
    return `(${move.from.x},${move.from.y}) -> (${move.to.x},${move.to.y})`;
}

const copyBoard = (board: Board): Board => {
    return board.map(row => row.map(piece => piece));
}

const copyGameState = (gameState: GameState): GameState => {
    return {
        board: copyBoard(gameState.board),
        turn: gameState.turn,
        jumpOnly: gameState.jumpOnly,
        winner: gameState.winner,
        moves: gameState.moves.map(move => move),
    };
}
const canMoveDiagonally = (pos: Coord) => {
    return pos.x % 2 == pos.y % 2;
}
const isDiagonalMove = (move: Move) => {
    if (move === 'pass') {
        return false;
    }
    const { from, to } = move;
    return !(from.x - to.x === 0 || from.y - to.y === 0);
}
const isJump = (move: Move) => {
    if (move === 'pass') {
        return false;
    }
    const { from, to } = move;
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
    // console.log(`getPieceAtCoord(${coord.x},${coord.y}) + (${xOffset},${yOffset})`);
    try {
        if (
            coord.x + xOffset < 0 ||
            coord.x + xOffset >= board[0].length ||
            coord.y + yOffset < 0 ||
            coord.y + yOffset >= board.length
        ) {
            return WALL;
        }
        return board[coord.y + yOffset][coord.x + xOffset];
    } catch (error) {
        console.error(`Error getting piece at coord: ${coord} + (${xOffset},${yOffset})`);
        console.error(error);
        throw error;
    }
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

const makeMove = (gameState: GameState, move: Move): GameState => {
    const newGameState = copyGameState(gameState);
    if (move === 'pass') {
        newGameState.turn = newGameState.turn === Side.FOX ? Side.GOOSE : Side.FOX;
        newGameState.jumpOnly = false;
        return newGameState;
    }
    const { from, to } = move;
    const piece = getPieceAtCoord(newGameState.board, from);
    newGameState.board[to.y][to.x] = piece;
    newGameState.board[from.y][from.x] = EMPTY;

    // Jumps are always 2 spaces vertically and/or horizontally
    if (isJump(move)) {
        const mid = {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
        };
        newGameState.board[mid.y][mid.x] = EMPTY;
    }

    // Check win conditions
    if (isWinningState(newGameState)) {
        newGameState.winner = newGameState.turn;
        return newGameState;
    }

    // Check if the fox can jump again
    if (isJump(move)) {
        newGameState.jumpOnly = true;
        if (!hasValidMoves(newGameState)) {
            newGameState.jumpOnly = false;
            newGameState.turn = newGameState.turn === Side.FOX ? Side.GOOSE : Side.FOX;
            return newGameState;
        }
    } else {
        newGameState.turn = newGameState.turn === Side.FOX ? Side.GOOSE : Side.FOX;
        newGameState.jumpOnly = false;
    }
    return newGameState;
}

const getValidMoves = (gameState: GameState): Move[] => {
    const { board, turn, jumpOnly } = gameState;
    const moves: Move[] = [];
    const isFox = turn === Side.FOX;
    const pieces = getPiecesByType(board, turn === Side.FOX ? FOX : GOOSE);
    if (isFox && jumpOnly) {
        moves.push("pass")
    }
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

const hasValidMoves = (gameState: GameState): boolean => {
    return getValidMoves(gameState).length > 0;
}

const isWinningState = (gameState: GameState): boolean => {
    const { board, turn } = gameState;
    // 🦊 wins if there are fewer than 4 🪿 on the board
    if (turn === Side.FOX && getPieceCount(board, GOOSE) < 4) {
        return true;
    }

    // 🪿 wins if the fox has no valid moves or jumps
    if (turn === Side.GOOSE && !hasValidMoves(gameState)) {
        return true;
    }
    return false;
}

// Positional weights: mobility > jumps so geese squeeze walks first.
// Terminal scores dominate all positional terms.
const WEIGHT_WIN = 10000;
const WEIGHT_FOX_JUMPS = 100;
const WEIGHT_FOX_POSITION = 30;
const WEIGHT_GEESE_NEAR_FOX = 10;
const WEIGHT_FOX_MOBILITY = 10;
const WEIGHT_MATERIAL = 60;

const getFoxMoveBreakdown = (gameState: GameState): { walks: number; jumps: number } => {
    const foxState: GameState = {
        board: gameState.board,
        turn: Side.FOX,
        jumpOnly: false,
        winner: gameState.winner,
        moves: gameState.moves,
    };
    let walks = 0;
    let jumps = 0;
    for (const move of getValidMoves(foxState)) {
        if (move === 'pass') {
            continue;
        }
        if (isJump(move)) {
            jumps++;
        } else {
            walks++;
        }
    }
    return { walks, jumps };
}

/** Higher is better for `perspective`. */
const evaluate = (gameState: GameState, perspective: Side): number => {
    const winner = gameState.winner ?? (isWinningState(gameState) ? gameState.turn : null);
    if (winner !== null) {
        return winner === perspective ? WEIGHT_WIN : -WEIGHT_WIN;
    }
    let score = 0;
    const fox = getPiecesByType(gameState.board, FOX)[0];
    const geese = getPiecesByType(gameState.board, GOOSE);

    if (perspective === Side.FOX) {
        // Points for each missing goose
        score += (10 / geese.length) * WEIGHT_MATERIAL;
        // More points for having 2 or more jumps available to the fox
        const foxJumps = getValidMoves(gameState).filter(move => isJump(move)).length;
        if (foxJumps >= 2) { score += WEIGHT_FOX_JUMPS; }
        // Points if the fox is in the middle 3x3
        if (fox.x >= 3 && fox.x <= 3 && fox.y >= 3 && fox.y <= 3) { score += WEIGHT_FOX_POSITION; }
    } else { // Goose perspective
        // More points if there are no jumps available to the fox
        const foxJumps = getValidMoves(gameState).filter(move => !isJump(move)).length;
        if (!foxJumps) { score += WEIGHT_FOX_JUMPS; }
        // Points if the fox is outide of the middle 3x3
        if (fox.x < 3 || fox.x > 3 || fox.y < 3 || fox.y > 3) { score += WEIGHT_FOX_POSITION; }
        // Some points if the geese are within 3 spaces of the fox
        const geeseWithin3 = geese.filter(geese => {
            return Math.abs(geese.x - fox.x) + Math.abs(geese.y - fox.y) <= 3;
        });
        if (geeseWithin3.length > 0) { score += WEIGHT_GEESE_NEAR_FOX; }

    }
    return perspective === Side.FOX ? score : -score;
}

class Game {
    gameState: GameState;
    players: Player[];

    constructor() {
        this.gameState = {
            board: copyBoard(BOARD_START),
            turn: Side.FOX,
            jumpOnly: false,
            winner: null,
            moves: [],
        };
        this.players = [];
        this.reset()
    }

    addPlayer(name: string, side: Side) {
        this.players.push(new Player(name, side));
    }

    reset() {
        this.gameState = {
            board: copyBoard(BOARD_START),
            turn: Side.FOX,
            jumpOnly: false,
            winner: null,
            moves: [],
        };
    }

    pass() {
        // The game must not be over
        if (this.gameState.winner !== null) {
            console.log(`Invalid move: game is over`);
            return false;
        }
        // It must be the 🦊's turn
        if (this.gameState.turn !== Side.FOX) {
            console.log(`Invalid move: ${this.gameState.turn} cannot pass`);
            return false;
        }
        // The 🦊 must be in jump only mode
        if (!this.gameState.jumpOnly) {
            console.log(`Invalid move: ${this.gameState.turn} cannot pass`);
            return false;
        }
        console.log(`${this.gameState.turn} passed`);
        this.gameState.moves.push('pass');
        this.gameState.turn = Side.GOOSE;
        this.gameState.jumpOnly = false;
        return true;
    }

    move(move: Move) {
        if (move === 'pass') {
            return this.pass();
        }
        const { from, to } = move;
        // Validate the move
        // The game must not be over
        if (this.gameState.winner !== null) {
            console.log(`Invalid move: game is over`);
            return false;
        }
        // It must be the player's turn
        if (this.gameState.turn !== getPieceAtCoord(this.gameState.board, from)) {
            console.log(`Invalid move: ${getPieceAtCoord(this.gameState.board, from)} is not ${this.gameState.turn}`);
            return false;
        }
        // The to must be EMPTY
        if (getPieceAtCoord(this.gameState.board, to) !== EMPTY) {
            console.log(`Invalid move: ${getPieceAtCoord(this.gameState.board, to)} is not empty`);
            return false;
        }

        // Diagonal moves are only allowed on certain spaces
        if (isDiagonalMove(move)) {
            if (!canMoveDiagonally(from)) {
                console.log(`Invalid move: ${from} is not allowed diagonals`);
                return false;
            }
        }

        // Foxes must jump if they are in jump only mode
        if (this.gameState.jumpOnly && !isJump(move)) {
            console.log(`Invalid move: ${from} is not a jump`);
            return false;
        }


        // Validation complete, make the move
        this.gameState = makeMove(this.gameState, { from, to });
        this.gameState.moves.push({ from, to });
        console.log(`Move ${this.gameState.moves.length} - ${this.gameState.turn} - ${moveToString({ from, to })}`);
        printBoard(this.gameState.board);
        if (this.gameState.winner) {
            console.log(`${this.gameState.winner} wins!`);
        }
        return true;
    }
}

const minimax = (
    gameState: GameState,
    depth: number,
    maximizingSide: Side
): number => {
    if (gameState.winner !== null || isWinningState(gameState) || depth === 0) {
        return evaluate(gameState, maximizingSide);
    }

    const moves = getValidMoves(gameState);
    if (moves.length === 0) {
        return evaluate(gameState, maximizingSide);
    }

    // Maximize when it's the root player's turn (handles fox jump chains).
    const isMaximizing = gameState.turn === maximizingSide;
    let bestScore = isMaximizing ? -Infinity : Infinity;
    for (const move of moves) {
        const newGameState = makeMove(gameState, move);
        const score = minimax(newGameState, depth - 1, maximizingSide);
        bestScore = isMaximizing ? Math.max(bestScore, score) : Math.min(bestScore, score);
    }
    return bestScore;
}

const getBestMove = (gameState: GameState, depth: number): Move | null => {
    const maximizingSide = gameState.turn;
    let bestScore = -Infinity;
    let bestMoves: Move[] = [];
    for (const move of getValidMoves(gameState)) {
        const newGameState = makeMove(gameState, move);
        const score = minimax(newGameState, depth - 1, maximizingSide);
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }
    return sample(bestMoves);
}

export { Game, printBoard, minimax, getBestMove };