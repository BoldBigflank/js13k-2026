import { Side } from "../Types";

class Player {
    name: string;
    uuid: string;
    type: 'player' | 'cpu';
    side: Side;

    constructor(name: string, side: Side, type: 'player' | 'cpu') {
        this.name = name;
        this.uuid = crypto.randomUUID();
        this.side = side;
        this.type = type;
    }
}

export { Player }