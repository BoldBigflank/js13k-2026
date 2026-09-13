import { Game } from './Game';
import { textTexture } from './Textures';
import { Side } from '../Types';

export class UI {
    game: Game;
    uiModel: string;
    constructor(game: Game) {
        this.game = game;
        this.uiModel = '';
    }

    update() {
        if (this.uiModel == '') {
            this.uiModel = 'ui-cube';
            // create a cube
            W.cube({
                n: this.uiModel,
                x: 0,
                y: -10,
                z: -5,
                rx: -60,
                
                d: 0.1,
                w: 10,
                h: 2
            })
        }
        W.move({
            n: this.uiModel,
            t: this.uiTexture(),
            mix: 0,
        })
    }

    uiTexture(): HTMLCanvasElement {
        const lines  = []
        if (this.game.gameState.winner) {
            lines.push(this.game.gameState.winner === Side.FOX ? 'Goblin wins!' : 'Unicorns win!');
        } else {
            lines.push(`It's the ${this.game.gameState.turn === Side.FOX ? 'Goblin\'s' : 'Unicorns\''} turn`);
            // If it's a player not a cpu
            if (this.game.players.find(player => player.side === this.game.gameState.turn && player.type === 'player')) {
                // if a piece is selected, show the valid moves
                if (this.game.gameState.selectedPiece) {
                    lines.push('Choose an empty space');
                } else {
                    lines.push('Choose a unicorn');
                }
            } else {
                lines.push('CPU is thinking...');
            }
        }
        const canvas = textTexture(1024, lines);
        return canvas;
    }
}