import { Events } from "./libraries/Events";
import type { Game } from "./Game";
import { loadModel } from "./ModelLoader";
import { GOOSE, FOX, WALL, MOVE_EVENT, PASS_EVENT, JUMP_EVENT, EMPTY } from "../Types";
import type { Move, Coord } from "../Types";
import { easeOutCubic } from "./Utils";

// Hover animations
// scale jiggle

// Select animation
// Grow
// Jump spin

// Move animation
// Jump animation

const GOOSE_SIZE = 0.1
const FOX_SIZE = 0.1
const EMPTY_SIZE = 0.1
const WALL_SIZE = 0.1

const SIZES = {
    [GOOSE]: GOOSE_SIZE,
    [FOX]: FOX_SIZE,
    [EMPTY]: EMPTY_SIZE,
    [WALL]: WALL_SIZE,
}

export class GameView {
    private game: Game;
    private coordToName: Record<string, string | null> = {};
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
                let modelName = this.coordToName[key];
                let size = SIZES[cell as keyof typeof SIZES];
                console.log(`cell: ${cell}, key: ${key}, modelName: ${modelName}`);
                if (cell === EMPTY && modelName?.indexOf('unicorn_') === 0) {
                    // Fling dead unicorns into the sky
                    W.move({ n: modelName, y: 100, a: 1000 });
                    this.coordToName[key] = null;
                    modelName = null;
                    continue;
                }
                if (!modelName) {
                    if (cell === GOOSE) {
                        modelName = loadModel('unicorn');
                        W.move({
                            n: modelName,
                            selectable: true,
                            onHoverStart: (object) => {
                                W.move({ n: object.name, size: GOOSE_SIZE })
                                W.move({ n: object.name, size: GOOSE_SIZE * 1.1, a: 1000, ease: easeOutCubic })
                            }
                        })
                        this.coordToName[key] = modelName;
                    } else if (cell === FOX) {
                        modelName = loadModel('fox');
                        W.move({
                            n: modelName,
                            selectable: true,
                            onHoverStart: (object) => {
                                W.move({ n: object.name, size: FOX_SIZE })
                                W.move({ n: object.name, size: FOX_SIZE * 1.1, a: 1000, ease: easeOutCubic })
                            }
                        })
                        this.coordToName[key] = modelName;
                    } else if (cell === EMPTY) {
                        modelName = loadModel('empty');
                        W.move({
                            n: modelName,
                            selectable: true,
                            onHoverStart: (object) => {
                                W.move({ n: object.name, size: EMPTY_SIZE })
                                W.move({ n: object.name, size: EMPTY_SIZE * 1.1, a: 1000, ease: easeOutCubic })
                            }
                        })
                        this.coordToName[key] = modelName;
                    } else {
                        modelName = loadModel('wall');
                        W.move({
                            n: modelName,
                            selectable: true,
                            onHoverStart: (object) => {
                                W.move({ n: object.name, size: WALL_SIZE })
                                W.move({ n: object.name, size: WALL_SIZE * 1.1, a: 100 })
                            }
                        })
                        this.coordToName[key] = modelName;
                    }
                }
                if (!modelName) {
                    continue
                }
                console.log(`modelName: ${modelName}, size: ${size}`);
                W.move({
                    n: modelName,
                    g: this.parentName,
                    size: size,
                    x: x * 4 - 12,
                    z: z * 4 - 12,
                    selectable: cell !== WALL,
                    onSelectStart: (object) => {
                        console.log('select', JSON.stringify(object));
                        this.game.clickCoord({ x: x, y: z });
                    }
                });
            }
        }
    }

    onMove(move: Move) {
        const key = `${move.from?.x},${move.from?.y}`;
        const toKey = `${move.to.x},${move.to.y}`;
        const modelName = this.coordToName[key]
        this.coordToName[toKey] = modelName;
        this.coordToName[key] = null;

        this.render()
    }
    onPass() {
        this.render()
    }

    onJump(coord: Coord) {
        console.log(`onJump: ${JSON.stringify(coord)}, cell: ${cell}`);
        const key = `${coord.x},${coord.y}`;
        const modelName = this.coordToName[key];
        // Send the model to the sky
        W.move({ n: modelName, y: 100, a: 1000 });
        this.coordToName[key] = null;
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