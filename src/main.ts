
// W must be evaluated first: it defines the global that every module below uses.
import './scripts/libraries/w';
import './scripts/libraries/w-extensions';
// Optional: remove this import (and W.enableXR?.() below) for desktop-only.
import './scripts/libraries/w-xr';
import { perlinTexture, starTexture, testTexture } from './scripts/Textures';
import { MODES, rotateAxisAngle } from './scripts/Utils';
import { Game, getBestMove } from './scripts/Game';
import { loadModel } from './scripts/ModelLoader';
import { GameView } from './scripts/GameView';
import { sleep } from './scripts/Utils';


const initGame = async (mode: number) => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const game = new Game(mode);
    const tex = perlinTexture();

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
    W.camera({ n: 'camera', y: 12, z: 0, rx: -52 });
    W.light({ x: -0.5, y: -1, z: 0 });
    W.ambient(0.3)
    W.group({ n: 'G', ry: 0, z: -2 });

    // Scene
    // Floor
    W.plane({
        n: 'floor',
        g: 'G', x: 0, y: -1, rx: -90, w: 200, h: 200, ts: 2, t: tex, b: '00f', mix: 0.5, selectable: false,
    });



    // Test objects

    // // Billboard
    // W.billboard({ n: 'sign', g: 'G', x: 5, y: 2, z: -5, w: 2, h: 1, t: tex, selectable: false });

    // // Tiled Cube
    // const testTex = testTexture(2048);
    // W.tileCube({
    //     n: 'cube', g: 'G', x: -1.5, y: 0.5, w: 1, h: 1, d: 1, t: testTex, selectable: true,
    //     onSelectStart: rotateObject(90),
    //     onSelectEnd: rotateObject(0),
    // });

    // Pyramid
    // W.pyramid({ g: 'G', x: 0, y: 0.5, ts: 3, t: tex, selectable: true });

    // // Rotating Cylinder
    // W.cylinder({ n: 'cylinder', g: 'G', rx: 0, b: '00f', mix: 0.1, w: 1, h: 1, d: 1, t: testTex });
    // // Star skybox
    // const starTex = starTexture(2048);
    // W.sphere({ n: 'skybox', t: starTex, x: 0, y: 2, z: 0, rx: 23, size: -500, unlit: true });
    // // Unicorn
    // const unicorn = loadModel('unicorn');
    // W.move({ n: unicorn, x: 0, y: 0, z: -16 });
    // let cylinderRotation = 0;
    // setInterval(() => {
    //     cylinderRotation += 0.01;
    //     const rotationMatrix = rotateAxisAngle([0, 18, 100], cylinderRotation);
    //     W.move({ n: 'cylinder', M: rotationMatrix });
    //     W.move({ n: 'skybox', M: rotationMatrix });

    //     W.move({ n: unicorn, ry: cylinderRotation * 30 })
    // }, 16);

    const gameView = new GameView(game);
    gameView.render();
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
    console.log(modeId)
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