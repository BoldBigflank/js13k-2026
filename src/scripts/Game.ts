import { sample, coordEquals } from './Utils';
import { Events } from './libraries/Events';
import { copyBoard, getPieceTypeAtCoord, getPiecesByType, getPieceCount, initBoard, movePiece, removePiece, boardToString } from './Board';
import type { Coord, Move, Board } from '../Types';
import { Side, EMPTY, GOOSE, FOX, MOVE_EVENT, PASS_EVENT, JUMP_EVENT, SELECT_EVENT } from '../Types';
type GameState = {
    board: Board;
    turn: Side;
    jumpOnly: boolean;
    winner: Side | null;
    moves: Move[];
    selectedPiece: Coord | null;
}

const ORTHOGONAL_MOVES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAGONAL_MOVES = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const copyGameState = (gameState: GameState): GameState => {
    return {
        board: copyBoard(gameState.board),
        turn: gameState.turn,
        jumpOnly: gameState.jumpOnly,
        winner: gameState.winner,
        moves: gameState.moves.map(move => move),
        selectedPiece: gameState.selectedPiece,
    };
}
const canMoveDiagonally = (pos: Coord) => {
    return pos.x % 2 == pos.y % 2;
}
const isDiagonalMove = (move: Move) => {
    if (move.pass === true) {
        return false;
    }
    const { from, to } = move;
    return !(from.x - to.x === 0 || from.y - to.y === 0);
}
const isJump = (move: Move) => {
    if (move.pass === true) {
        return false;
    }
    const { from, to } = move;
    return (from.x + to.x) % 2 === 0 && (from.y + to.y) % 2 === 0
}

class Player {
    name: string;
    uuid: string;
    type: 'player' | 'cpu';
    side: Side;

    constructor(name: string, side: Side, type: 'player' | 'cpu') {
        this.name = name;
        this.uuid = crypto.randomUUID();
        this.side = side;
        this.type = type;
    }
}

