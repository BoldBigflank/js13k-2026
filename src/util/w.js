// WebGL framework
// ===============

W = {
  // List of 3D models that can be rendered by the framework
  // (See the end of the file for built-in models: plane, billboard, cube, pyramid...)
  models: {},

  // Pseudo-boolean, defined internally in Terser when building.
  // Is used further down to add all plugins, if the flag still isn't set.
  // Any usages of these properties will be removed in the minified versions thanks to Terser.
  // built: true,
  // plugin: {},

  // Reset the framework
  // param: a <canvas> element
  // options: { xrCompatible, context, autoDraw }
  reset: (canvas, options = {}) => {
    // Globals
    W.canvas = canvas; // canvas element
    W.objs = 0; // Object counter
    W.current = {}; // Objects current states
    W.next = {}; // Objects next states
    W.textures = {}; // Textures list
    W.xrActive = false; // XR active flag
    W._xrEye = null; // Per-eye pose during XR
    W._xrHead = null; // Head pose during XR (billboard look-at, transparent sort)

    // WebGL context
    const contextAttribs = { ...(options.context || {}) };
    if (options.xrCompatible) contextAttribs.xrCompatible = true;
    W.gl = canvas.getContext("webgl2", contextAttribs);

    // Default blending method for transparent objects
    W.gl.blendFunc(770 /* SRC_ALPHA */, 771 /* ONE_MINUS_SRC_ALPHA */);

    // Enable texture 0
    W.gl.activeTexture(33984 /* TEXTURE0 */);

    // Create a WebGL program
    W.program = W.gl.createProgram();

    // Hide polygons back-faces (optional)
    W.gl.enable(2884 /* CULL_FACE */);

    // Create a Vertex shader
    // (this GLSL program is called for every vertex of the scene)
    W.gl.shaderSource(
      (shader = W.gl.createShader(35633 /* VERTEX_SHADER */)),
      `#version 300 es
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
      }`,
    );

    // Compile the Vertex shader and attach it to the program
    W.gl.compileShader(shader);
    W.gl.attachShader(W.program, shader);
    if (W.plugin.debug)
      console.log("vertex shader:", W.gl.getShaderInfoLog(shader) || "OK");

    // Create a Fragment shader
    // (This GLSL program is called for every fragment (pixel) of the scene)
    W.gl.shaderSource(
      (shader = W.gl.createShader(35632 /* FRAGMENT_SHADER */)),
      `#version 300 es
      precision highp float;                  // Set default float precision
      in vec4 v_pos, v_col, v_uv, v_normal;   // Varyings received from the vertex shader: position, color, texture coordinates, normal (if any)
      uniform vec3 light;                     // Uniform: light direction, smooth normals enabled
      uniform vec4 o;                         // options [smooth, shading enabled, ambient, mix]
      uniform float unlit;                    // 1: skip lighting, render at full brightness
      uniform sampler2D sampler;              // Uniform: 2D texture
      out vec4 c;                             // Output: final fragment color

      // The code below displays colored / textured / shaded fragments
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
      }`,
    );

    // Compile the Fragment shader and attach it to the program
    W.gl.compileShader(shader);
    W.gl.attachShader(W.program, shader);
    if (W.plugin.debug)
      console.log("fragment shader:", W.gl.getShaderInfoLog(shader) || "OK");

    // Compile the program
    W.gl.linkProgram(W.program);
    W.gl.useProgram(W.program);
    if (W.plugin.debug)
      console.log("program:", W.gl.getProgramInfoLog(W.program) || "OK");

    // Set the scene's background color (RGBA)
    W.gl.clearColor(1, 1, 1, 1);

    // Shortcut to set the clear color
    W.clearColor = (c) => W.gl.clearColor(...W.col(c));

    // Enable fragments depth sorting
    // (the fragments of close objects will automatically overlap the fragments of further objects)
    W.gl.enable(2929 /* DEPTH_TEST */);

    // When everything is loaded: set default light / camera
    W.light({ y: -1 });
    W.camera({ fov: 30 });

    // Draw the scene. Ignore the first frame because the default camera will probably be overwritten by the program
    if (options.autoDraw !== false) setTimeout(W.draw, 16);
  },

  // Set a state to an object
  setState: (state, type, texture) => {
    // Custom name or default name ('o' + auto-increment)
    state.n ||= "o" + W.objs++;

    // Size sets w, h and d at once (optional)
    if (state.size) state.w = state.h = state.d = state.size;

    // If a new texture is provided, build it and save it in W.textures
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

    // Recompute the projection matrix if fov is set (near: 1, far: 1000, ratio: canvas ratio)
    if (state.fov) {
      W.projection = new DOMMatrix([
        1 /
          Math.tan((state.fov * Math.PI) / 180) /
          (W.canvas.width / W.canvas.height),
        0,
        0,
        0,
        0,
        1 / Math.tan((state.fov * Math.PI) / 180),
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
    }

    // Save object's type,
    // merge previous state (or default state) with the new state passed in parameter,
    // and reset f (the animation timer)
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

    // Set mix to 1 if no texture is set
    if (!state.t) {
      state.mix = 1;
    }

    // set mix to 0 by default if a texture is set
    else if (state.t && !state.mix) {
      state.mix = 0;
    }

    // Save new state
    W.next[state.n] = state;
  },

  // Draw the scene (desktop loop)
  draw: (now, dt, v = W.animation("camera")) => {
    dt = now - (W.lastFrame || now - 16);
    W.lastFrame = now;
    if (!W.xrActive) requestAnimationFrame(W.draw);

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
  },

  // Draw one XR eye using WebXR view matrices
  drawView: (projectionMatrix, viewTransform, headTransform, dt) => {
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
  },

  // Render all scene objects (shared by desktop draw and XR drawView)
  drawScene: (dt, clear = true) => {
    if (clear) {
      W.gl.clear(16640 /* W.gl.COLOR_BUFFER_BIT | W.gl.DEPTH_BUFFER_BIT */);
    }

    const transparent = [];
    for (const i in W.next) {
      W.next[i].m = W.animation(i);

      if (!W.next[i].t && W.col(W.next[i].b)[3] == 1) {
        W.render(W.next[i], dt);
      } else {
        transparent.push(W.next[i]);
      }
    }

    transparent.sort((a, b) => W.dist(b) - W.dist(a));

    W.gl.enable(3042 /* BLEND */);
    for (const i of transparent) {
      if (W.plugin.builtinShapes && ["plane", "billboard"].includes(i.type))
        W.gl.depthMask(0);
      W.render(i, dt);
      if (W.plugin.builtinShapes) W.gl.depthMask(1);
    }
    W.gl.disable(3042 /* BLEND */);

    W.gl.uniform3f(
      W.gl.getUniformLocation(W.program, "light"),
      W.lerp("light", "x"),
      W.lerp("light", "y"),
      W.lerp("light", "z"),
    );
  },

  startXR: () => {
    W.xrActive = true;
  },

  endXR: () => {
    W.xrActive = false;
    W._xrEye = null;
    W._xrHead = null;
    W.lastFrame = undefined;
    W.gl.bindFramebuffer(W.gl.FRAMEBUFFER, null);
    setTimeout(W.draw, 16);
  },

  // Render an object
  render: (object, dt, buffer, model = W.models[object.type]) => {
    const ts = W.lerp(object.n, "ts") ?? 1;
    const repeat =
      W.plugin.builtinShapes &&
      ["plane", "billboard", "cube"].includes(object.type)
        ? object.type === "cube"
          ? 2
          : 1
        : 0;
    const wrap = repeat || ts !== 1;

    // If the object has a texture
    if (object.t) {
      // Set the texture's target (2D or cubemap)
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

      // Pass texture 0 to the sampler
      W.gl.uniform1i(W.gl.getUniformLocation(W.program, "sampler"), 0);
    }

    // If the object has an animation, increment its timer...
    if (object.f < object.a) object.f += dt;

    // ...but don't let it go over the animation duration.
    if (object.f > object.a) object.f = object.a;

    // send the model matrix to the vertex shader
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "m"),
      false,
      object.m.toFloat32Array(),
    );

    // send the inverse of the model matrix to the vertex shader
    W.gl.uniformMatrix4fv(
      W.gl.getUniformLocation(W.program, "im"),
      false,
      object.m.inverse().toFloat32Array(),
    );

    // Show warning if model doesn't exist (debug only)
    if (
      W.plugin.debug &&
      !model &&
      !["camera", "light", "group"].includes(object.type)
    ) {
      console.warn(
        `tried to render model "${object.type}", which does not exist!`,
      );
    }

    // Don't render invisible items (camera, light, groups, camera's parent)
    if (model) {
      // Build the model's WebGL buffers if they don't exist yet
      if (model && !model.verticesBuffer) {
        model.customNormals = !!model.normals;

        // Build the model's vertices buffer
        W.gl.bindBuffer(
          34962 /* ARRAY_BUFFER */,
          (model.verticesBuffer = W.gl.createBuffer()),
        );
        W.gl.bufferData(
          34962 /* ARRAY_BUFFER */,
          new Float32Array(model.vertices),
          35044 /* STATIC_DRAW */,
        );

        // Compute smooth normals if they don't exist yet (optional)
        if (!model.normals && W.plugin.smooth) W.smooth(model);

        // Make a buffer from the smooth/custom normals (if any)
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

        // Build the model's uv buffer (if any) if it doesn't exist yet
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

        // Build the model's index buffer (if any) and smooth normals if they don't exist yet
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

      // Set up the position buffer
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

      // Set up the texture coordinatess buffer (if any)
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

      // Set the normals buffer
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

      // Other options: [smooth, shading enabled, ambient light, texture/color mix]
      W.gl.uniform4f(
        W.gl.getUniformLocation(W.program, "o"),

        // Enable smooth shading if "s" is true
        object.s,

        // Enable shading if in TRIANGLE* mode and object.ns/unlit disabled
        (object.mode > 3 || W.gl[object.mode] > 3) && !object.ns && !object.unlit
          ? 1
          : 0,

        // Ambient light
        W.ambientLight || 0.2,

        // Texture/color mix (if a texture is present. 0: fully textured, 1: fully colored)
        object.mix,
      );

      W.gl.uniform1f(
        W.gl.getUniformLocation(W.program, "unlit"),
        object.unlit ? 1 : 0,
      );

      // If the object is a billboard: send a specific uniform to the shaders:
      // [width, height, isBillboard = 1, 0]
      W.gl.uniform4f(
        W.gl.getUniformLocation(W.program, "bb"),

        // Size
        object.w,
        object.h,

        // is a billboard
        W.plugin.builtinShapes ? object.type == "billboard" : 0,

        // Reserved
        0,
      );

      // Texture repeat for built-in plane, billboard and cube (1 tile per unit)
      W.gl.uniform4f(
        W.gl.getUniformLocation(W.program, "rep"),
        object.w,
        object.h,
        object.d,
        repeat,
      );
      W.gl.uniform1f(W.gl.getUniformLocation(W.program, "ts"), ts);

      // Set up the indices (if any)
      if (model.indicesBuffer) {
        W.gl.bindBuffer(34963 /* ELEMENT_ARRAY_BUFFER */, model.indicesBuffer);
      }

      // Set the object's color
      W.gl.vertexAttrib4fv(
        W.gl.getAttribLocation(W.program, "col"),
        W.col(object.b),
      );

      // Draw
      // Both indexed and unindexed models are supported.
      // You can keep the "drawElements" only if all your models are indexed.
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
  },

  // Helpers
  // -------

  // Interpolate a property between two values
  lerp: (item, property) =>
    W.next[item]?.a
      ? W.current[item][property] +
        (W.next[item][property] - W.current[item][property]) *
          (W.next[item].f / W.next[item].a)
      : W.next[item][property],

  // Transition an item
  animation: (item, m = new DOMMatrix(W.next[item]?.M)) =>
    W.next[item]
      ? m
          .translateSelf(
            W.lerp(item, "x"),
            W.lerp(item, "y"),
            W.lerp(item, "z"),
          )
          .rotateSelf(
            W.lerp(item, "rx"),
            W.lerp(item, "ry"),
            W.lerp(item, "rz"),
          )
          .scaleSelf(W.lerp(item, "w"), W.lerp(item, "h"), W.lerp(item, "d"))
          .preMultiplySelf(W.animation(W.next[item].g))
      : m,

  // Compute the distance squared between two objects (useful for sorting transparent items)
  dist: (a, b = W._xrHead || W.next.camera?.m) =>
    b
      ? (b.m41 - a.m.m41) ** 2 + (b.m42 - a.m.m42) ** 2 + (b.m43 - a.m.m43) ** 2
      : 0,

  // Ray from a 4x4 pose matrix (origin + -Z direction)
  rayFromMatrix: (matrix) => {
    const m = new DOMMatrix(matrix);
    const tip = m.transformPoint(new DOMPoint(0, 0, -1, 0));
    const direction = [tip.x, tip.y, tip.z];
    const len = Math.hypot(...direction) || 1;
    return {
      origin: [m.m41, m.m42, m.m43],
      direction: direction.map((v) => v / len),
    };
  },

  // Ray vs axis-aligned bounding box; returns entry distance or null
  rayAabb: (origin, direction, min, max) => {
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
  },

  // Closest hit on selectable scene objects from a ray matrix; null if none
  raycast: (matrix) => {
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

      const meshT = rayMesh(localRay.origin, localRay.direction, W.models[object.type]);
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
  },

  // Set the ambient light level (0 to 1)
  ambient: (a) => (W.ambientLight = a),

  // Convert an rgb/rgba hex string into a vec4
  col: (c) => [
    ...c
      .replace("#", "")
      .match(c.length < 5 ? /./g : /../g)
      .map((a) => ("0x" + a) / (c.length < 5 ? 15 : 255)),
    1,
  ], // rgb / rgba / rrggbb / rrggbbaa

  // Add a new 3D model
  add: (name, model) => {
    W.models[name] = model;
    W[name] = (settings) => W.setState(settings, name);
  },

  // Built-in objects
  // ----------------

  group: (t) => W.setState(t, "group"),

  move: (t, delay) =>
    setTimeout(() => {
      W.setState(t);
    }, delay || 1),

  delete: (t, delay) =>
    setTimeout(() => {
      delete W.next[t];
    }, delay || 1),

  camera: (t, delay) =>
    setTimeout(() => {
      W.setState(t, (t.n = "camera"));
    }, delay || 1),

  light: (t, delay) =>
    delay
      ? setTimeout(() => {
          W.setState(t, (t.n = "light"));
        }, delay)
      : W.setState(t, (t.n = "light")),
};

// Define W plugins for w.js instance running from source
// ======================================================

// If the "W.built" flag is set at build time, this block won't be compiled in.
// If the flag is NOT set, that means this is a version running from the W source code.
// In that case, we should enable all plugins.
//
// If you need to test the absence of a plugin, flip the value to "false" here.
// See "build.js" for which plugins are enabled in which verions.
if (!W.built) {
  W.plugin = {
    debug: true,
    smooth: true,
    builtinShapes: true,
  };
}

// Smooth normals computation plug-in (optional)
// =============================================

if (W.plugin.smooth) {
  W.smooth = (
    model,
    dict = {},
    vertices = [],
    vertexCount,
    i = 0,
    j,
    A,
    B,
    C,
    Ai,
    Bi,
    Ci,
    AB,
    BC,
    normal,
  ) => {
    // Prepare smooth normals array
    model.normals = [];

    // Fill vertices array: [[x,y,z],[x,y,z]...]
    for (; i < model.vertices.length; i += 3) {
      vertices.push(model.vertices.slice(i, i + 3));
    }

    // Get number of times to iterate
    vertexCount = (model.indices || vertices).length;

    // Iterate twice on the vertices
    // - 1st pass: compute normals of each triangle and accumulate them for each vertex
    // - 2nd pass: save the final smooth normals values
    for (i = 0; i < vertexCount * 2; i += 3) {
      j = i % vertexCount;

      A = vertices[(Ai = model.indices?.[j] ?? j)];
      B = vertices[(Bi = model.indices?.[j + 1] ?? j + 1)];
      C = vertices[(Ci = model.indices?.[j + 2] ?? j + 2)];

      AB = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      BC = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
      normal =
        i > j
          ? [0, 0, 0]
          : [
              AB[1] * BC[2] - AB[2] * BC[1],
              AB[2] * BC[0] - AB[0] * BC[2],
              AB[0] * BC[1] - AB[1] * BC[0],
            ];

      dict[(j = A.join())] ??= [0, 0, 0];
      model.normals[Ai] = dict[j] = dict[j].map((a, i) => a + normal[i]);
      dict[(j = B.join())] ??= [0, 0, 0];
      model.normals[Bi] = dict[j] = dict[j].map((a, i) => a + normal[i]);
      dict[(j = C.join())] ??= [0, 0, 0];
      model.normals[Ci] = dict[j] = dict[j].map((a, i) => a + normal[i]);
    }
  };
}

// 3D models
// =========

// Each model has:
// - A vertices array [x, y, z, x, y, z...]
// - A uv array [u, v, u, v...] (optional. Allows texturing... if absent: RGBA coloring only)
// - An indices array (optional, enables drawElements rendering... if absent: drawArrays is ised)
// - A normals array [nx, ny, nz, nx, ny, nz...] (optional... if absent: hard/smooth normals are computed by the framework when they're needed)
// The buffers (vertices, uv, indices) are built automatically when they're needed
// All models are optional, you can remove the ones you don't need to save space
// Custom models can be added from the same model, an OBJ importer is available on https://xem.github.io/W/obj2js/

if (W.plugin.builtinShapes) {
  // Plane / billboard
  //
  //  v1------v0
  //  |       |
  //  |   x   |
  //  |       |
  //  v2------v3

  W.add("plane", {
    vertices: [
      0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5,
      -0.5, 0,
    ],

    uv: [1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  });
  W.add("billboard", W.models.plane);

  // Cube
  //
  //    v6----- v5
  //   /|      /|
  //  v1------v0|
  //  | |  x  | |
  //  | |v7---|-|v4
  //  |/      |/
  //  v2------v3

  W.add("cube", {
    vertices: [
      0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      0.5, // front
      0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      0.5,
      0.5,
      0.5,
      -0.5,
      0.5, // right
      0.5,
      0.5,
      -0.5,
      0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      0.5, // up
      0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      0.5,
      0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5, // left
      -0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5,
      0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5, // back
      -0.5,
      0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5, // down
      0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
    ],
    uv: [
      1,
      1,
      0,
      1,
      0,
      0, // front
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1,
      0,
      0, // right
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1,
      0,
      0, // up
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1,
      0,
      0, // left
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1,
      0,
      0, // back
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1,
      0,
      0, // down
      1,
      1,
      0,
      0,
      1,
      0,
    ],
    normals: [
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, // front
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, // right
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, // up
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, // left
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, // back
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, // down
    ],
  });
  W.cube = (settings) => W.setState(settings, "cube");

  // Pyramid
  //
  //      ^
  //     /\\
  //    // \ \
  //   /+-x-\-+
  //  //     \/
  //  +------+

  W.add("pyramid", {
    vertices: [
      -0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      0,
      0.5,
      0, // Front
      0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      0,
      0.5,
      0, // Right
      0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      0,
      0.5,
      0, // Back
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      -0.5,
      0.5,
      0,
      0.5,
      0, // Left
      0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5, // down
      0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5,
      -0.5,
    ],
    uv: [
      0,
      0,
      1,
      0,
      0.5,
      1, // Front
      0,
      0,
      1,
      0,
      0.5,
      1, // Right
      0,
      0,
      1,
      0,
      0.5,
      1, // Back
      0,
      0,
      1,
      0,
      0.5,
      1, // Left
      1,
      1,
      0,
      1,
      0,
      0, // down
      1,
      1,
      0,
      0,
      1,
      0,
    ],
  });

  // Sphere
  //
  //          =   =
  //       =         =
  //      =           =
  //     =      x      =
  //      =           =
  //       =         =
  //          =   =

  ((
    i,
    ai,
    j,
    aj,
    p1,
    p2,
    vertices = [],
    indices = [],
    uv = [],
    precision = 20,
  ) => {
    for (j = 0; j <= precision; j++) {
      aj = (j * Math.PI) / precision;
      for (i = 0; i <= precision; i++) {
        ai = (i * 2 * Math.PI) / precision;
        vertices.push(
          +((Math.sin(ai) * Math.sin(aj)) / 2).toFixed(6),
          +(Math.cos(aj) / 2).toFixed(6),
          +((Math.cos(ai) * Math.sin(aj)) / 2).toFixed(6),
        );
        uv.push(Math.sin(i / precision) * 3.5, -Math.sin(j / precision));
        if (i < precision && j < precision) {
          indices.push(
            (p1 = j * (precision + 1) + i),
            (p2 = p1 + (precision + 1)),
            p1 + 1,
            p1 + 1,
            p2,
            p2 + 1,
          );
        }
      }
    }
    W.add("sphere", { vertices, uv, indices });
  })();
}
