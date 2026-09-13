import { MOVE_EVENT, PASS_EVENT, GAME_START_EVENT, FOX, GOOSE } from '../Types';
import { Events } from './libraries/Events';
import { Game, makeMove, isWinningState, getValidMoves, isJump, canMoveDiagonally } from './Game';
import { sleep, sample } from './Utils';
import { Side, Move, Coord } from '../Types';
import { getPiecesByType, getPieceTypeAtCoord } from './Board';
import { GameState } from '../Types';

// Goose: deny jumps, prefer blocking landings, then restrict fox mobility.
const WEIGHT_WIN = 10000;
const WEIGHT_FOX_JUMPS = 1000;
const WEIGHT_BLOCKED_JUMP = 100;
const WEIGHT_FOX_MOBILITY = 50;
const WEIGHT_GOOSE_COUNT = 10;
const WEIGHT_FOX_POSITION = 100;
const WEIGHT_MATERIAL = 60;

// const FOX_ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
// const FOX_DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const foxMovesOnBoard = (gameState: GameState): Move[] => {
    return getValidMoves({ ...gameState, jumpOnly: false }, Side.FOX).filter(move => !move.pass);
}

// /** Adjacent goose + goose on the landing square: a jump that is plugged, not fled. */
// const countBlockedFoxJumps = (gameState: GameState, fox: Coord): number => {
//     const dirs = canMoveDiagonally(fox) ? FOX_ORTHO.concat(FOX_DIAG) : FOX_ORTHO;
//     let blocked = 0;
//     for (const [dx, dy] of dirs) {
//         const over = getPieceTypeAtCoord(gameState.board, { x: fox.x + dx, y: fox.y + dy });
//         const land = getPieceTypeAtCoord(gameState.board, { x: fox.x + 2 * dx, y: fox.y + 2 * dy });
//         if (over === GOOSE && land === GOOSE) blocked++;
//     }
//     return blocked;
// }

/** Higher is better for `perspective`. */
const evaluate = (gameState: GameState, perspective: Side): number => {
    const winner = gameState.winner ?? (isWinningState(gameState) ? gameState.turn : null);
    if (winner !== null) {
        return winner === perspective ? WEIGHT_WIN : -WEIGHT_WIN;
    }
    let score = 0;
    const fox = getPiecesByType(gameState.board, FOX)[0];
    const geese = getPiecesByType(gameState.board, GOOSE);
    const foxMoves = foxMovesOnBoard(gameState);
    const foxJumps = foxMoves.filter(move => isJump(move)).length;

    if (perspective === Side.FOX) {
        // Points for each missing goose
        score += (10 / geese.length) * WEIGHT_MATERIAL;
        // More points for having 2 or more jumps available to the fox
        if (foxJumps >= 2) { score += WEIGHT_FOX_JUMPS; }
        // Points if the fox is in the middle 3x3
        if (fox.x >= 3 && fox.x <= 3 && fox.y >= 3 && fox.y <= 3) { score += WEIGHT_FOX_POSITION; }
    } else { // Goose perspective
        // 1. Never leave a goose jumpable (one jump outweighs all blocks/walks)
        score -= foxJumps * WEIGHT_FOX_JUMPS;
        // Prefer plugging the landing square over pulling the threatened goose away
        // score += countBlockedFoxJumps(gameState, fox) * WEIGHT_BLOCKED_JUMP;
        // 2. Squeeze the fox's legal moves
        score -= foxMoves.length * WEIGHT_FOX_MOBILITY;
        score += geese.length * WEIGHT_GOOSE_COUNT;
    }
    return score;
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

export class CPU {
    game: Game;
    constructor(game: Game) {
        this.game = game;
        this.setupEvents();
    }

    async playNextMove() {
        const cpu = this.game.players.find(p => p.type === 'cpu');
        // If it's not the cpu's turn, do nothing
        if (!cpu || this.game.gameState.turn !== cpu.side) {
            return;
        }
        await sleep(350);
        const move = getBestMove(this.game.gameState, 6);
        if (move) {
            this.game.move(move);
        }
    }

    setupEvents() {
        Events.Instance.on(MOVE_EVENT, async () => await this.playNextMove());
        Events.Instance.on(PASS_EVENT, async () => await this.playNextMove());
        Events.Instance.on(GAME_START_EVENT, async () => await this.playNextMove());
    }
}

