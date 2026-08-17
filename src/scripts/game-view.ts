import { Events } from "./libraries/Events";
import type { Game } from "../game";
import { loadModel } from "./model-loader";
import { EMPTY, GOOSE, FOX, WALL } from "../Types";
import type { Move } from "../Types";

export class GameView {
    private game: Game;
    private pieceToModel: Record<string, string> = {};
    private parentName: string | null = null;

    constructor(game: Game) {
        this.game = game;
        this.parentName = `game_${Math.random().toString(36).substring(2, 15)}`;
        W.group({ n: this.parentName, x: 0, y: 0, z: -3, rx: 0, ry: 0, rz: 0 });
        this.setupEvents();
    }

    render() {
        console.log('render');
        const board = this.game.gameState.board;
        for (let z = 0; z < board.length; z++) {
            const row = board[z]
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                const key = `${x},${z}`;
                let modelName = this.pieceToModel[key];
                if (!modelName) {
                    if (cell === GOOSE) {
                        modelName = loadModel('unicorn');
                        this.pieceToModel[key] = modelName;
                    } else if (cell === FOX) {
                        modelName = loadModel('fox');
                        this.pieceToModel[key] = modelName;
                    } else if (cell === WALL) {
                        modelName = loadModel('wall');
                        this.pieceToModel[key] = modelName;
                    } else {
                        modelName = loadModel('empty');
                        this.pieceToModel[key] = modelName;
                    }
                }
                if (!modelName) {
                    continue
                }
                W.move({n: modelName, g: this.parentName, size: 0.05, x, z});
            }
        }
    }

    onMove(move: Move) {
        console.log('move', move);
        const key = `${move.from.x},${move.from.y}`;
        const toKey = `${move.to.x},${move.to.y}`;
        const modelId = this.pieceToModel[key]
        this.pieceToModel[toKey] = modelId;
        this.pieceToModel[key] = null;

        this.render()
    }
    onPass() {
        console.log('pass');
        this.render()
    }
    
    setupEvents() {
        Events.Instance.on('move', this.onMove.bind(this));
        Events.Instance.on('pass', this.onPass.bind(this));
    }

    teardownEvents() {
        Events.Instance.off('move', this.onMove.bind(this));
        Events.Instance.off('pass', this.onPass.bind(this));
    }

}