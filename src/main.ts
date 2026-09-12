
// W must be evaluated first: it defines the global that every module below uses.
import './scripts/libraries/w';
import './scripts/libraries/w-extensions';
// Optional: remove this import (and W.enableXR?.() below) for desktop-only.
import './scripts/libraries/w-xr';
import { perlinTexture } from './scripts/Textures';
import { MODES } from './scripts/Utils';
import { Game } from './scripts/Game';
import { GameView } from './scripts/GameView';
import { sleep } from './scripts/Utils';
import { CPU } from './scripts/CPU';
import { Events } from './scripts/libraries/Events';
import { GAME_START_EVENT } from './Types';
import { initSFX } from './SFX';

const initGame = async (mode: number) => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const game = new Game(mode);
    new CPU(game);
    initSFX();
    W.reset(canvas);

    W.enableMouseControls();
    W.enableXR?.();

    // Test moves
    // game.move({ x: 3, y: 3 }, { x: 2, y: 4 }); // 🦊 moves away
    // game.move({ x: 2, y: 2 }, { x: 2, y: 3 }); // 🪿 moves down
    // game.move({ x: 2, y: 4 }, { x: 2, y: 2 }); // 🦊 jumps 🪿
    // game.move({ x: 4, y: 2 }, { x: 4, y: 3 }); // 🪿 moves down
    // game.move({ x: 2, y: 2 }, { x: 4, y: 2 }); // 🦊 jumps 🪿 and has another jump
    // game.pass() // 🦊 doesn't take the jump
    // (async () => {
    //     // Run the loop in a microtask to avoid blocking the main thread
    //     let moveCount = 0;
    //     while (!game.gameState.winner && moveCount < 10) {
    //         moveCount++;
    //         // Optionally, await a small delay to yield to the event loop
    //         await new Promise(resolve => setTimeout(resolve, 0));
    //         const bestMove = getBestMove(game.gameState, 5);
    //         if (bestMove) {
    //             game.move(bestMove);
    //         }
    //     }
    // })();


    // Camera group
    W.camera({ n: 'camera', y: 0, z: 0, rx: -52 });
    W.light({ x: 0.2, y: -0.7, z: -0.6 });
    W.ambient(0.3)
    W.group({ n: 'G', ry: 0, z: -2 });

    // Scene
    const gameView = new GameView(game);
    gameView.render();
    Events.Instance.emit(GAME_START_EVENT);
}

const setLoading = async (isLoading: boolean) => {
    const b = document.getElementById('p')!
    if (isLoading) {
        b.setAttribute('disabled', 'true')
        b.innerHTML = 'LOADING...'
    } else {
        b.removeAttribute('disabled')
        b.innerHTML = 'JOIN'
    }
}

const startGame = async (modeId: number) => {
    await setLoading(true)
    await sleep(1) // Wait a tick for the UI to update
    await initGame(modeId)
    setLoading(false)
    // Update the UI
    document.getElementById('i')!.style.display = 'none'
    document.getElementById('c')!.style.display = 'block'
}

const setupButton = () => {
    const b = document.getElementById('p') as HTMLButtonElement
    b.style.display = 'inline-block'
    b.innerHTML = ''
    MODES.forEach(mode => {
        const p = document.createElement('p')
        const button = document.createElement('button')
        button.id = `mode-${mode.id}`
        button.onclick = () => startGame(mode.id)
        button.innerHTML = mode.name
        p.appendChild(button)
        b.appendChild(p)
    })
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', setupButton)
} else {
    setupButton()
}