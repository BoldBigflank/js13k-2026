// Non-XR local extensions for W
// ==============================
// Loaded after w.js. Adds texture tiling (ts/rep), tileCube, unlit shading,
// reset options, NEAREST sampling, setState return values, group size,
// and desktop pointer-lock mouse look / center-screen picking.

(() => {
  const originalReset = W.reset;
  const originalSetState = W.setState;
  const originalRender = W.render;
  const originalGroup = W.group;

  // Cube with flat face normals for per-face texture tiling (w×h / d×h / w×d)
  if (W.models.cube) {
    W.add("tileCube", {
      vertices: W.models.cube.vertices,
      uv: W.models.cube.uv,
      normals: [
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1, // front
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0, // right
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0, // up
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        -1,
        0,
        0,
        -1,
        0,
        0,
        -1,
        0,
        0, // left
        -1,
        0,
        0,
        -1,
        0,
        0,
        -1,
        0,
        0,
        0,
        0,
        -1,
        0,
        0,
        -1,
        0,
        0,
        -1, // back
        0,
        0,
        -1,
        0,
        0,
        -1,
        0,
        0,
        -1,
        0,
        -1,
        0,
        0,
        -1,
        0,
        0,
        -1,
        0, // down
        0,
        -1,
        0,
        0,
        -1,
        0,
        0,
        -1,
        0,
      ],
    });
  }

  // Cylinder
  const vertices = [];
  const indices = [];
  const uv = [];
  const precision = 20;
  const cylRadius = 0.5;
  const bottomCenterIdx = (precision + 1) * 4; // ring0, ring1, cap0, cap1, then centers
  const topCenterIdx = bottomCenterIdx + 1;

  // The rings have two stacked vertices, so that the uv doesn't go .95->0
  for (let i = 0; i <= precision; i++) {
    const a = (i * 2 * Math.PI) / precision;
    const x = Math.cos(a) * cylRadius;
    const z = Math.sin(a) * cylRadius;
    // Bottom ring
    vertices.push(x, -0.5, z);
    uv.push(1 - i / precision, 0);
    // Top ring
    vertices.push(x, 0.5, z);
    uv.push(1 - i / precision, 1);
    // Bottom cap
    vertices.push(x, -0.5, z);
    uv.push(0.5 - x, 0.5 - z);
    // Top cap
    vertices.push(x, 0.5, z);
    uv.push(0.5 + x, 0.5 - z);
  }

  // Bottom cap center
  vertices.push(0, -0.5, 0);
  uv.push(0.5, 0.5);
  // Top cap center
  vertices.push(0, 0.5, 0);
  uv.push(0.5, 0.5);

  for (let i = 0; i < precision; i++) {
    const next = i + 1;
    const b0 = i * 4;
    const b1 = next * 4;
    const t0 = b0 + 1;
    const t1 = b1 + 1;
    const c0 = t0 + 1;
    const c1 = t1 + 1;
    const d0 = c0 + 1;
    const d1 = c1 + 1;
    // Sides: each quad as two triangles
    indices.push(b0, t0, b1);
    indices.push(b1, t0, t1);

    // Bottom cap
    indices.push(c0, c1, bottomCenterIdx);
    indices.push(d1, d0, topCenterIdx);
  }

  W.add("cylinder", { vertices, uv, indices });

  const vertexShader = `#version 300 es
      precision highp float;                        // Set default float precision
      in vec4 pos, col, uv, normal;                 // Vertex attributes: position, color, texture coordinates, normal (if any)
      uniform mat4 pv, eye, m, im;                  // Uniform transformation matrices: projection * view, eye, model, inverse model
      uniform vec4 bb;                              // If the current shape is a billboard: bb = [w, h, 1.0, 0.0]
      uniform vec4 rep;                           // Texture repeat: [w, h, d, mode] (1: plane/billboard, 2: cube)
      uniform float ts;                           // Texture scale (tiles per unit at 1)
      out vec4 v_pos, v_col, v_uv, v_normal;        // Varyings sent to the fragment shader: position, color, texture coordinates, normal (if any)
      void main() {
        gl_Position = pv * (                        // Set vertex position: p * v * v_pos
          v_pos = bb.z > 0.                         // Set v_pos varying:
          ? m[3] + eye * (pos * bb)                 // Billboards always face the camera
          : m * pos                                 // Other objects rotate normally
        );
        v_col = col;                                // Set varyings
        vec2 uv2 = uv.xy;
        if (rep.w == 1.) uv2 *= rep.xy;            // Plane / billboard: 1 texture tile per unit
        else if (rep.w == 2.) {                     // Cube: tile per face based on w, h, d
          vec3 an = abs(normal.xyz);
          if (an.x >= an.y && an.x >= an.z) uv2 *= rep.zy;
          else if (an.y >= an.z) uv2 *= rep.xz;
          else uv2 *= rep.xy;
        }
        if (ts != 1.) uv2 *= ts;
        v_uv = vec4(uv2, uv.zw);
        v_normal = transpose(inverse(m)) * normal;  // recompute normals to match model thansformation
      }`;

  const fragmentShader = `#version 300 es
      precision highp float;                  // Set default float precision
      in vec4 v_pos, v_col, v_uv, v_normal;   // Varyings received from the vertex shader: position, color, texture coordinates, normal (if any)
      uniform vec3 light;                     // Uniform: light direction, smooth normals enabled
      uniform vec4 o;                         // options [smooth, shading enabled, ambient, mix]
      uniform float unlit;                    // 1: skip lighting, render at full brightness
      uniform sampler2D sampler;              // Uniform: 2D texture
      out vec4 c;                             // Output: final fragment color

      void main() {
        vec4 base = mix(texture(sampler, v_uv.xy), v_col, o[3]);  // base color (mix of texture and rgba)
        if (unlit > 0.) {                                         // emissive / unlit: ignore scene lighting
          c = base;
        } else if(o[1] > 0.){                                       // if lighting/shading is enabled:
          c = vec4(                                                 // output = vec4(base color RGB * (directional shading + ambient light)), base color Alpha
            base.rgb * (max(0., dot(light, -normalize(             // Directional shading: compute dot product of light direction and normal (0 if negative)
              o[0] > 0.                                             // if smooth shading is enabled:
              ? vec3(v_normal.xyz)                                  // use smooth normals passed as varying
              : cross(dFdx(v_pos.xyz), dFdy(v_pos.xyz))             // else, compute flat normal by making a cross-product with the current fragment and its x/y neighbours
            )))
            + o[2]),                                                // add ambient light passed as uniform
            base.a                                                  // use base color's alpha
          );
        } else {
          c = base;
        }
      }`;

  W._compileProgram = (vertSrc, fragSrc) => {
    let shader;
    W.program = W.gl.createProgram();

    W.gl.shaderSource(
      (shader = W.gl.createShader(35633 /* VERTEX_SHADER */)),
      vertSrc,
    );
    W.gl.compileShader(shader);
    W.gl.attachShader(W.program, shader);
    if (W.plugin.debug)
      console.log("vertex shader:", W.gl.getShaderInfoLog(shader) || "OK");

    W.gl.shaderSource(
      (shader = W.gl.createShader(35632 /* FRAGMENT_SHADER */)),
      fragSrc,
    );
    W.gl.compileShader(shader);
    W.gl.attachShader(W.program, shader);
    if (W.plugin.debug)
      console.log("fragment shader:", W.gl.getShaderInfoLog(shader) || "OK");

    W.gl.linkProgram(W.program);
    W.gl.useProgram(W.program);
    if (W.plugin.debug)
      console.log("program:", W.gl.getProgramInfoLog(W.program) || "OK");
  };

  W._extensionShaders = { vertex: vertexShader, fragment: fragmentShader };

  // Displayed canvas box (CSS) rather than the drawing-buffer attributes,
  // so a fullscreen canvas is not stuck at width=1024 height=768.
  W.canvasAspect = () => {
    const c = W.canvas;
    const w = c.clientWidth || c.width;
    const h = c.clientHeight || c.height;
    return w / h;
  };

  W.setProjection = (fov) => {
    const f = 1 / Math.tan((fov * Math.PI) / 180);
    const aspect = W.canvasAspect();
    W.projection = new DOMMatrix([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      -1001 / 999,
      -1,
      0,
      0,
      -2002 / 999,
      0,
    ]);
  };

  // Match the WebGL buffer to the document canvas and rebuild FOV.
  W.fitCanvas = () => {
    const c = W.canvas;
    if (!c || W.xrActive) return;
    const w = c.clientWidth | 0;
    const h = c.clientHeight | 0;
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      W.gl.viewport(0, 0, w, h);
      W.setProjection(W.next.camera?.fov || 30);
    }
  };

  // options: { context, autoDraw }
  W.reset = (canvas, options = {}) => {
    if (typeof options !== "object" || options === null) {
      // Upstream called reset(canvas, shader); ignore leftover shader arg
      options = {};
    }

    W.canvas = canvas;
    const displayW = canvas.clientWidth | 0;
    const displayH = canvas.clientHeight | 0;
    if (displayW && displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }
    W.objs = 0;
    W.current = {};
    W.next = {};
    W.textures = {};

    const contextAttribs = { ...(options.context || {}) };
    W.gl = canvas.getContext("webgl2", contextAttribs);

    W.gl.blendFunc(770 /* SRC_ALPHA */, 771 /* ONE_MINUS_SRC_ALPHA */);
    W.gl.activeTexture(33984 /* TEXTURE0 */);
    W.gl.enable(2884 /* CULL_FACE */);

    W._compileProgram(vertexShader, fragmentShader);

    W.gl.clearColor(1, 1, 1, 1);
    W.clearColor = (c) => W.gl.clearColor(...W.col(c));
    W.gl.enable(2929 /* DEPTH_TEST */);

    W.light({ y: -1 });
    W.camera({ fov: 30 });

    if (options.autoDraw !== false) setTimeout(W.draw, 16);
  };

  W.setState = (state, type, texture) => {
    state.n ||= "o" + W.objs++;

    if (state.size) state.w = state.h = state.d = state.size;

    if (state.t && state.t.width && !W.textures[state.t.id]) {
      texture = W.gl.createTexture();
      W.gl.pixelStorei(37441 /* UNPACK_PREMULTIPLY_ALPHA_WEBGL */, true);
      W.gl.bindTexture(3553 /* TEXTURE_2D */, texture);
      W.gl.pixelStorei(37440 /* UNPACK_FLIP_Y_WEBGL */, 1);
      W.gl.texImage2D(
        3553 /* TEXTURE_2D */,
        0,
        6408 /* RGBA */,
        6408 /* RGBA */,
        5121 /* UNSIGNED_BYTE */,
        state.t,
      );
      W.gl.texParameteri(
        3553 /* TEXTURE_2D */,
        10241 /* TEXTURE_MIN_FILTER */,
        9728 /* NEAREST */,
      );
      W.gl.texParameteri(
        3553 /* TEXTURE_2D */,
        10240 /* TEXTURE_MAG_FILTER */,
        9728 /* NEAREST */,
      );
      W.textures[state.t.id] = texture;
    }

    if (state.fov) W.setProjection(state.fov);

    state = {
      type,
      ...(W.current[state.n] = W.next[state.n] || {
        w: 1,
        h: 1,
        d: 1,
        x: 0,
        y: 0,
        z: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        b: "888",
        mode: 4,
        mix: 0,
        ts: 1,
      }),
      ...state,
      f: 0,
    };

    if (!state.t) {
      state.mix = 1;
    } else if (state.t && !state.mix) {
      state.mix = 0;
    }

    W.next[state.n] = state;
    return state;
  };

  W.render = (object, dt, buffer, model = W.models[object.type]) => {
    const ts = W.lerp(object.n, "ts") ?? 1;
    // Size-based tiling is opt-in: planes/billboards tile per unit, tileCube
    // tiles per face (w×h / d×h / w×d). Regular cubes keep UV 0–1 so a
    // texture stretches across each face instead of repeating by size.
    const repeat =
      W.plugin.builtinShapes &&
      ["plane", "billboard", "tileCube"].includes(object.type)
        ? object.type === "tileCube"
          ? 2
          : 1
        : 0;
    const wrap = repeat || ts !== 1;

    if (object.t) {
      W.gl.bindTexture(3553 /* TEXTURE_2D */, W.textures[object.t.id]);
      W.gl.texParameteri(
        3553 /* TEXTURE_2D */,
        10242 /* TEXTURE_WRAP_S */,
        wrap ? 10497 /* REPEAT */ : 33071 /* CLAMP_TO_EDGE */,
      );
      W.gl.texParameteri(
        3553 /* TEXTURE_2D */,
        10243 /* TEXTURE_WRAP_T */,
        wrap ? 10497 /* REPEAT */ : 33071 /* CLAMP_TO_EDGE */,
      );
      W.gl.texParameteri(
        3553 /* TEXTURE_2D */,
        10241 /* TEXTURE_MIN_FILTER */,
        9728 /* NEAREST */,
      );
      W.gl.texParameteri(
        3553 /* TEXTURE_2D */,
        10240 /* TEXTURE_MAG_FILTER */,
        9728 /* NEAREST */,
      );
      W.gl.uniform1i(W.gl.getUniformLocation(W.program, "sampler"), 0);
    }

    if (object.f < object.a) object.f += dt;
    if (object.f > object.a) object.f = object.a;

    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "m"),
      false,
      object.m.toFloat32Array(),
    );

    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "im"),
      false,
      object.m.inverse().toFloat32Array(),
    );

    if (
      W.plugin.debug &&
      !model &&
      !["camera", "light", "group"].includes(object.type)
    ) {
      console.warn(
        `tried to render model "${object.type}", which does not exist!`,
      );
    }

    if (model) {
      if (model && !model.verticesBuffer) {
        model.customNormals = !!model.normals;

        W.gl.bindBuffer(
          34962 /* ARRAY_BUFFER */,
          (model.verticesBuffer = W.gl.createBuffer()),
        );
        W.gl.bufferData(
          34962 /* ARRAY_BUFFER */,
          new Float32Array(model.vertices),
          35044 /* STATIC_DRAW */,
        );

        if (!model.normals && W.plugin.smooth) W.smooth(model);

        if (model.normals) {
          W.gl.bindBuffer(
            34962 /* ARRAY_BUFFER */,
            (model.normalsBuffer = W.gl.createBuffer()),
          );
          W.gl.bufferData(
            34962 /* ARRAY_BUFFER */,
            new Float32Array(model.normals.flat()),
            35044 /* STATIC_DRAW */,
          );
        }

        if (model.uv) {
          W.gl.bindBuffer(
            34962 /* ARRAY_BUFFER */,
            (model.uvBuffer = W.gl.createBuffer()),
          );
          W.gl.bufferData(
            34962 /* ARRAY_BUFFER */,
            new Float32Array(model.uv),
            35044 /* STATIC_DRAW */,
          );
        }

        if (model.indices) {
          W.gl.bindBuffer(
            34963 /* ELEMENT_ARRAY_BUFFER */,
            (model.indicesBuffer = W.gl.createBuffer()),
          );
          W.gl.bufferData(
            34963 /* ELEMENT_ARRAY_BUFFER */,
            new Uint16Array(model.indices),
            35044 /* STATIC_DRAW */,
          );
        }
      }

      W.gl.bindBuffer(34962 /* ARRAY_BUFFER */, model.verticesBuffer);
      W.gl.vertexAttribPointer(
        (buffer = W.gl.getAttribLocation(W.program, "pos")),
        3,
        5126 /* FLOAT */,
        false,
        0,
        0,
      );
      W.gl.enableVertexAttribArray(buffer);

      if (model.uvBuffer) {
        W.gl.bindBuffer(34962 /* ARRAY_BUFFER */, model.uvBuffer);
        W.gl.vertexAttribPointer(
          (buffer = W.gl.getAttribLocation(W.program, "uv")),
          2,
          5126 /* FLOAT */,
          false,
          0,
          0,
        );
        W.gl.enableVertexAttribArray(buffer);
      }

      if ((object.s || model.customNormals) && model.normalsBuffer) {
        W.gl.bindBuffer(34962 /* ARRAY_BUFFER */, model.normalsBuffer);
        W.gl.vertexAttribPointer(
          (buffer = W.gl.getAttribLocation(W.program, "normal")),
          3,
          5126 /* FLOAT */,
          false,
          0,
          0,
        );
        W.gl.enableVertexAttribArray(buffer);
      }

      W.gl.uniform4f(
        W.gl.getUniformLocation(W.program, "o"),
        object.s,
        (object.mode > 3 || W.gl[object.mode] > 3) &&
          !object.ns &&
          !object.unlit
          ? 1
          : 0,
        W.ambientLight || 0.2,
        object.mix,
      );

      W.gl.uniform1f(
        W.gl.getUniformLocation(W.program, "unlit"),
        object.unlit ? 1 : 0,
      );

      W.gl.uniform4f(
        W.gl.getUniformLocation(W.program, "bb"),
        object.w,
        object.h,
        W.plugin.builtinShapes ? object.type == "billboard" : 0,
        0,
      );

      W.gl.uniform4f(
        W.gl.getUniformLocation(W.program, "rep"),
        W.lerp(object.n, "w"),
        W.lerp(object.n, "h"),
        W.lerp(object.n, "d"),
        repeat,
      );
      W.gl.uniform1f(W.gl.getUniformLocation(W.program, "ts"), ts);

      if (model.indicesBuffer) {
        W.gl.bindBuffer(34963 /* ELEMENT_ARRAY_BUFFER */, model.indicesBuffer);
      }

      W.gl.vertexAttrib4fv(
        W.gl.getAttribLocation(W.program, "col"),
        W.col(object.b),
      );

      if (model.indicesBuffer) {
        W.gl.drawElements(
          +object.mode || W.gl[object.mode],
          model.indices.length,
          5123 /* UNSIGNED_SHORT */,
          0,
        );
      } else {
        W.gl.drawArrays(
          +object.mode || W.gl[object.mode],
          0,
          model.vertices.length / 3,
        );
      }
    }
  };

  // Desktop pointer-lock mouse look + center-screen pick / hit sphere
  // ------------------------------------------------------------------
  const DESKTOP_HIT_ID = "desktop_input_hit";

  const mouseControls = {
    enabled: false,
    canvas: null,
    sensitivity: 0.1,
    pitchMin: -89,
    pitchMax: 89,
    hitSphereSize: 0.03,
    hitSphereColor: "f00",
    hovered: null,
    selected: null,
    prevDraw: null,
    onClick: null,
    onMouseMove: null,
    onPointerDown: null,
    onPointerUp: null,
    onPointerLockChange: null,
  };

  const dispatchMouse = (method, name, object, hit, event) => {
    const fn = object?.[method];
    if (typeof fn === "function") {
      fn({ name, object, hit, event });
    }
  };

  const clearDesktopHitSphere = () => {
    delete W.next[DESKTOP_HIT_ID];
    delete W.current[DESKTOP_HIT_ID];
  };

  const updateDesktopHitSphere = (hit) => {
    if (hit?.point) {
      W.setState({
        n: DESKTOP_HIT_ID,
        type: "sphere",
        x: hit.point[0],
        y: hit.point[1],
        z: hit.point[2],
        size: mouseControls.hitSphereSize,
        s: 1,
        b: mouseControls.hitSphereColor,
        mix: 1,
        unlit: true,
        selectable: false,
      });
    } else {
      clearDesktopHitSphere();
    }
  };

  const pickCenter = () => {
    if (W.xrActive || typeof W.raycast !== "function" || !W.next.camera) {
      return null;
    }
    return W.raycast(W.animation("camera"));
  };

  const updateDesktopHover = (hit, event) => {
    const next = hit?.name ?? null;
    const prev = mouseControls.hovered;

    if (prev !== next) {
      if (prev && W.next[prev]) {
        dispatchMouse("onHoverEnd", prev, W.next[prev], null, event);
      }
      mouseControls.hovered = next;
    }

    if (next) {
      dispatchMouse("onHover", hit.name, hit.object, hit, event);
    }
  };

  const clearDesktopHover = (event) => {
    const prev = mouseControls.hovered;
    if (prev && W.next[prev]) {
      dispatchMouse("onHoverEnd", prev, W.next[prev], null, event);
    }
    mouseControls.hovered = null;
  };

  const updateDesktopPick = (event) => {
    if (!mouseControls.enabled || W.xrActive) return;
    if (document.pointerLockElement !== mouseControls.canvas) {
      clearDesktopHover(event);
      clearDesktopHitSphere();
      return;
    }

    const hit = pickCenter();
    updateDesktopHover(hit, event);
    updateDesktopHitSphere(hit);
  };

  const applyMouseLook = (event) => {
    if (
      !mouseControls.enabled ||
      W.xrActive ||
      document.pointerLockElement !== mouseControls.canvas
    ) {
      return;
    }

    const cam = W.next.camera;
    const cur = W.current.camera;
    if (!cam) return;

    const ry = (cam.ry || 0) - event.movementX * mouseControls.sensitivity;
    const rx = Math.max(
      mouseControls.pitchMin,
      Math.min(
        mouseControls.pitchMax,
        (cam.rx || 0) - event.movementY * mouseControls.sensitivity,
      ),
    );

    cam.rx = rx;
    cam.ry = ry;
    if (cur) {
      cur.rx = rx;
      cur.ry = ry;
    }
  };

  W.enableMouseControls = (options = {}) => {
    W.disableMouseControls();

    const canvas = options.canvas || W.canvas;
    if (!canvas) return;

    mouseControls.enabled = true;
    mouseControls.canvas = canvas;
    mouseControls.sensitivity = options.sensitivity ?? 0.1;
    mouseControls.pitchMin = options.pitchMin ?? -89;
    mouseControls.pitchMax = options.pitchMax ?? 89;
    mouseControls.hitSphereSize = options.hitSphereSize ?? 0.03;
    mouseControls.hitSphereColor = options.hitSphereColor ?? "F00";
    mouseControls.hovered = null;
    mouseControls.selected = null;

    mouseControls.onClick = () => {
      if (W.xrActive) return;
      if (document.pointerLockElement === canvas) return;
      canvas.requestPointerLock?.({ unadjustedMovement: true });
    };

    mouseControls.onMouseMove = (event) => {
      applyMouseLook(event);
      updateDesktopPick(event);
    };

    mouseControls.onPointerDown = (event) => {
      if (W.xrActive || event.button !== 0) return;
      if (document.pointerLockElement !== canvas) return;

      const hit = pickCenter();
      updateDesktopHover(hit, event);
      updateDesktopHitSphere(hit);
      if (!hit) {
        mouseControls.selected = null;
        return;
      }

      mouseControls.selected = hit.name;
      dispatchMouse("onSelectStart", hit.name, hit.object, hit, event);
      dispatchMouse("onSelect", hit.name, hit.object, hit, event);
    };

    mouseControls.onPointerUp = (event) => {
      if (W.xrActive || event.button !== 0) return;
      const name = mouseControls.selected;
      mouseControls.selected = null;
      if (!name || !W.next[name]) return;
      dispatchMouse("onSelectEnd", name, W.next[name], null, event);
    };

    mouseControls.onPointerLockChange = () => {
      if (document.pointerLockElement === canvas) return;
      clearDesktopHover();
      clearDesktopHitSphere();
      mouseControls.selected = null;
    };

    canvas.addEventListener("click", mouseControls.onClick);
    canvas.addEventListener("mousemove", mouseControls.onMouseMove);
    canvas.addEventListener("pointerdown", mouseControls.onPointerDown);
    canvas.addEventListener("pointerup", mouseControls.onPointerUp);
    document.addEventListener(
      "pointerlockchange",
      mouseControls.onPointerLockChange,
    );

    // Refresh hover + hit sphere each desktop frame (animated targets)
    mouseControls.prevDraw = W.draw;
    W.draw = (...args) => {
      if (mouseControls.enabled && !W.xrActive) {
        updateDesktopPick();
      } else if (mouseControls.enabled && W.xrActive) {
        clearDesktopHover();
        clearDesktopHitSphere();
      }
      return mouseControls.prevDraw(...args);
    };
  };

  W.disableMouseControls = () => {
    if (!mouseControls.enabled && !mouseControls.canvas) {
      if (mouseControls.prevDraw) {
        W.draw = mouseControls.prevDraw;
        mouseControls.prevDraw = null;
      }
      return;
    }

    const canvas = mouseControls.canvas;
    if (canvas && mouseControls.onClick) {
      canvas.removeEventListener("click", mouseControls.onClick);
      canvas.removeEventListener("mousemove", mouseControls.onMouseMove);
      canvas.removeEventListener("pointerdown", mouseControls.onPointerDown);
      canvas.removeEventListener("pointerup", mouseControls.onPointerUp);
    }
    if (mouseControls.onPointerLockChange) {
      document.removeEventListener(
        "pointerlockchange",
        mouseControls.onPointerLockChange,
      );
    }

    clearDesktopHover();
    clearDesktopHitSphere();

    if (mouseControls.prevDraw) {
      W.draw = mouseControls.prevDraw;
      mouseControls.prevDraw = null;
    }

    mouseControls.enabled = false;
    mouseControls.canvas = null;
    mouseControls.hovered = null;
    mouseControls.selected = null;
    mouseControls.onClick = null;
    mouseControls.onMouseMove = null;
    mouseControls.onPointerDown = null;
    mouseControls.onPointerUp = null;
    mouseControls.onPointerLockChange = null;
  };

  // Keep references available for debugging / composition
  W._extensions = {
    originalReset,
    originalSetState,
    originalRender,
  };
})();
