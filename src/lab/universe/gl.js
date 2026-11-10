// The universe's cubes: the block renderer's 3D cube (engine/renderer3d.js),
// an 8-vertex fan round the corner nearest the eye with the face picked in
// the fragment shader, and its shading by tone, on paper or on ink, with the
// brand's spectrum for the occasional colour. What's new here is the camera:
// each batch of cubes lives in its own node's frame, and the CPU hands the
// GPU that frame already relative to the eye and divided by the camera
// distance, so float32 never sees a big number (see space.js). Depth is
// logarithmic, so 10^-6 to 10^10 camera distances share one depth buffer.
//
// An instance is 8 floats: x, y, z, size (the node's units), colour (0 ink,
// 1-7 the spectrum, 8 snow white), tone (0 paper .. 1 full), glow (0: shaded; 1 or more: lit from
// within, and above 1 it is 1 + when it was born, Gyr after the Big Bang), key (0-1: drawn while key < the batch's fade, so things dissolve
// in and out a cube at a time, as everywhere else on the site).

import { program } from '../../engine/renderer.js';
import { SPECTRUM, unit } from '../../brand.js';

export const FLOATS = 8;

const FAN = `
  vec3 s = vec3(greaterThanEqual(dl, vec3(0.0))) * 2.0 - 1.0;
  int j = gl_VertexID, k = (s.x * s.y * s.z > 0.0 ? j + 5 : 7 - j) % 6;
  vec3 q = j == 0 ? s : s * (k == 0 ? vec3(-1, 1, 1) : k == 1 ? vec3(-1, -1, 1) : k == 2 ? vec3(1, -1, 1) : k == 3 ? vec3(1, -1, -1) : k == 4 ? vec3(1, 1, -1) : vec3(-1, 1, -1));`;

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_p; // x, y, z, size (the node's units)
layout(location=1) in vec4 a_m; // colour, tone, glow, key
uniform mat3 u_R;     // the node's axes, in view space (x right, y up, z back)
uniform vec3 u_o;     // the node's origin, in view space, in camera distances
uniform float u_sc;   // the node's unit, in camera distances
uniform mat4 u_P;
uniform float u_px, u_minPx, u_maxPx; // a pixel at distance 1; the smallest a cube may get, and the largest (px; 0: no limit)
uniform float u_fade, u_near, u_logF, u_jit, u_time, u_sz, u_epoch; // u_epoch: Gyr after the Big Bang // u_sz: shrink the cubes (not their places)
uniform vec3 u_ctr, u_sun; // a round body's centre (view space): it's lit by where on the ball a cube is
uniform float u_body;
out vec3 v_q;
flat out vec4 v_m;
flat out float v_day;
void main() {
  if (a_m.w >= u_fade || (a_m.z > 1.0 && u_epoch < a_m.z - 1.0)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } // dissolving; or not born yet (glow channel: 1 + birth, Gyr)
  vec3 p = a_p.xyz;
  if (u_jit > 0.0) { float t = u_time, r = a_m.w * 97.0; p += u_jit * vec3(sin(t * 9.1 + r), sin(t * 7.3 + r * 1.7), sin(t * 8.2 + r * 2.9)); } // thermal: atoms never sit still
  vec3 C = u_o + u_R * (p * u_sc);
  float w = -C.z;
  if (w < u_near) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float h = a_p.w < 0.0 ? 0.5 * -a_p.w * u_px * w : max(a_p.w * 0.5 * u_sc * u_sz, 0.5 * u_minPx * u_px * w); // a negative size is in pixels (stars)
  if (u_maxPx > 0.0) h = min(h, 0.5 * u_maxPx * u_px * w); // a dot standing for far-off stars stays a dot, however close it comes
  vec3 dl = transpose(u_R) * (-C); // towards the eye, in the cube's frame
${FAN}
  vec3 V = C + u_R * (q * h);
  gl_Position = u_P * vec4(V, 1.0);
  gl_Position.z = (log2(max(-V.z, u_near) / u_near) * u_logF - 1.0) * gl_Position.w;
  v_q = q;
  v_m = a_m;
  v_day = u_body > 0.5 ? dot(normalize(C - u_ctr), u_sun) : 1.0;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 v_q;
flat in vec4 v_m;
flat in float v_day;
uniform mat3 u_R;
uniform vec3 u_bg, u_fg, u_sun; // u_sun: towards the light, view space (zero: unlit)
uniform float u_glow, u_body;
out vec4 o;
const vec3 SPECTRUM[7] = vec3[7](${SPECTRUM.map((h) => `vec3(${unit(h).map((c) => c.toFixed(3)).join(', ')})`).join(', ')});
vec3 face(vec3 q) {
  vec3 a = abs(abs(q) - 1.0);
  return a.z <= min(a.x, a.y) ? vec3(0, 0, sign(q.z)) : a.x <= a.y ? vec3(sign(q.x), 0, 0) : vec3(0, sign(q.y), 0);
}
void main() {
  int k = int(v_m.x + 0.5);
  vec3 col = k == 8 ? mix(u_bg, vec3(0.96, 0.97, 0.98), v_m.y) : k > 0 ? mix(u_bg, SPECTRUM[clamp(k - 1, 0, 6)], v_m.y) : mix(u_bg, u_fg, v_m.y); // 8: snow and ice, white on paper or ink
  vec3 wn = u_R * face(v_q);
  if (v_m.z > 0.5 || u_glow > 0.5) { // lit from within: a flat block of light, only the sides a little softer
    o = vec4(mix(col, u_bg, 0.18 * (1.0 - abs(wn.z))), 1.0);
    return;
  }
  float lit = 1.0;
  if (u_body > 0.5) { // day, dusk and night in three steps, like the blocks; by day, each face by which way it points, so slopes facing the sun are bright and the far sides dark
    float day = v_day > 0.2 ? 1.0 : v_day > -0.08 ? 0.66 : 0.3, d = dot(wn, u_sun);
    lit = day * mix(1.0, d > 0.35 ? 1.0 : d > 0.0 ? 0.78 : 0.55, smoothstep(-0.08, 0.15, v_day));
  }
  else if (dot(u_sun, u_sun) > 0.0) { float d = dot(wn, u_sun); lit = d > 0.3 ? 1.0 : d > -0.1 ? 0.68 : 0.34; }
  col = mix(u_bg, col, lit);
  // Faces by tone in the cube's own axes (z is up for the ground), so they read on paper and on ink alike.
  vec3 nl = face(v_q);
  col = mix(col, u_bg, 0.2 * abs(nl.x) + 0.32 * abs(nl.y) + 0.45 * max(-nl.z, 0.0));
  o = vec4(mix(col, vec3(1.0), 0.1 * max(nl.z, 0.0) * lit), 1.0);
}`;

export class Cubes {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl; this.canvas = canvas;
    this.P = program(gl, VS, FS);
    this.u = this.P.u;
    this.fov = 1.0; // vertical, radians
    this.near = 1e-6; this.far = 1e10;
    this.bytes = 0; this.meshes = 0;
    this.stats = { draws: 0, cubes: 0 };
  }

  /** Upload instances (FLOATS each). */
  mesh(data, n = data.length / FLOATS) {
    const gl = this.gl, vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * FLOATS), gl.STATIC_DRAW);
    for (const [loc, off] of [[0, 0], [1, 16]]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, FLOATS * 4, off);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    this.bytes += n * FLOATS * 4; this.meshes++;
    return { vao, buf, n, bytes: n * FLOATS * 4 };
  }

  free(m) {
    if (!m || !m.vao) return;
    this.gl.deleteVertexArray(m.vao); this.gl.deleteBuffer(m.buf);
    this.bytes -= m.bytes; this.meshes--;
    m.vao = null;
  }

  /** Start a frame: size, clear to `sky`. */
  begin(w, h, dpr, theme, sky = theme.bg, time = 0, epoch = 13.8) {
    const gl = this.gl, c = this.canvas;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    this.w = w; this.h = h;
    gl.viewport(0, 0, W, H);
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.useProgram(this.P.p);
    const f = 1 / Math.tan(this.fov / 2), a = w / h, u = this.u;
    gl.uniformMatrix4fv(u.u_P, false, [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, -1, -1, 0, 0, -2 * this.near, 0]);
    this.pxAng = (2 * Math.tan(this.fov / 2)) / h; // a CSS pixel at distance 1
    gl.uniform1f(u.u_px, this.pxAng);
    gl.uniform1f(u.u_near, this.near);
    gl.uniform1f(u.u_logF, 2 / Math.log2(this.far / this.near));
    gl.uniform1f(u.u_time, time);
    gl.uniform1f(u.u_epoch, epoch);
    gl.uniform3fv(u.u_bg, theme.bg); gl.uniform3fv(u.u_fg, theme.fg);
    this.stats = { draws: 0, cubes: 0 };
  }

  /** Draw the first n cubes of mesh m in frame B ({ R: view-space axes (row-major 9), o, sc }). */
  draw(m, n, B, o = {}) {
    if (!m?.vao || n <= 0) return;
    const gl = this.gl, u = this.u;
    gl.uniformMatrix3fv(u.u_R, true, B.R);
    gl.uniform3f(u.u_o, B.o[0], B.o[1], B.o[2]);
    gl.uniform1f(u.u_sc, B.sc);
    gl.uniform1f(u.u_minPx, o.minPx ?? 0);
    gl.uniform1f(u.u_maxPx, o.maxPx ?? 0);
    gl.uniform1f(u.u_fade, o.fade ?? 1);
    gl.uniform1f(u.u_sz, o.sz ?? 1);
    gl.uniform1f(u.u_jit, o.jit ?? 0);
    gl.uniform1f(u.u_glow, o.glow ? 1 : 0);
    gl.uniform3fv(u.u_sun, o.sun || [0, 0, 0]);
    gl.uniform1f(u.u_body, o.ctr && o.sun ? 1 : 0);
    gl.uniform3fv(u.u_ctr, o.ctr || [0, 0, 0]);
    gl.bindVertexArray(m.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 8, Math.min(n, m.n));
    this.stats.draws++; this.stats.cubes += Math.min(n, m.n);
  }

  end() { this.gl.bindVertexArray(null); }
}

/** Shuffle instances in place (Fisher-Yates), so drawing the first n of them is a fair, stable sample. */
export function shuffle(data, n, R) {
  const t = new Float32Array(FLOATS);
  for (let i = n - 1; i > 0; i--) {
    const j = (R() * (i + 1)) | 0;
    if (j === i) continue;
    t.set(data.subarray(i * FLOATS, i * FLOATS + FLOATS));
    data.copyWithin(i * FLOATS, j * FLOATS, j * FLOATS + FLOATS);
    data.set(t, j * FLOATS);
  }
  return data;
}

/** A growable instance list. */
export class Inst {
  constructor(cap = 1024) { this.a = new Float32Array(cap * FLOATS); this.n = 0; }
  push(x, y, z, s, c, t, g, k) {
    if ((this.n + 1) * FLOATS > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    const a = this.a, o = this.n++ * FLOATS;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = s; a[o + 4] = c; a[o + 5] = t; a[o + 6] = g; a[o + 7] = k;
  }
  done() { return this.a.subarray(0, this.n * FLOATS); }
}
