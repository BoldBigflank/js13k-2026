// WebXR augmentation for W
// ========================
// Loaded after w.js and w-extensions.js (which own the desktop draw loop,
// the shared scene pass and the raycast helpers reused here).
// Adds XR session lifecycle, stereo drawView, controller input selection,
// and W.enableXR() for the Enter/Exit VR button.
//
// Opt-in: import this file and call W.enableXR(). Omit both for desktop-only.
//
/*
Copyright 2018 The Immersive Web Community Group

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import "./w";
import "./w-extensions";

(() => {
  const prevReset = W.reset;
  const prevDist = W.dist;

  // options: { context, autoDraw }
  W.reset = (canvas, options = {}) => {
    if (typeof options !== "object" || options === null) options = {};

    // Always request an XR-capable context while this module is loaded
    const contextAttribs = { ...(options.context || {}), xrCompatible: true };

    prevReset(canvas, { ...options, context: contextAttribs });

    W.xrActive = false;
    W._xrEye = null;
    W._xrHead = null;
  };

  // Draw one XR eye using WebXR view matrices
  W.drawView = (projectionMatrix, viewTransform, headTransform, dt) => {
    const eye = new DOMMatrix(viewTransform.matrix);
    const head = new DOMMatrix(headTransform.matrix);
    W._xrEye = eye;
    W._xrHead = head;
    const pv = new DOMMatrix(projectionMatrix);
    pv.multiplySelf(eye.inverse());

    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "eye"),
      false,
      eye.toFloat32Array(),
    );
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "pv"),
      false,
      pv.toFloat32Array(),
    );

    W.drawScene(dt || 16, false);
  };

  W.startXR = () => {
    W.xrActive = true;
  };

  W.endXR = () => {
    W.xrActive = false;
    W._xrEye = null;
    W._xrHead = null;
    W.lastFrame = undefined;
    W.gl.bindFramebuffer(W.gl.FRAMEBUFFER, null);
    setTimeout(W.draw, 16);
  };

  // Prefer the XR head pose while in XR; otherwise fall back to the camera
  W.dist = (a, b = W._xrHead) => prevDist(a, b);

  // ------------------------------------------------------------------
  // Controller input / ray selection
  // ------------------------------------------------------------------

  const handIndex = (inputSource) =>
    inputSource.handedness === "left" ? 0 : 1;

  const inputId = (prefix, inputSource, index) =>
    `${prefix}_${inputSource.handedness || "none"}_${index}`;

  /** @type {Record<string, Object>} */
  const registeredShapeHandlers = {};

  class WebXRInputSelection {
    /**
     * Register selection handlers for a shape type.
     * @param {string} type W shape type, or "default" for all shapes
     * @param {Object} handlers
     */
    static registerShape(type, handlers) {
      registeredShapeHandlers[type] = {
        ...registeredShapeHandlers[type],
        ...handlers,
      };
    }

    /**
     * @param {Object} [options]
     * @param {number} [options.batonWidth=0.02]
     * @param {number} [options.batonLength=0.1]
     * @param {number} [options.laserWidth=0.01]
     * @param {number} [options.laserLength=10]
     * @param {number} [options.hitSphereSize=0.03]
     * @param {Object} [options.colors]
     * @param {Record<string, Object>} [options.shapes] per-type handlers for this instance
     */
    constructor(options = {}) {
      this.options = options;
      this.batonWidth = options.batonWidth ?? 0.03;
      this.batonLength = options.batonLength ?? 0.15;
      this.laserWidth = options.laserWidth ?? 0.01;
      this.laserLength = options.laserLength ?? 10;
      this.hitSphereSize = options.hitSphereSize ?? 0.03;
      this.colors = {
        left: "48f",
        right: "f44",
        none: "888",
        ...options.colors,
      };
      this.shapes = options.shapes || {};

      this._session = null;
      this._getRefSpace = null;
      this._inputObjectIds = new Set();
      this._objectBases = new Map();
      this._selected = [null, null];
      this._hovered = [null, null];

      this._onSelectStart = (ev) => this.__onSelectStart(ev);
      this._onSelect = (ev) => this.__onSelect(ev);
      this._onSelectEnd = (ev) => this.__onSelectEnd(ev);
    }

    getBase(name, object) {
      if (!this._objectBases.has(name)) {
        this._objectBases.set(name, {
          w: object.w ?? 1,
          h: object.h ?? 1,
          d: object.d ?? 1,
          b: object.b ?? "888",
        });
      }
      return this._objectBases.get(name);
    }

    getHandler(method, object) {
      return (
        object?.[method] ??
        registeredShapeHandlers.default?.[method] ??
        registeredShapeHandlers[object.type]?.[method] ??
        this.shapes.default?.[method] ??
        this.shapes[object.type]?.[method]
      );
    }

    dispatch(method, ctx) {
      const startName = ctx.name;
      if (!startName) return;
      W.bubble(
        method,
        startName,
        {
          ...ctx,
          targetName: ctx.targetName ?? startName,
          target: ctx.target ?? ctx.object,
        },
        (m, object) => this.getHandler(m, object),
      );
    }

    ctx(
      { name, object, hit },
      { hand, inputSource, frame, event = null, confirmed = false },
    ) {
      return {
        name,
        object,
        hit,
        event,
        hand,
        inputSource,
        frame,
        input: this,
        confirmed,
      };
    }

    rayHit(frame, inputSource) {
      const refSpace = this._getRefSpace?.();
      const pose =
        refSpace && frame.getPose(inputSource.targetRaySpace, refSpace);
      return pose && W.raycast?.(pose.transform.matrix);
    }

    updateHover(hand, hit, inputSource, frame) {
      const next = hit?.name ?? null;
      const prev = this._hovered[hand];
      const getHandler = (m, object) => this.getHandler(m, object);
      const extra = {
        hit: hit ?? null,
        event: null,
        hand,
        inputSource,
        frame,
        input: this,
        confirmed: false,
      };

      if (prev !== next) {
        W.hoverTransition(prev, next, extra, getHandler);
        this._hovered[hand] = next;
      }

      if (next) {
        W.bubble(
          "onHover",
          next,
          { ...extra, hit, targetName: next, target: hit.object },
          getHandler,
        );
      }
    }

    trackInputObject(id, state, activeIds) {
      activeIds.add(id);
      W.setState(state);
      this._inputObjectIds.add(id);
    }

    /**
     * @param {XRSession} session
     * @param {Function} getRefSpace returns the active XRReferenceSpace
     */
    attach(session, getRefSpace) {
      this.detach();
      this._session = session;
      this._getRefSpace = getRefSpace;

      session.addEventListener("selectstart", this._onSelectStart);
      session.addEventListener("select", this._onSelect);
      session.addEventListener("selectend", this._onSelectEnd);
    }

    /**
     * @param {XRFrame} frame
     */
    update(frame) {
      if (!this._session || typeof W === "undefined") return;

      const refSpace = this._getRefSpace?.();
      if (!refSpace) return;

      const activeIds = new Set();

      frame.session.inputSources.forEach((inputSource, index) => {
        const hand = handIndex(inputSource);
        const color =
          this.colors[inputSource.handedness || "none"] || this.colors.none;
        const batonId = inputId("xr_baton", inputSource, index);
        const laserId = inputId("xr_laser", inputSource, index);
        const hitId = inputId("xr_input_hit", inputSource, index);

        const hit = this.rayHit(frame, inputSource);
        this.updateHover(hand, hit, inputSource, frame);

        const rayPose = frame.getPose(inputSource.targetRaySpace, refSpace);

        if (rayPose) {
          this.trackInputObject(
            batonId,
            {
              n: batonId,
              type: "cube",
              M: new DOMMatrix(rayPose.transform.matrix).translateSelf(
                0,
                0,
                this.batonLength / 2,
              ),
              x: 0,
              y: 0,
              z: 0,
              rx: 0,
              ry: 0,
              rz: 0,
              w: this.batonWidth,
              h: this.batonWidth,
              d: this.batonLength,
              b: color,
              mix: 1,
            },
            activeIds,
          );

          const length = hit?.distance > 0 ? hit.distance : this.laserLength;

          this.trackInputObject(
            laserId,
            {
              n: laserId,
              type: "cube",
              M: new DOMMatrix(rayPose.transform.matrix).translateSelf(
                0,
                0,
                -length / 2,
              ),
              x: 0,
              y: 0,
              z: 0,
              rx: 0,
              ry: 0,
              rz: 0,
              w: this.laserWidth,
              h: this.laserWidth,
              d: length,
              b: color,
              mix: 1,
              unlit: true,
            },
            activeIds,
          );
        }

        if (hit?.point) {
          this.trackInputObject(
            hitId,
            {
              n: hitId,
              type: "sphere",
              x: hit.point[0],
              y: hit.point[1],
              z: hit.point[2],
              size: this.hitSphereSize,
              s: 1,
              b: color,
              mix: 1,
              unlit: true,
            },
            activeIds,
          );
        }
      });

      for (const id of this._inputObjectIds) {
        if (!activeIds.has(id)) {
          delete W.next[id];
          delete W.current[id];
          this._inputObjectIds.delete(id);
        }
      }
    }

    detach() {
      if (this._session) {
        this._session.removeEventListener("selectstart", this._onSelectStart);
        this._session.removeEventListener("select", this._onSelect);
        this._session.removeEventListener("selectend", this._onSelectEnd);
      }

      this._session = null;
      this._getRefSpace = null;
      this._selected = [null, null];
      this._hovered = [null, null];

      if (typeof W !== "undefined") {
        for (const id of this._inputObjectIds) {
          delete W.next[id];
          delete W.current[id];
        }
      }
      this._inputObjectIds.clear();
    }

    __onSelectStart(ev) {
      const hand = handIndex(ev.inputSource);
      const hit = this.rayHit(ev.frame, ev.inputSource);
      if (!hit) return;

      this._selected[hand] = { hit, confirmed: false };
      this.dispatch(
        "onSelectStart",
        this.ctx(
          { name: hit.name, object: hit.object, hit },
          { hand, inputSource: ev.inputSource, frame: ev.frame, event: ev },
        ),
      );
    }

    __onSelect(ev) {
      const hand = handIndex(ev.inputSource);
      const slot = this._selected[hand];
      if (!slot?.hit) return;

      slot.confirmed = true;
      this.dispatch(
        "onSelect",
        this.ctx(
          { name: slot.hit.name, object: slot.hit.object, hit: slot.hit },
          {
            hand,
            inputSource: ev.inputSource,
            frame: ev.frame,
            event: ev,
            confirmed: true,
          },
        ),
      );
    }

    __onSelectEnd(ev) {
      const hand = handIndex(ev.inputSource);
      const slot = this._selected[hand];
      if (slot?.hit) {
        this.dispatch(
          "onSelectEnd",
          this.ctx(
            { name: slot.hit.name, object: slot.hit.object, hit: slot.hit },
            {
              hand,
              inputSource: ev.inputSource,
              frame: ev.frame,
              event: ev,
              confirmed: slot.confirmed,
            },
          ),
        );
      }

      this._selected[hand] = null;
    }
  }

  // ------------------------------------------------------------------
  // Session UI + lifecycle
  // ------------------------------------------------------------------

  const XR_STYLE_ID = "w-xr-styles";

  const ensureXRStyles = () => {
    if (document.getElementById(XR_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = XR_STYLE_ID;
    style.textContent = `
      #VRButton{padding:12px 24px;border:2px solid #fffc;border-radius:2px;background:#ef3eda;font-weight:700;font:24px sans-serif;color:#fff;cursor:pointer}
      #VRButton[disabled]{opacity:.5;cursor:default}
    `;
    document.head.appendChild(style);
  };

  /**
   * Enable WebXR immersive-vr: VR button, session lifecycle, controller rays.
   * @param {Object} [options]
   * @param {HTMLElement} [options.parent] button mount point (default: header or body)
   * @param {Object} [options.input] options forwarded to WebXRInputSelection
   */
  W.enableXR = (options = {}) => {
    ensureXRStyles();

    const xrInput = new WebXRInputSelection(options.input);
    let xrSession = null;
    let xrRefSpace = null;
    let lastXRFrameTime = 0;

    const parent =
      options.parent ||
      document.querySelector("header") ||
      document.body;

    let xrButton = document.getElementById("VRButton");
    if (!xrButton) {
      xrButton = document.createElement("button");
      xrButton.type = "button";
      xrButton.id = "VRButton";
      parent.appendChild(xrButton);
    }
    xrButton.disabled = true;
    xrButton.textContent = "VR NOT FOUND";

    const setXRButton = (session) => {
      xrSession = session;
      if (session) {
        xrButton.textContent = "EXIT VR";
        xrButton.disabled = false;
      } else if (xrButton.dataset.supported === "1") {
        xrButton.textContent = "ENTER VR";
        xrButton.disabled = false;
      } else {
        xrButton.textContent = "VR NOT FOUND";
        xrButton.disabled = true;
      }
    };

    const requestPlayAreaReferenceSpace = async (session) => {
      for (const type of ["local-floor", "local"]) {
        try {
          return await session.requestReferenceSpace(type);
        } catch (_) { }
      }
      throw new Error("No supported reference space");
    };

    const onXRFrame = (t, frame) => {
      const session = frame.session;
      session.requestAnimationFrame(onXRFrame);

      const dt = t - (lastXRFrameTime || t - 16);
      lastXRFrameTime = t;

      const pose = frame.getViewerPose(xrRefSpace);
      if (!pose) return;

      xrInput.update(frame);

      const glLayer = session.renderState.baseLayer;
      W.gl.bindFramebuffer(W.gl.FRAMEBUFFER, glLayer.framebuffer);
      W.gl.clear(W.gl.COLOR_BUFFER_BIT | W.gl.DEPTH_BUFFER_BIT);

      for (const view of pose.views) {
        const viewport = glLayer.getViewport(view);
        W.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        W.drawView(view.projectionMatrix, view.transform, pose.transform, dt);
      }
    };

    const onSessionEnded = () => {
      xrInput.detach();
      setXRButton(null);
      W.endXR();
      xrRefSpace = null;
      lastXRFrameTime = 0;
    };

    const onSessionStarted = async (session) => {
      setXRButton(session);
      session.addEventListener("end", onSessionEnded);

      await W.gl.makeXRCompatible();
      session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, W.gl),
      });

      W.startXR();

      xrRefSpace = await requestPlayAreaReferenceSpace(session);
      if (typeof xrRefSpace.addEventListener === "function") {
        xrRefSpace.addEventListener("reset", (event) => {
          console.debug("XR reference space reset", event.transform);
        });
      }
      xrInput.attach(session, () => xrRefSpace);
      session.requestAnimationFrame(onXRFrame);
    };

    const onRequestSession = () =>
      navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor"],
      }).then(onSessionStarted);

    xrButton.onclick = () => {
      if (xrSession) {
        xrSession.end();
      } else if (!xrButton.disabled) {
        onRequestSession().catch((err) => {
          console.error(`XRSession creation failed: ${err.message}`);
          xrButton.disabled = true;
          setTimeout(() => setXRButton(null), 1000);
        });
      }
    };

    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
        if (supported) xrButton.dataset.supported = "1";
        setXRButton(null);
      });
    }

    return { button: xrButton, input: xrInput };
  };

  W.WebXRInputSelection = WebXRInputSelection;
  W._xr = { prevReset, prevDist };
})();
