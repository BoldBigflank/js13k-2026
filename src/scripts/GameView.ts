import { Events } from "./libraries/Events";
import type { Game } from "./Game";
import { loadModel } from "./ModelLoader";
import { GOOSE, FOX, WALL, MOVE_EVENT, PASS_EVENT, JUMP_EVENT, EMPTY, SELECT_EVENT } from "../Types";
import type { Move, Coord } from "../Types";
import { easeOutCubic, coordEquals } from "./Utils";
import { getValidToCoords } from "./Game";
import { colorTexture } from "./Textures";
import { COLORS } from "./Utils";
import { BOARD_HEIGHT, BOARD_WIDTH, getPieceAtCoord } from "./Board";
import { models } from "../models/js13k-2026";

// Hover animations
// scale jiggle

// Select animation
// Grow
// Jump spin

// Move animation
// Jump animation

const modelForType = {
    [GOOSE]: 'unicorn',
    [FOX]: 'goblin',
    [WALL]: 'wall',
}
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
    private tileModels: (string | null)[][] = [];
    private boardName: string | null = null;
    private parentName: string | null = null;

    constructor(game: Game) {
        this.game = game;
        this.parentName = `game_${Math.random().toString(36).substring(2, 15)}`;
        W.group({ n: this.parentName, x: 0, y: 0, z: -16, rx: 0, ry: 0, rz: 0 });
        this.setupEvents();
    }

    getTileModelName(x: number, z: number) {
        return this.tileModels[z]?.[x] ?? null;
    }

    render() {
        if (!this.game.gameState) {
            return;
        }
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
            this.tileModels = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
        }
        for (let z = 0; z < BOARD_HEIGHT; z++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                const cell = getPieceAtCoord(board, { x, y: z });
                if (!cell || cell.type === WALL) {
                    continue;
                }
                let modelName = this.getTileModelName(x, z);
                if (!modelName) {
                    modelName = loadModel('empty');
                    this.tileModels[z][x] = modelName;
                }
                const isValidTo = validToCoords.some(coord => coordEquals(coord, { x: x, y: z }));
                const isValidFrom = !isValidTo && cell.type === this.game.gameState.turn;
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
        board.forEach(cell => {
            let modelName = cell.id;
            let { x, y } = cell.coord;
            // Don't do empty tiles here
            if (cell.type === EMPTY) {
                return;
            }
            if (!W.next[modelName]) {
                loadModel(modelForType[cell.type] as keyof typeof models, cell.id);
            }
            W.move({
                n: modelName,
                g: this.parentName,
                x: x * 4 - 12,
                z: y * 4 - 12,
                selectable: cell.type !== WALL,
                onSelectStart: (object) => {
                    this.game.clickCoord({ x: x, y: y });
                }
            })
            // Update click handlers
            if (cell.type === GOOSE) {
                W.move({
                    n: modelName,
                    selectable: turn === GOOSE && !selectedPiece,
                    onHoverStart: turn === GOOSE && !selectedPiece ? onHoverStart : null,
                    onHoverEnd: turn === GOOSE && !selectedPiece ? onHoverEnd : null
                });
            } else if (cell.type === FOX) {
                W.move({
                    n: modelName,
                    selectable: turn === FOX && !selectedPiece,
                    onHoverStart: turn === FOX && !selectedPiece ? onHoverStart : null,
                    onHoverEnd: turn === FOX && !selectedPiece ? onHoverEnd : null
                });
            }
        });
    }

    onMove(move: Move) {
        this.render()
    }
    onPass() {
        this.render()
    }

    onSelectCoord(coord: Coord) {
        this.render()
    }

    onJump(coord: Coord) {
        const modelPiece = getPieceAtCoord(this.game.gameState.board, coord);
        if (!modelPiece || !modelPiece.id) {
            console.error('Model piece not found', coord);
            return;
        }
        // Send the model to the sky
        W.move({ n: modelPiece.id, y: 30, a: 1000 });
        this.render()
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