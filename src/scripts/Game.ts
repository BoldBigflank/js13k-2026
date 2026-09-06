import { coordEquals } from './Utils';
import { Player } from './Player';
import { Events } from './libraries/Events';
import { copyBoard, getPieceTypeAtCoord, getPiecesByType, getPieceCount, initBoard, movePiece, removePiece, boardToString, getPieceAtCoord } from './Board';
import type { Coord, Move, GameState } from '../Types';
import { Side, EMPTY, GOOSE, MOVE_EVENT, PASS_EVENT, JUMP_EVENT, SELECT_EVENT } from '../Types';

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

class Game {
    gameState: GameState = {
        board: initBoard(),
        turn: Side.FOX,
        jumpOnly: false,
        winner: null,
        moves: [],
        selectedPiece: null
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
            selectedPiece: null
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
        // Let the fox start
        this.gameState.selectedPiece = getPieceAtCoord(this.gameState.board, { x: 3, y: 3 });
    }

    clickCoord(coord: Coord): undefined {
        console.log(`clickCoord: ${JSON.stringify(coord)}`);
        // When empty, only click pieces for the current turn
        // When selected, only click an empty space or the selected piece
        if (!this.gameState.selectedPiece) {
            const selectedPiece = getPieceAtCoord(this.gameState.board, coord);
            if (!selectedPiece || selectedPiece.type !== this.gameState.turn) {
                console.log(`Invalid move: ${JSON.stringify(coord)} is not ${this.gameState.turn}`);
                return
            }
            this.gameState.selectedPiece = selectedPiece;
            Events.Instance.emit(SELECT_EVENT, selectedPiece.id);
        } else {
            if (coordEquals(this.gameState.selectedPiece.coord, coord)) {
                console.log(`unselecting piece`);
                if (this.gameState.turn === Side.FOX) {
                    if (this.gameState.jumpOnly) {
                        this.pass();
                    }
                    return
                }
                this.gameState.selectedPiece = null;
                Events.Instance.emit(SELECT_EVENT, null);
            } else if (getPieceTypeAtCoord(this.gameState.board, coord) === EMPTY) {
                this.move({ from: this.gameState.selectedPiece.coord, to: coord });
            } else {
                console.log(`Invalid move: ${JSON.stringify(coord)} is not empty`);
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
            console.log(`Invalid move: ${JSON.stringify(to)} is not empty`);
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

        // Look up the jumped piece before makeMove removes it
        let jumpedPieceId: string | null = null;
        if (isJump(move)) {
            const mid = {
                x: (move.from.x + move.to.x) / 2,
                y: (move.from.y + move.to.y) / 2,
            };
            const jumpedPiece = getPieceAtCoord(this.gameState.board, mid);
            if (!jumpedPiece || !jumpedPiece.id) {
                console.error('Jumped piece not found', mid);
                return false;
            }
            jumpedPieceId = jumpedPiece.id;
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
        if (jumpedPieceId) {
            Events.Instance.emit(JUMP_EVENT, jumpedPieceId);
        }
        if (this.gameState.turn === Side.FOX) {
            this.clickCoord(getPiecesByType(this.gameState.board, Side.FOX)[0]);
        }
        return true;
    }
}

export { Game, getValidToCoords, getValidMoves, isWinningState };