const makeMove = (gameState: GameState, move: Move): GameState => {
    const newGameState = copyGameState(gameState);
    if (move.pass === true) {
        newGameState.turn = newGameState.turn === Side.FOX ? Side.GOOSE : Side.FOX;
        newGameState.jumpOnly = false;
        return newGameState;
    }
    const { from, to } = move;
    newGameState.board = movePiece(newGameState.board, from, to);

    // Jumps are always 2 spaces vertically and/or horizontally
    if (isJump(move)) {
        const mid = {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
        };
        newGameState.board = removePiece(newGameState.board, mid);
    }

    // Check win conditions
    if (isWinningState(newGameState)) {
        newGameState.winner = newGameState.turn;
        return newGameState;
    }

    // Check if the fox can jump again
    if (isJump(move)) {
        newGameState.jumpOnly = true;
        if (getValidMoves(newGameState).length <= 1) {
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

const getValidToCoords = (gameState: GameState, piece: Coord | null): Coord[] => {
    if (piece === null) {
        return [];
    }
    const { board, turn, jumpOnly } = gameState;
    const isFox = turn === Side.FOX;
    const toCoords: Coord[] = [];
    for (const [x, y] of ORTHOGONAL_MOVES) {
        const to = { x: piece.x + x, y: piece.y + y };
        if (!jumpOnly) {
            if (getPieceTypeAtCoord(board, to) === EMPTY) {
                toCoords.push(to);
            }
        }
        // Foxes can jump over a GOOSE into EMPTY
        if (isFox) {
            const jumpTo = { x: piece.x + x * 2, y: piece.y + y * 2 };
            if (getPieceTypeAtCoord(board, to) === GOOSE && getPieceTypeAtCoord(board, jumpTo) === EMPTY) {
                toCoords.push(jumpTo);
            }
        }
    }
    if (canMoveDiagonally(piece)) {
        for (const [x, y] of DIAGONAL_MOVES) {
            const to = { x: piece.x + x, y: piece.y + y };
            if (!jumpOnly) {
                if (getPieceTypeAtCoord(board, to) === EMPTY) {
                    toCoords.push(to);
                }
            }
            // Foxes can jump over GOOSE into EMPTY
            if (isFox) {
                const jumpTo = { x: piece.x + x * 2, y: piece.y + y * 2 };
                if (getPieceTypeAtCoord(board, to) === GOOSE && getPieceTypeAtCoord(board, jumpTo) === EMPTY) {
                    toCoords.push(jumpTo);
                }
            }
        }
    }
    return toCoords;
}

const getValidMoves = (gameState: GameState, perspective?: Side): Move[] => {
    const { board, turn, jumpOnly } = gameState;
    if (perspective === undefined) {
        perspective = turn
    }
    const moves: Move[] = [];
    const isFox = perspective === Side.FOX;
    const pieces = getPiecesByType(board, perspective);
    if (isFox && jumpOnly) {
        moves.push({ from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, pass: true });
    }
    for (const piece of pieces) {
        moves.push(...getValidToCoords(gameState, piece).map(to => ({ from: piece, to })));
    }
    return moves;
}

const hasValidMoves = (gameState: GameState): boolean => {
    return getValidMoves(gameState).length > 0;
}

const isValidMove = (gameState: GameState, move: Move): boolean => {
    return getValidMoves(gameState).some(m => coordEquals(m.from, move.from) && coordEquals(m.to, move.to));
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
const WEIGHT_FOX_JUMPS = 1000;
const WEIGHT_GOOSE_COUNT = 100;
const WEIGHT_FOX_POSITION = 100;
const WEIGHT_GOOSE_MOBILITY = 10;
const WEIGHT_GOOSE_NEAR_FOX = 1;
const WEIGHT_MATERIAL = 60;

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
        // Points for each goose
        score += geese.length * WEIGHT_GOOSE_COUNT;
        // More points if there are no jumps available to the fox
        const foxJumps = getValidMoves(gameState, Side.FOX).filter(move => isJump(move)).length;
        if (!foxJumps) { score += WEIGHT_FOX_JUMPS; }
        // Points if the geese are in diagonal slots
        const geeseInDiagonalSlots = geese.filter(geese => {
            return canMoveDiagonally(geese);
        });
        score += geeseInDiagonalSlots.length * WEIGHT_GOOSE_MOBILITY;
        // Some points if the geese are within 3 spaces of the fox
        const geeseWithin3 = geese.filter(geese => {
            return Math.abs(geese.x - fox.x) + Math.abs(geese.y - fox.y) <= 3;
        });
        score += geeseWithin3.length * WEIGHT_GOOSE_NEAR_FOX;

    }
    return perspective === Side.FOX ? score : -score;
}

class Game {
    gameState: GameState = {
        board: initBoard(),
        turn: Side.FOX,
        jumpOnly: false,
        winner: null,
        moves: [],
        selectedPiece: { x: 3, y: 3 }, // The fox's starting position
    };
    players: Player[] = [];
    mode: number;
    constructor(mode: number) {
        this.mode = mode;
        this.reset();
    }

    addPlayer(name: string, side: Side, type: 'player' | 'cpu') {
        console.log(`adding player: ${name} ${side} ${type}`);
        this.players.push(new Player(name, side, type));
    }

    reset() {
        this.gameState = {
            board: initBoard(),
            turn: Side.FOX,
            jumpOnly: false,
            winner: null,
            moves: [],
            selectedPiece: { x: 3, y: 3 }, // The fox's starting position
        };
        this.players = [];
        if (this.mode === 0) {
            this.addPlayer('Player 1', Side.FOX, 'player');
            this.addPlayer('CPU', Side.GOOSE, 'cpu');
        } else if (this.mode === 1) {
            this.addPlayer('CPU', Side.FOX, 'cpu');
            this.addPlayer('Player 1', Side.GOOSE, 'player');
        } else if (this.mode === 2) {
            this.addPlayer('Player 1', Side.FOX, 'player');
            this.addPlayer('Player 2', Side.GOOSE, 'player');
        }
    }

    clickCoord(coord: Coord): undefined {
        console.log(`clickCoord: ${JSON.stringify(coord)}`);
        // When empty, only click pieces for the current turn
        // When selected, only click an empty space or the selected piece
        if (!this.gameState.selectedPiece) {
            if (getPieceTypeAtCoord(this.gameState.board, coord) !== this.gameState.turn) {
                console.log(`Invalid move: ${coord} is not ${this.gameState.turn}`);
                return
            }
            this.gameState.selectedPiece = coord;
            Events.Instance.emit(SELECT_EVENT, coord);
        } else {
            if (coordEquals(this.gameState.selectedPiece, coord)) {
                console.log(`unselecting piece`);
                if (this.gameState.turn === Side.FOX) {
                    if (this.gameState.jumpOnly) {
                        this.pass();
                    }
                    return
                }
                this.gameState.selectedPiece = null;
            } else if (getPieceTypeAtCoord(this.gameState.board, coord) === EMPTY) {
                this.move({ from: this.gameState.selectedPiece, to: coord });
            } else {
                console.log(`Invalid move: ${coord} is not empty`);
                return
            }
        }
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
        // The move must be valid
        if (!isValidMove(this.gameState, { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, pass: true })) {
            console.log(`Invalid move: ${this.gameState.turn} cannot pass`);
            return false;
        }
        console.log(`${this.gameState.turn} passed`);
        this.gameState.moves.push({ from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, pass: true });
        this.gameState.turn = Side.GOOSE;
        this.gameState.jumpOnly = false;
        Events.Instance.emit(PASS_EVENT);
        return true;
    }

    move(move: Move) {
        if (move.pass === true) {
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
        if (this.gameState.turn !== getPieceTypeAtCoord(this.gameState.board, from)) {
            console.log(`Invalid move: ${getPieceTypeAtCoord(this.gameState.board, from)} is not ${this.gameState.turn}`);
            return false;
        }
        // The to must be EMPTY
        if (getPieceTypeAtCoord(this.gameState.board, to) !== EMPTY) {
            console.log(`Invalid move: ${getPieceTypeAtCoord(this.gameState.board, to)} is not empty`);
            return false;
        }

        // Diagonal moves are only allowed on certain spaces
        if (isDiagonalMove(move)) {
            if (!canMoveDiagonally(from)) {
                console.log(`Invalid move: ${from} is not allowed diagonals`);
                return false;
            }
        }

        // The move must be valid
        if (!isValidMove(this.gameState, move)) {
            console.log(`Invalid move: ${JSON.stringify(move)} is not valid`);
            return false;
        }

        // Validation complete, make the move
        this.gameState = makeMove(this.gameState, move);
        this.gameState.selectedPiece = null;
        this.gameState.moves.push(move);
        console.log(boardToString(this.gameState.board));
        if (this.gameState.winner) {
            console.log(`${this.gameState.winner} wins!`);
        }
        Events.Instance.emit(MOVE_EVENT, move);
        if (isJump(move)) {
            const mid = {
                x: (move.from.x + move.to.x) / 2,
                y: (move.from.y + move.to.y) / 2,
            };
            Events.Instance.emit(JUMP_EVENT, mid);
        }
        if (this.gameState.turn === Side.FOX) {
            this.clickCoord(getPiecesByType(this.gameState.board, Side.FOX)[0]);
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

export { Game, minimax, getBestMove, getValidToCoords };