import { MOVE_EVENT, PASS_EVENT, GAME_START_EVENT, FOX, GOOSE } from '../Types';
import { Events } from './libraries/Events';
import { Game } from './Game';
import { sleep } from './Utils';
import { isWinningState, getValidMoves } from './Game';
import { Side } from '../Types';
import { getPiecesByType } from './Board';
import { GameState } from '../Types';

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
        await sleep(1000);
        const move = getBestMove(this.game.gameState, 3);
        if (move) {
            console.log(`CPU playing next move: ${JSON.stringify(move)}`);
            this.game.move(move);
        } else {
            console.log(`CPU could not find a best move`);
        }
    }

    setupEvents() {
        Events.Instance.on(MOVE_EVENT, async () => await this.playNextMove());
        Events.Instance.on(PASS_EVENT, async () => await this.playNextMove());
        Events.Instance.on(GAME_START_EVENT, async () => await this.playNextMove());
    }

    teardownEvents() {
        Events.Instance.off(MOVE_EVENT, this.playNextMove.bind(this));
        Events.Instance.off(PASS_EVENT, this.playNextMove.bind(this));
        Events.Instance.off(GAME_START_EVENT, this.playNextMove.bind(this));
    }
}

