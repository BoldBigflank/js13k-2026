// WebXR augmentation for W
// ========================
// Loaded after w.js (and optionally w-extensions.js).
// Adds XR session lifecycle, stereo drawView, head-aware billboards,
// and raycast selection helpers onto the global W object.

(() => {
  const prevReset = W.reset;
  const prevDraw = W.draw;
  const prevDist = W.dist;

  const xrVertexShader = `#version 300 es
      precision highp float;                        // Set default float precision
      in vec4 pos, col, uv, normal;                 // Vertex attributes: position, color, texture coordinates, normal (if any)
      uniform mat4 pv, eye, head, m, im;           // Uniform transformation matrices: projection * view, eye, head (billboard look-at), model, inverse model
      uniform vec4 bb;                              // If the current shape is a billboard: bb = [w, h, 1.0, 0.0]
      uniform vec4 rep;                           // Texture repeat: [w, h, d, mode] (1: plane/billboard, 2: cube)
      uniform float ts;                           // Texture scale (tiles per unit at 1)
      out vec4 v_pos, v_col, v_uv, v_normal;        // Varyings sent to the fragment shader: position, color, texture coordinates, normal (if any)
      void main() {
        if (bb.z > 0.) {                            // Billboards look at the head position (world Y-up, same vertices per eye)
          vec3 center = m[3].xyz;
          vec3 toCamera = head[3].xyz - center;
          float dist = length(toCamera);
          vec3 forward = dist > 0. ? toCamera / dist : vec3(0., 0., 1.);
          vec3 upRef = abs(forward.y) > 0.999 ? head[1].xyz : vec3(0., 1., 0.);
          vec3 right = normalize(cross(upRef, forward));
          vec3 up = cross(forward, right);
          v_pos = vec4(center + right * pos.x * bb.x + up * pos.y * bb.y, 1.);
        } else {
          v_pos = m * pos;                          // Other objects rotate normally: p * v * m * position
        }
        gl_Position = pv * v_pos;
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

  const xrFragmentShader =
    W._extensionShaders?.fragment ||
    `#version 300 es
      precision highp float;
      in vec4 v_pos, v_col, v_uv, v_normal;
      uniform vec3 light;
      uniform vec4 o;
      uniform float unlit;
      uniform sampler2D sampler;
      out vec4 c;
      void main() {
        vec4 base = mix(texture(sampler, v_uv.xy), v_col, o[3]);
        if (unlit > 0.) {
          c = base;
        } else if(o[1] > 0.){
          c = vec4(
            base.rgb * (max(0., dot(light, -normalize(
              o[0] > 0.
              ? vec3(v_normal.xyz)
              : cross(dFdx(v_pos.xyz), dFdy(v_pos.xyz))
            )))
            + o[2]),
            base.a
          );
        } else {
          c = base;
        }
      }`;

  // options: { xrCompatible, context, autoDraw }
  W.reset = (canvas, options = {}) => {
    if (typeof options !== "object" || options === null) options = {};

    const contextAttribs = { ...(options.context || {}) };
    if (options.xrCompatible) contextAttribs.xrCompatible = true;

    prevReset(canvas, { ...options, context: contextAttribs, autoDraw: false });

    W.xrActive = false;
    W._xrEye = null;
    W._xrHead = null;

    // Recompile with head-aware billboard vertex shader (keeps extension fragment uniforms)
    if (typeof W._compileProgram === "function") {
      W._compileProgram(xrVertexShader, xrFragmentShader);
    } else {
      // Fallback if w-extensions.js was not loaded
      let shader;
      W.program = W.gl.createProgram();
      W.gl.shaderSource(
        (shader = W.gl.createShader(35633 /* VERTEX_SHADER */)),
        xrVertexShader,
      );
      W.gl.compileShader(shader);
      W.gl.attachShader(W.program, shader);
      W.gl.shaderSource(
        (shader = W.gl.createShader(35632 /* FRAGMENT_SHADER */)),
        xrFragmentShader,
      );
      W.gl.compileShader(shader);
      W.gl.attachShader(W.program, shader);
      W.gl.linkProgram(W.program);
      W.gl.useProgram(W.program);
    }

    if (options.autoDraw !== false) setTimeout(W.draw, 16);
  };

  // Draw the scene (desktop loop)
  W.draw = (now, dt, v = W.animation("camera")) => {
    dt = now - (W.lastFrame || now - 16);
    W.lastFrame = now;
    if (!W.xrActive) requestAnimationFrame(W.draw);
    if (typeof W.fitCanvas === "function") W.fitCanvas();

    // Build camera transformation matrix, and send it to the shaders as the Eye matrix
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "eye"),
      false,
      v.toFloat32Array(),
    );
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "head"),
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
      W.gl.getUniformLocation(W.program, "head"),
      false,
      head.toFloat32Array(),
    );
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "pv"),
      false,
      pv.toFloat32Array(),
    );

    W.drawScene(dt || 16, false);
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

  // Prefer XR head pose matrix while in XR; otherwise camera model matrix
  W.dist = (a, b = W._xrHead || W.next.camera?.m) => {
    if (!b) {
      // Fall back to upstream object-based distance when no matrix is available
      return prevDist(a);
    }
    // Matrix form (XR head or camera.m)
    if (typeof b.m41 === "number") {
      return (
        (b.m41 - a.m.m41) ** 2 + (b.m42 - a.m.m42) ** 2 + (b.m43 - a.m.m43) ** 2
      );
    }
    return prevDist(a, b);
  };

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

  // Closest hit on selectable scene objects from a ray matrix; null if none
  W.raycast = (matrix) => {
    const ray = W.rayFromMatrix(matrix);
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

  W._xr = { prevReset, prevDraw, prevDist };
})();
