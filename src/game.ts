enum Side {
    GOOSE = '🪿',
    FOX = '🦊'
}

type Coord = {
  x: number;
  y: number;
}

type Move = {
  from: Coord;
  to: Coord;
}

const EMPTY = "🟩";
const GOOSE = "🪿";
const FOX = "🦊";
const WALL = "🟫";

type Space = typeof EMPTY | typeof GOOSE | typeof FOX | typeof WALL;

class Player {
    name: string;
    uuid: string;
    side: Side;

    constructor(name: string, side: Side) {
        this.name = name;
        this.uuid = crypto.randomUUID();
        this.side = side;
    }
}

class Board {
    board: Space[][];

    constructor() {
        this.board = [
          [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
          [WALL, WALL, GOOSE, GOOSE, GOOSE, WALL, WALL],
          [GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE, GOOSE],
          [GOOSE, EMPTY, EMPTY, FOX, EMPTY, EMPTY, GOOSE],
          [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
          [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
          [WALL, WALL, EMPTY, EMPTY, EMPTY, WALL, WALL],
        ];
        /*
         1 2 3
         8   4
         7 6 5
        */
       // When the row and column number are both odd or both even, diagonals are valid.
        // this.validMoves = [
        //   [[], [], [], [4, 5, 6], [4, 6, 8], [6,7,8], [], [], []],
        //   [[], [], [], [2, 4, 6], [1,2,3,4,5,6,7,8], [6,7,8], [], [], []],
        //   [[4,5,6], [4,6,8], [2,3,4,5,6,7,8], [2,4,6,8], [1,2,4,5,6,7,8], [4,6,8], [6,7,8]]
        // ]
        console.log(this.toString());
    }
    toString() {
      return this.board.map(row => row.join(" ")).join("\n");
    }
    get(coord: Coord, xOffset: number = 0, yOffset: number = 0) {
      if (coord.x + xOffset < 0 || coord.x + xOffset >= this.board[0].length || coord.y + yOffset < 0 || coord.y + yOffset >= this.board.length) {
        return WALL;
      }
      return this.board[coord.y + yOffset][coord.x + xOffset];
    }
    count(piece: Space) {
      let count = 0

      for (let y = 0; y < this.board.length; y++) {
        for (let x = 0; x < this.board[y].length; x++) {
          if (this.board[y][x] === piece) {
            count++;
          }
        }
      }
      return count;
    }
    distance(from: Coord, to: Coord) {
      return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    }
    canMoveDiagonally(pos: Coord) {
      // if the row and column number are both odd or both even, diagonals are valid.
      if (pos.x % 2 == pos.y % 2) {
        return true;
      }
      return false;
    }
    isJump(from: Coord, to: Coord) {
      return (from.x + to.x) % 2 === 0 && (from.y + to.y) % 2 === 0
    }
    find(piece: Space) {
      for (let y = 0; y < this.board.length; y++) {
        for (let x = 0; x < this.board[y].length; x++) {
          if (this.board[y][x] === piece) {
            return { x, y };
          }
        }
      }
    }
    move(from: Coord, to: Coord) {
      const piece = this.get(from);
      this.board[to.y][to.x] = piece;
      this.board[from.y][from.x] = EMPTY;

      // Jumps are always 2 spaces vertically and/or horizontally
      if (this.isJump(from, to)) {
        const mid = {
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2,
        };
        this.board[mid.y][mid.x] = EMPTY;
      }
    }
}

class Game {
    board: Board;
    players: Player[];
    turn: Side;
    jumpOnly: boolean;
    moves: Move[];

    constructor() {
        this.board = new Board();
        this.players = [];
        this.turn = Side.FOX;
        this.moves = [];
        this.jumpOnly = false;
    }

    addPlayer(name: string, side: Side) {
        this.players.push(new Player(name, side));
    }

    reset() {
        this.board = new Board();
        this.turn = Side.FOX;
    }
    hasValidMoves() {
      // Find the fox position
      const fox = this.board.find(FOX);
      if (!fox) {
        return false;
      }
      // Find the valid moves
      // Orthogonally adjacent cells are valid moves
      const orthogonals = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [x, y] of orthogonals) {
        if (this.board.get(fox, x, y) == EMPTY) {
          return true;
        }
      }

      if (!this.board.canMoveDiagonally(fox)) return false
      
      const diagonals = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [x, y] of diagonals) {
        if (this.board.get(fox, x, y) == EMPTY) {
          return true;
        }
      }
      return false;
    }
    hasValidJumps() {
      // Find the fox position
      const fox = this.board.find(FOX);
      if (!fox) {
        return false;
      }
      // Find the valid jumps
      // Orthogonally adjacent cells are valid jumps
      let validJumps = false;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([x, y]) => {
        if (this.board.get(fox, x, y) == GOOSE && this.board.get(fox, x * 2, y * 2) == EMPTY) {
          validJumps = true;
          return true
        }
      });

      if (validJumps) return validJumps;
      if (!this.board.canMoveDiagonally(fox)) return validJumps;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, y]) => {
        if (this.board.get(fox, x, y) == GOOSE && this.board.get(fox, x * 2, y * 2) == EMPTY) {
          validJumps = true;
          return true
        }
      });
      return validJumps;
    }

    pass() {
      if (!this.jumpOnly) {
        console.log(`Invalid move: ${this.turn} cannot pass`);
        return false;
      }
      console.log(`${this.turn} passed`);
      this.turn = Side.GOOSE
      this.jumpOnly = false;
      return true;
    }

    move(from: Coord, to: Coord) {
      // Make sure the from is the same as the turn
      if (this.turn !== this.board.get(from)) {
        console.log(`Invalid move: ${this.board.get(from)} is not ${this.turn}`);
        return false;
      }
      // Make sure the to is empty
      if (this.board.get(to) !== EMPTY) {
        console.log(`Invalid move: ${this.board.get(to)} is not empty`);
        return false;
      }

      if (to.x - to.y !== 0 && from.x - from.y !== 0) { // It's a diagonal move
        if (from.x % 2 !== from.y % 2) { // The from cell is not allowed diagonals
          console.log(`Invalid move: ${from} is not allowed diagonals`);
          return false;
        }
      }

      if (this.jumpOnly && !this.board.isJump(from, to)) {
        console.log(`Invalid move: ${from} is not a jump`);
        return false;
      }

      this.board.move(from, to);
      this.moves.push({ from, to });

      // Check win conditions
      // 🪿 wins if the fox has no valid moves or jumps
      // 🦊 wins if there are fewer than 4 🪿 on the board
      if (this.board.count(GOOSE) < 4) {
        console.log(`🦊 wins!`);
        return true;
      }

      if (!this.hasValidMoves() && !this.hasValidJumps()) {
        console.log(`🪿 wins!`);
        return true;
      }
      console.log(this.board.toString());
      if (this.board.isJump(from, to) && this.hasValidJumps()) {
        this.jumpOnly = true;
        console.log(`Valid jump found, allowing the fox to keep his turn`);
        return true;
      } else {
        console.log(`No valid jump found, switching turns`);
        this.jumpOnly = false;
        this.turn = this.turn === Side.FOX ? Side.GOOSE : Side.FOX;
      }
    }
}

export { Game };