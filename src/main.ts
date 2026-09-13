
// W must be evaluated first: it defines the global that every module below uses.
import './scripts/libraries/w';
import './scripts/libraries/w-extensions';
// Optional: remove this import (and W.enableXR?.() below) for desktop-only.
import './scripts/libraries/w-xr';
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

    // Camera group
    W.camera({ n: 'camera', y: 3, z: 4, rx: -52 });
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