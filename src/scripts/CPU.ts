import { MOVE_EVENT, JUMP_EVENT, PASS_EVENT, GAME_START_EVENT, MOVE_EVENT, JUMP_EVENT, PASS_EVENT } from '../Types';
import { Events } from './libraries/Events';
import { Game, getBestMove } from './Game';
import { sleep } from './Utils';

export class CPU {
    game: Game;
    constructor(game: Game) {
        this.game = game;
        this.setupEvents();

    }

    async playNextMove() {
        const cpu = this.game.players.find(p => p.type === 'cpu');
        if (!cpu || this.game.gameState.turn !== cpu.side) {
            return;
        }
        await sleep(1000);
        // If it's not the cpu's turn, do nothing
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