import type { Coord, PieceType, Board, BoardPiece } from '../Types';
import { EMPTY, GOOSE, FOX, WALL } from '../Types';

const BOARD_WIDTH = 7;
const BOARD_HEIGHT = 7;

const BOARD_START: PieceType[][] = [
    [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
    [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
    [GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE],
    [GOOSE, EMPTY, EMPTY, FOX, EMPTY, EMPTY, GOOSE],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
    [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
]

// const BOARD_TEST: Board = [
//     [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
//     [WALL, WALL, EMPTY, GOOSE, EMPTY, WALL, WALL],
//     [EMPTY, EMPTY, GOOSE, GOOSE, GOOSE, EMPTY, EMPTY],
//     [EMPTY, EMPTY, EMPTY, FOX, EMPTY, EMPTY, EMPTY],
//     [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
//     [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
//     [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
// ]


const initBoard = (): Board => {
    // Don't include empty spaces
    let board: Board = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (BOARD_START[y][x] === EMPTY) {
                continue;
            }
            board.push({ id: `${x}-${y}`, type: BOARD_START[y][x], coord: { x, y } });
        }
    }
    return board as Board;
}

const boardToString = (board: Board): string => {
    let output = "";
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        let row = "";
        for (let x = 0; x < BOARD_WIDTH; x++) {
            row += getPieceTypeAtCoord(board, { x, y }) + " ";
        }
        output += row + "\n";
    }
    return output;
}

const copyBoard = (board: Board): Board => {
    return board.map(piece => ({ ...piece }));
}

const getPieceAtCoord = (board: Board, coord: Coord, xOffset: number = 0, yOffset: number = 0): BoardPiece => {
    try {
        if (
            coord.x + xOffset < 0 ||
            coord.x + xOffset >= BOARD_WIDTH ||
            coord.y + yOffset < 0 ||
            coord.y + yOffset >= BOARD_HEIGHT
        ) {
            return { type: WALL, coord: { x: coord.x + xOffset, y: coord.y + yOffset }, id: `${coord.x + xOffset}-${coord.y + yOffset}` }
        }
        const piece = board.find(piece => piece.coord.x === coord.x + xOffset && piece.coord.y === coord.y + yOffset);
        if (!piece) {
            // It's an empty space
            return { type: EMPTY, coord: { x: coord.x + xOffset, y: coord.y + yOffset }, id: `${coord.x + xOffset}-${coord.y + yOffset}` }
        }
        return piece;
    } catch (error) {
        console.error(`Error getting piece at coord: ${coord} + (${xOffset},${yOffset})`);
        console.error(error);
        throw error;
    }
}

const getPieceTypeAtCoord = (board: Board, coord: Coord, xOffset: number = 0, yOffset: number = 0): PieceType => {
    const x = coord.x + xOffset;
    const y = coord.y + yOffset;
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
        return WALL;
    }
    return getPieceAtCoord(board, coord, xOffset, yOffset)?.type ?? EMPTY;
}

const getPiecesByType = (board: Board, pieceType: PieceType): Coord[] => {
    const pieces: Coord[] = [];

    board.forEach(piece => {
        if (piece.type === pieceType) {
            pieces.push(piece.coord);
        }
    }); 
    return pieces;
}

const getPieceCount = (board: Board, pieceType: PieceType): number => {
    return getPiecesByType(board, pieceType).length;
}

const movePiece = (board: Board, from: Coord, to: Coord) => {
    const newBoard = copyBoard(board);
    const piece = getPieceAtCoord(newBoard, from);
    const dest = getPieceAtCoord(newBoard, to);
    if (!piece || piece.type === EMPTY) {
        throw new Error('No piece at from coord');
    }
    if (!dest) {
        throw new Error(`To coord ${JSON.stringify(to)} is not empty`);
    }
    piece.coord = { ...to };
    dest.coord = { ...from };
    return newBoard;
}

const removePiece = (board: Board, coord: Coord) => {
    const newBoard = copyBoard(board);
    const piece = getPieceAtCoord(newBoard, coord);
    if (piece) {
        piece.coord = { x: -1, y: -1 };
        piece.dead = true;
    }
    return newBoard;
}

export { BOARD_WIDTH, BOARD_HEIGHT, initBoard, boardToString, copyBoard, getPieceAtCoord, getPieceTypeAtCoord, getPiecesByType, getPieceCount, movePiece, removePiece };