import { Events } from "./libraries/Events";
import type { Game } from "./Game";
import { loadModel } from "./ModelLoader";
import { GOOSE, FOX, WALL, MOVE_EVENT, PASS_EVENT } from "../Types";
import type { Move } from "../Types";

export class GameView {
    private game: Game;
    private pieceToModel: Record<string, string | null> = {};
    private boardName: string | null = null;
    private parentName: string | null = null;

    constructor(game: Game) {
        this.game = game;
        this.parentName = `game_${Math.random().toString(36).substring(2, 15)}`;
        W.group({ n: this.parentName, x: 0, y: 0, z: -16, rx: 0, ry: 0, rz: 0 });
        this.setupEvents();
    }

    render() {
        const board = this.game.gameState.board;
        if (!this.boardName) {
            this.boardName = loadModel('board') as string;
            W.move({ n: this.boardName, g: this.parentName, x: 0, y: 0, z: 0 });
        }
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
                W.move({ n: modelName, g: this.parentName, size: 0.1, x: x * 4 - 12, z: z * 4 - 12 });
            }
        }
    }

    onMove(move: Move) {
        const key = `${move.from?.x},${move.from?.y}`;
        const toKey = `${move.to.x},${move.to.y}`;
        const modelId = this.pieceToModel[key]
        this.pieceToModel[toKey] = modelId;
        this.pieceToModel[key] = null;

        this.render()
    }
    onPass() {
        this.render()
    }

    setupEvents() {
        Events.Instance.on(MOVE_EVENT, this.onMove.bind(this));
        Events.Instance.on(PASS_EVENT, this.onPass.bind(this));
    }

    teardownEvents() {
        Events.Instance.off(MOVE_EVENT, this.onMove.bind(this));
        Events.Instance.off(PASS_EVENT, this.onPass.bind(this));
    }

}