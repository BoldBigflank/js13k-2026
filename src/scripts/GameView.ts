import { Events } from "./libraries/Events";
import type { Game } from "./Game";
import { loadModel } from "./ModelLoader";
import { GOOSE, FOX, WALL, MOVE_EVENT, PASS_EVENT, JUMP_EVENT, EMPTY, SELECT_EVENT } from "../Types";
import type { Move, Coord } from "../Types";
import { easeOutCubic, squashAndStretch, coordEquals } from "./Utils";
import { getValidToCoords } from "./Game";
import { colorTexture } from "./Textures";
import { COLORS } from "./Utils";

// Hover animations
// scale jiggle

// Select animation
// Grow
// Jump spin

// Move animation
// Jump animation

const onHoverStart = (object: any) => {
    W.move({ n: object.name, size: 1 })
    W.move({ n: object.name, size: 1.1, a: 1000, ease: easeOutCubic })
}
const onHoverEnd = (object: any) => {
    W.move({ n: object.name, size: 1.1 })
    W.move({ n: object.name, size: 1, a: 1000, ease: easeOutCubic })
}

const redTexture = colorTexture(1024, COLORS.RED);
const blueTexture = colorTexture(1024, COLORS.BLUE);

export class GameView {
    private game: Game;
    private coordToName: Record<string, string | null> = {};
    private tileModels: (string | null)[][] = [];
    private boardName: string | null = null;
    private parentName: string | null = null;

    constructor(game: Game) {
        this.game = game;
        this.parentName = `game_${Math.random().toString(36).substring(2, 15)}`;
        W.group({ n: this.parentName, x: 0, y: 0, z: -16, rx: 0, ry: 0, rz: 0 });
        this.setupEvents();
    }

    getModelName(x: number, z: number) {
        const key = `${x},${z}`;
        return this.coordToName[key];
    }
    setModelName(x: number, z: number, modelName: string) {
        const key = `${x},${z}`;
        this.coordToName[key] = modelName;
    }
    getTileModelName(x: number, z: number) {
        return this.tileModels[z]?.[x] ?? null;
    }

    renderCell(cell: Piece, x: number, z: number) {
        let modelName = this.getModelName(x, z);
        if (cell === EMPTY && modelName?.indexOf('unicorn_') === 0) {
            // Fling dead unicorns into the sky
            W.move({ n: modelName, y: 100, a: 1000 });
            this.setModelName(x, z, null);
        }
    }

    render() {
        const board = this.game.gameState.board;
        const turn = this.game.gameState.turn;
        const selectedPiece = this.game.gameState.selectedPiece;
        const validToCoords = getValidToCoords(this.game.gameState, selectedPiece);

        // Initialize the board model
        if (!this.boardName) {
            this.boardName = loadModel('board') as string;
            W.move({ n: this.boardName, g: this.parentName, x: 0, y: 0, z: 0 });
        }

        // Initialize the tile models
        if (!this.tileModels.length) {
            this.tileModels = Array.from({ length: board.length }, () => Array(board[0].length).fill(null));
        }
        for (let z = 0; z < board.length; z++) {
            for (let x = 0; x < board[z].length; x++) {
                const cell = board[z][x];
                if (cell == WALL) {
                    continue;
                }
                let modelName = this.getTileModelName(x, z);
                if (!modelName) {
                    modelName = loadModel('empty');
                    this.tileModels[z][x] = modelName;
                }
                const isValidTo = validToCoords.some(coord => coordEquals(coord, { x: x, y: z }));
                const isValidFrom = !isValidTo && cell === this.game.gameState.turn;
                W.move({
                    n: modelName,
                    g: this.parentName,
                    x: x * 4 - 12,
                    ry: isValidTo ? 45 : 0,
                    b: isValidTo ? "#f00" : "#0f0",
                    mix: 0.5,
                    t: isValidTo ? redTexture : blueTexture,
                    z: z * 4 - 12,
                    selectable: true,
                    onHoverStart: isValidTo || isValidFrom ? onHoverStart : null,
                    onHoverEnd: isValidTo || isValidFrom ? onHoverEnd : null,
                    onSelectStart: isValidTo || isValidFrom ? (object) => {
                        this.game.clickCoord({ x: x, y: z });
                    } : null
                })
            }
        }

        // Render the piece models
        for (let z = 0; z < board.length; z++) {
            for (let x = 0; x < board[z].length; x++) {
                const cell = board[z][x];

                let modelName = this.getModelName(x, z);
                // Initialize the piece models
                if (!modelName) {
                    if (cell === GOOSE) {
                        modelName = loadModel('unicorn');
                        W.move({
                            n: modelName,
                            selectable: true
                        })
                        this.setModelName(x, z, modelName);
                    } else if (cell === FOX) {
                        modelName = loadModel('goblin');
                        W.move({
                            n: modelName,
                            selectable: true
                        })
                        this.setModelName(x, z, modelName);
                    }
                }
                if (!modelName) {
                    continue
                }
                // Update the piece models
                W.move({
                    n: modelName,
                    g: this.parentName,
                    x: x * 4 - 12,
                    z: z * 4 - 12,
                    selectable: cell !== WALL,
                    onSelectStart: (object) => {
                        this.game.clickCoord({ x: x, y: z });
                    }
                });



                // Update click handlers

                if (cell === GOOSE) {
                    W.move({
                        n: modelName,
                        selectable: turn === GOOSE && !selectedPiece,
                        onHoverStart: turn === GOOSE && !selectedPiece ? onHoverStart : null,
                        onHoverEnd: turn === GOOSE && !selectedPiece ? onHoverEnd : null
                    });
                } else if (cell === FOX) {
                    W.move({
                        n: modelName,
                        selectable: turn === FOX && !selectedPiece,
                        onHoverStart: turn === FOX && !selectedPiece ? onHoverStart : null,
                        onHoverEnd: turn === FOX && !selectedPiece ? onHoverEnd : null
                    });
                }
            }
        }
    }

    onMove(move: Move) {
        const key = `${move.from?.x},${move.from?.y}`;
        const toKey = `${move.to.x},${move.to.y}`;
        const modelName = this.getModelName(move.from.x, move.from.y);
        this.setModelName(move.to.x, move.to.y, modelName);
        this.setModelName(move.from.x, move.from.y, null);
        this.render()
    }
    onPass() {
        this.render()
    }

    onSelectCoord(coord: Coord) {
        this.render()
    }

    onJump(coord: Coord) {
        const modelName = this.getModelName(coord.x, coord.y);
        if (modelName) {
            // Send the model to the sky
            W.move({ n: modelName, y: 30, a: 1000 });
            this.setModelName(coord.x, coord.y, null);
            this.render()
        }
    }

    setupEvents() {
        Events.Instance.on(MOVE_EVENT, this.onMove.bind(this));
        Events.Instance.on(PASS_EVENT, this.onPass.bind(this));
        Events.Instance.on(SELECT_EVENT, this.onSelectCoord.bind(this));
        Events.Instance.on(JUMP_EVENT, this.onJump.bind(this));
    }

    teardownEvents() {
        Events.Instance.off(MOVE_EVENT, this.onMove.bind(this));
        Events.Instance.off(PASS_EVENT, this.onPass.bind(this));
        Events.Instance.off(SELECT_EVENT, this.onSelectCoord.bind(this));
        Events.Instance.off(JUMP_EVENT, this.onJump.bind(this));
    }
}