/**
 * A simple event system. Allows you to hook into Kontra lifecycle events or create your own, such as for [Plugins](api/plugin).
 *
 * ```ts
 * import { Events } from './libraries/Events';
 *
 * function callback(a: number, b: number, c: number) {
 *   console.log({a, b, c});
 * }
 *
 * Events.Instance.on('myEvent', callback);
 * Events.Instance.emit('myEvent', 1, 2, 3);  //=> {a: 1, b: 2, c: 3}
 * Events.Instance.off('myEvent', callback);
 * ```
 * @sectionName Events
 */

/**
 * There are currently only three lifecycle events:
 * - `init` - Emitted after `kontra.init()` is called.
 * - `tick` - Emitted every frame of [GameLoop](api/gameLoop) before the loops `update()` and `render()` functions are called.
 * - `assetLoaded` - Emitted after an asset has fully loaded using the asset loader. The callback function is passed the asset and the url of the asset as parameters.
 * @sectionName Lifecycle Events
 */

export class Events {
    private static _instance: Events;
    private _callbacks: { [key: string]: Function[] };
  
    private constructor() {
      this._callbacks = {};
    }
  
    public static get Instance(): Events {
      if (!Events._instance) {
        Events._instance = new Events();
      }
      return Events._instance;
    }
  
    /**
     * Register a callback for an event to be called whenever the event is emitted. The callback will be passed all arguments used in the `emit` call.
     * @param event - Name of the event.
     * @param callback - Function that will be called when the event is emitted.
     */
    public on(event: number, callback: Function): void {
      this._callbacks[event] = this._callbacks[event] || [];
      this._callbacks[event].push(callback);
    }
  
    /**
     * Remove a callback for an event.
     * @param event - Name of the event.
     * @param callback - The function that was passed during registration.
     */
    public off(event: number, callback: Function): void {
      this._callbacks[event] = (this._callbacks[event] || []).filter(
        (fn) => fn !== callback,
      );
    }
  
    /**
     * Call all callback functions for the event. All arguments will be passed to the callback functions.
     * @param event - Name of the event.
     * @param args - Comma separated list of arguments passed to all callbacks.
     */
    public emit(event: number, ...args: any[]): void {
      (this._callbacks[event] || []).forEach((fn) => fn(...args));
    }
  
    /**
     * Reset all callbacks (expose for testing)
     */
    public _reset(): void {
      Object.keys(this._callbacks).forEach((key) => {
        delete this._callbacks[key];
      });
    }
  
    /**
     * Get all callbacks (expose for testing)
     */
    public getCallbacks(): { [key: string]: Function[] } {
      return this._callbacks;
    }
  }
  