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
    get(coord: Coord) {
      if (coord.x < 0 || coord.x >= this.board[0].length || coord.y < 0 || coord.y >= this.board.length) {
        return WALL;
      }
      return this.board[coord.y][coord.x];
    }
    distance(from: Coord, to: Coord) {
      return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
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
    move(from: Coord, to: Coord, ): boolean {
      const piece = this.get(from);
      this.board[to.y][to.x] = piece;
      this.board[from.y][from.x] = EMPTY;

      // Jumps are always 2 spaces vertically and/or horizontally
      if ((from.x + to.x) % 2 === 0 && (from.y + to.y) % 2 === 0) {
        const mid = {
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2,
        };
        this.board[mid.y][mid.x] = EMPTY;
        return true;
      }
      return false;
    }
}

class Game {
    board: Board;
    players: Player[];
    turn: Side;
    moves: Move[];

    constructor() {
        this.board = new Board();
        this.players = [];
        this.turn = Side.FOX;
        this.moves = [];
    }

    addPlayer(name: string, side: Side) {
        this.players.push(new Player(name, side));
    }

    reset() {
        this.board = new Board();
        this.turn = Side.FOX;
    }

    hasValidJumps() {
      // Find the fox position
      const fox = this.board.find(FOX);
      if (!fox) {
        return false;
      }
      // Find the valid jumps
      [{x: -2, y: 0}, {x: 2, y: 0}, {x: 0, y: -2}, {x: 0, y: 2}].forEach(({x, y}) => {
        const to = { x: fox.x + x, y: fox.y + y };
        
      });
      return false;
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

      const didJump = this.board.move(from, to);
      this.moves.push({ from, to });
      console.log(this.board.toString());
      this.turn = this.turn === Side.FOX ? Side.GOOSE : Side.FOX;
      // TODO: Allow the fox to keep his turn if he has a jump available
      return false;
    }
}

export { Game };