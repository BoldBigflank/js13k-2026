import { Events } from "./scripts/libraries/Events";
import { MOVE_EVENT, JUMP_EVENT, SELECT_EVENT, GAME_OVER_EVENT } from "./Types";
import zzfx from './scripts/libraries/ZzFXMicro.min.js';
import { sleep } from "./scripts/Utils";

const playSound = async (sound: string, delay: number = 0) => {
    await sleep(delay);
    if (sound == 'move') {
        zzfx(...[,,198,,.04,.08,,,,14,,,,,,,,.98,.03]);
    } else if (sound == 'jump') {
        zzfx(...[,,98,.03,.02,.09,,.2,4,84,,,,.1,,.1,,.7,.04]); // Jump 11
    } else if (sound == 'select') {
        zzfx(...[,,360,,,.14,,2.2,,58,157,.04,,,17,,,.85,.03,,-1123]); // Pickup 25
    } else if (sound == 'gameOver'){ 
        zzfx(...[1.3,,167,.02,.12,.4,,,-8,,482,.07,,,,.1,.19,.92,.29]); // Powerup 38
    }
}
export const initSFX = () => {
    Events.Instance.on(MOVE_EVENT, (name: string) => {
        playSound('move');
    });
    Events.Instance.on(JUMP_EVENT, (name: string) => {
        playSound('jump', 250);
    });
    Events.Instance.on(SELECT_EVENT, (name: string) => {
        playSound('select', 0);
    });
    Events.Instance.on(GAME_OVER_EVENT, (name: string) => {
        playSound('gameOver', 0);
    });
}