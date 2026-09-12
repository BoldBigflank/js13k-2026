import { Side } from "../Types";

class Player {
    type: 'player' | 'cpu';
    side: Side;

    constructor(side: Side, type: 'player' | 'cpu') {
        this.side = side;
        this.type = type;
    }
}

export { Player }