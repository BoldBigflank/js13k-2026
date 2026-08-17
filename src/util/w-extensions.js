// Non-XR local extensions for W
// ==============================
// Loaded after w.js. Adds texture tiling helpers (ts/rep wrap), tileCube,
// reset canvas sizing, NEAREST sampling, setState return values, group size,
// the desktop draw loop / scene pass (with background objects), raycast helpers,
// and mouse/touch picking along a ray cast from the camera through the cursor.

import './w.js';

(() => {
  const originalReset = W.reset;
  const originalSetState = W.setState;
  const originalRender = W.render;
  const originalGroup = W.group;
  const originalDist = W.dist;

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

    const displayW = canvas.clientWidth | 0;
    const displayH = canvas.clientHeight | 0;
    if (displayW && displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }

    originalReset(canvas, options);
  };

  // Draw the scene (desktop loop; XR replaces the loop, not the scene pass)
  W.draw = (now, dt, v = W.animation("camera")) => {
    dt = now - (W.lastFrame || now - 16);
    W.lastFrame = now;
    if (!W.xrActive) requestAnimationFrame(W.draw);
    W.fitCanvas();

    // Build camera transformation matrix, and send it to the shaders as the Eye matrix
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "eye"),
      false,
      v.toFloat32Array(),
    );

    // Invert it to obtain the View matrix
    v.invertSelf();

    // Premultiply it with the Perspective matrix to obtain a Projection-View matrix
    v.preMultiplySelf(W.projection);

    // send it to the shaders as the pv matrix
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "pv"),
      false,
      v.toFloat32Array(),
    );

    W.drawScene(dt, true);
  };

  // Render all scene objects (shared by desktop draw and XR drawView)
  W.drawScene = (dt, clear = true) => {
    if (clear) {
      W.gl.clear(16640 /* W.gl.COLOR_BUFFER_BIT | W.gl.DEPTH_BUFFER_BIT */);
    }

    const transparent = [];
    const background = [];
    for (const i in W.next) {
      W.next[i].m = W.animation(i);

      if (!W.next[i].t && W.col(W.next[i].b)[3] == 1) {
        W.render(W.next[i], dt);
      } else if (W.next[i].bg) {
        // Background objects (e.g. a skybox enclosing the camera) have an
        // origin close to the camera despite being visually far away, which
        // breaks distance-based sorting. Treat them as background instead:
        // always drawn first, without writing depth, so real geometry drawn
        // afterward can never be hidden behind them.
        background.push(W.next[i]);
      } else {
        transparent.push(W.next[i]);
      }
    }

    transparent.sort((a, b) => W.dist(b) - W.dist(a));

    W.gl.enable(3042 /* BLEND */);
    for (const i of background) {
      W.gl.depthMask(0);
      W.render(i, dt);
      W.gl.depthMask(1);
    }
    for (const i of transparent) {
      W.render(i, dt);
    }
    W.gl.disable(3042 /* BLEND */);

    W.gl.uniform3f(
      W.gl.getUniformLocation(W.program, "light"),
      W.lerp("light", "x"),
      W.lerp("light", "y"),
      W.lerp("light", "z"),
    );
  };

  // Distance from a pose matrix (camera model matrix, or an XR head pose)
  W.dist = (a, b = W.next.camera?.m) => {
    if (!b) {
      // Fall back to upstream object-based distance when no matrix is available
      return originalDist(a);
    }
    if (typeof b.m41 === "number") {
      return (
        (b.m41 - a.m.m41) ** 2 + (b.m42 - a.m.m42) ** 2 + (b.m43 - a.m.m43) ** 2
      );
    }
    return originalDist(a, b);
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

  // Raycast helpers (shared by desktop mouse pick and optional XR)
  // ------------------------------------------------------------------

  // Ray from a 4x4 pose matrix (origin + -Z direction)
  W.rayFromMatrix = (matrix) => {
    const m = new DOMMatrix(matrix);
    const tip = m.transformPoint(new DOMPoint(0, 0, -1, 0));
    const direction = [tip.x, tip.y, tip.z];
    const len = Math.hypot(...direction) || 1;
    return {
      origin: [m.m41, m.m42, m.m43],
      direction: direction.map((v) => v / len),
    };
  };

  // Ray vs axis-aligned bounding box; returns entry distance or null
  W.rayAabb = (origin, direction, min, max) => {
    let tmin = -Infinity;
    let tmax = Infinity;

    for (let i = 0; i < 3; i++) {
      if (Math.abs(direction[i]) < 1e-8) {
        if (origin[i] < min[i] || origin[i] > max[i]) return null;
        continue;
      }

      let t1 = (min[i] - origin[i]) / direction[i];
      let t2 = (max[i] - origin[i]) / direction[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    if (tmax < 0) return null;
    return tmin >= 0 ? tmin : 0;
  };

  // Closest hit on selectable scene objects from a { origin, direction } ray
  W.raycastRay = (ray) => {
    let closest = null;

    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];

    const rayTriangle = (origin, direction, v0, v1, v2) => {
      const e1 = sub(v1, v0);
      const e2 = sub(v2, v0);
      const p = cross(direction, e2);
      const det = dot(e1, p);
      if (Math.abs(det) < 1e-8) return null;

      const invDet = 1 / det;
      const tvec = sub(origin, v0);
      const u = dot(tvec, p) * invDet;
      if (u < 0 || u > 1) return null;

      const q = cross(tvec, e1);
      const v = dot(direction, q) * invDet;
      if (v < 0 || u + v > 1) return null;

      const t = dot(e2, q) * invDet;
      return t >= 0 ? t : null;
    };

    const rayMesh = (origin, direction, model) => {
      const verts = model.vertices;
      let meshT = null;

      const testTriangle = (i0, i1, i2) => {
        const t = rayTriangle(
          origin,
          direction,
          [verts[i0], verts[i0 + 1], verts[i0 + 2]],
          [verts[i1], verts[i1 + 1], verts[i1 + 2]],
          [verts[i2], verts[i2 + 1], verts[i2 + 2]],
        );
        if (t != null && (meshT == null || t < meshT)) meshT = t;
      };

      if (model.indices) {
        for (let i = 0; i < model.indices.length; i += 3) {
          testTriangle(
            model.indices[i] * 3,
            model.indices[i + 1] * 3,
            model.indices[i + 2] * 3,
          );
        }
      } else {
        for (let i = 0; i < verts.length; i += 9) {
          testTriangle(i, i + 3, i + 6);
        }
      }

      return meshT;
    };

    for (const name in W.next) {
      const object = W.next[name];
      if (!object?.selectable || !W.models[object.type]) continue;

      const world = W.animation(name);
      const inv = world.inverse();
      const localOrigin = inv.transformPoint(
        new DOMPoint(ray.origin[0], ray.origin[1], ray.origin[2], 1),
      );
      const localDir = inv.transformPoint(
        new DOMPoint(ray.direction[0], ray.direction[1], ray.direction[2], 0),
      );
      const dir = [localDir.x, localDir.y, localDir.z];
      const dirLen = Math.hypot(...dir) || 1;
      const localRay = {
        origin: [localOrigin.x, localOrigin.y, localOrigin.z],
        direction: dir.map((v) => v / dirLen),
      };

      if (
        W.rayAabb(
          localRay.origin,
          localRay.direction,
          [-0.5, -0.5, -0.5],
          [0.5, 0.5, 0.5],
        ) == null
      )
        continue;

      const meshT = rayMesh(
        localRay.origin,
        localRay.direction,
        W.models[object.type],
      );
      if (meshT == null) continue;

      const hitLocal = [
        localRay.origin[0] + localRay.direction[0] * meshT,
        localRay.origin[1] + localRay.direction[1] * meshT,
        localRay.origin[2] + localRay.direction[2] * meshT,
      ];
      const hitWorld = world.transformPoint(
        new DOMPoint(hitLocal[0], hitLocal[1], hitLocal[2], 1),
      );
      const point = [hitWorld.x, hitWorld.y, hitWorld.z];
      const distance =
        (point[0] - ray.origin[0]) * ray.direction[0] +
        (point[1] - ray.origin[1]) * ray.direction[1] +
        (point[2] - ray.origin[2]) * ray.direction[2];
      if (distance < 0) continue;

      if (!closest || distance < closest.distance) {
        closest = { name, object, distance, point };
      }
    }

    return closest;
  };

  // Closest hit from a pose matrix (origin + -Z direction); null if none
  W.raycast = (matrix) => W.raycastRay(W.rayFromMatrix(matrix));

  // Ray from the camera through a point on the canvas (client coordinates).
  // Unprojects through the current projection matrix, so it stays correct when
  // the fov or the canvas size changes.
  W.rayFromScreen = (clientX, clientY) => {
    const rect = W.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
    const near = W.projection
      .inverse()
      .transformPoint(new DOMPoint(ndcX, ndcY, -1, 1));
    const cam = W.animation("camera");
    const d = cam.transformPoint(
      new DOMPoint(near.x / near.w, near.y / near.w, near.z / near.w, 0),
    );
    const len = Math.hypot(d.x, d.y, d.z) || 1;
    return {
      origin: [cam.m41, cam.m42, cam.m43],
      direction: [d.x / len, d.y / len, d.z / len],
    };
  };

  // Mouse / touch pick from the cursor position + hit sphere
  // ------------------------------------------------------------------
  const DESKTOP_HIT_ID = "desktop_input_hit";

  const mouseControls = {
    enabled: false,
    canvas: null,
    hitSphereSize: 0.03,
    hitSphereColor: "f00",
    hovered: null,
    selected: null,
    pointer: null,
    prevDraw: null,
    onPointerMove: null,
    onPointerDown: null,
    onPointerUp: null,
    onPointerOut: null,
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

  const pickPointer = () => {
    if (W.xrActive || !mouseControls.pointer || !W.next.camera) {
      return null;
    }
    const { x, y } = mouseControls.pointer;
    return W.raycastRay(W.rayFromScreen(x, y));
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

  const setCursor = (hovering) => {
    const canvas = mouseControls.canvas;
    if (canvas) canvas.style.cursor = hovering ? "pointer" : "";
  };

  const updateDesktopPick = (event) => {
    if (!mouseControls.enabled || W.xrActive) return;

    const hit = pickPointer();
    updateDesktopHover(hit, event);
    updateDesktopHitSphere(hit);
    setCursor(!!hit);
    return hit;
  };

  const clearDesktopPick = (event) => {
    mouseControls.pointer = null;
    clearDesktopHover(event);
    clearDesktopHitSphere();
    setCursor(false);
  };

  const trackPointer = (event) => {
    mouseControls.pointer = { x: event.clientX, y: event.clientY };
  };

  W.enableMouseControls = (options = {}) => {
    W.disableMouseControls();

    const canvas = options.canvas || W.canvas;
    if (!canvas) return;

    mouseControls.enabled = true;
    mouseControls.canvas = canvas;
    mouseControls.hitSphereSize = options.hitSphereSize ?? 0.03;
    mouseControls.hitSphereColor = options.hitSphereColor ?? "F00";
    mouseControls.hovered = null;
    mouseControls.selected = null;
    mouseControls.pointer = null;

    mouseControls.onPointerMove = (event) => {
      if (W.xrActive || !event.isPrimary) return;
      trackPointer(event);
      updateDesktopPick(event);
    };

    mouseControls.onPointerDown = (event) => {
      if (W.xrActive || !event.isPrimary || event.button !== 0) return;

      trackPointer(event);
      const hit = updateDesktopPick(event);
      if (!hit) {
        mouseControls.selected = null;
        return;
      }

      mouseControls.selected = hit.name;
      dispatchMouse("onSelectStart", hit.name, hit.object, hit, event);
      dispatchMouse("onSelect", hit.name, hit.object, hit, event);
    };

    mouseControls.onPointerUp = (event) => {
      if (W.xrActive || !event.isPrimary || event.button !== 0) return;
      const name = mouseControls.selected;
      mouseControls.selected = null;
      if (name && W.next[name]) {
        dispatchMouse("onSelectEnd", name, W.next[name], null, event);
      }

      // A finger has no resting position, so it leaves no hover behind
      if (event.pointerType !== "mouse") clearDesktopPick(event);
    };

    mouseControls.onPointerOut = (event) => {
      mouseControls.selected = null;
      clearDesktopPick(event);
    };

    canvas.addEventListener("pointermove", mouseControls.onPointerMove);
    canvas.addEventListener("pointerdown", mouseControls.onPointerDown);
    canvas.addEventListener("pointerup", mouseControls.onPointerUp);
    canvas.addEventListener("pointerleave", mouseControls.onPointerOut);
    canvas.addEventListener("pointercancel", mouseControls.onPointerOut);

    // Refresh hover + hit sphere each desktop frame (animated targets)
    mouseControls.prevDraw = W.draw;
    W.draw = (...args) => {
      if (mouseControls.enabled && W.xrActive) {
        clearDesktopHover();
        clearDesktopHitSphere();
      } else if (mouseControls.enabled && mouseControls.pointer) {
        updateDesktopPick();
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
    if (canvas && mouseControls.onPointerMove) {
      canvas.removeEventListener("pointermove", mouseControls.onPointerMove);
      canvas.removeEventListener("pointerdown", mouseControls.onPointerDown);
      canvas.removeEventListener("pointerup", mouseControls.onPointerUp);
      canvas.removeEventListener("pointerleave", mouseControls.onPointerOut);
      canvas.removeEventListener("pointercancel", mouseControls.onPointerOut);
    }

    clearDesktopPick();

    if (mouseControls.prevDraw) {
      W.draw = mouseControls.prevDraw;
      mouseControls.prevDraw = null;
    }

    mouseControls.enabled = false;
    mouseControls.canvas = null;
    mouseControls.hovered = null;
    mouseControls.selected = null;
    mouseControls.pointer = null;
    mouseControls.onPointerMove = null;
    mouseControls.onPointerDown = null;
    mouseControls.onPointerUp = null;
    mouseControls.onPointerOut = null;
  };

  // Keep references available for debugging / composition
  W._extensions = {
    originalReset,
    originalSetState,
    originalRender,
  };
})();
