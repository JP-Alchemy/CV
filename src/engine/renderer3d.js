// The blocks in 3D: attach to a Renderer and every block becomes a cube whose
// front face is where the 2D renderer draws it (its depth is its smaller
// side). Same instances: floats 22-23 are the front face's z, from and to
// (engine.js: an element's `depth`), and the layer's fraction carries baked
// occlusion (an element's `ao`, from bake()).
//
// Each cube is drawn as the up-to-three faces that face the camera: an
// 8-vertex fan around its nearest corner, so there's no per-pixel ray test
// and early depth testing keeps working. Straight on (view all zeros) it
// takes the 2D renderer's own sums, so the page comes out pixel for pixel
// the same. Measured against a ray-cast quad in /lab/3d/ (commit 99628aa).

import { VS_BLOCK, THEME_GLSL, STRIDE, program } from './renderer.js';

const VS = (() => {
  const i = VS_BLOCK.indexOf('  vec2 lp ='), j = VS_BLOCK.indexOf('  v_cam =');
  const head = VS_BLOCK.slice(0, i)
    .replace('const float PI', `uniform mat4 u_vp, u_vp0;  // world (CSS px, y down, z towards you) -> clip: the camera, and flat (the nav)
uniform vec3 u_eye, u_piv; // towards the camera; what it turns about
uniform float u_s, u_k, u_flat; // perspective (1 / distance); how tilted (0-1); straight on
out vec3 v_q;
flat out mat3 v_R;
flat out float v_ao, v_k;
const float PI`)
    .replace('  if (u_trailN > 0) {', '  float lift = 0.0;\n  if (u_trailN > 0) {')
    .replace('      c += ps.xy;', '      c += ps.xy;\n      lift = pl;');
  return `${head}
  float zc = mix(a_csize.z, a_csize.w, ease(p));
  vec3 h = vec3(sz * 0.5, min(sz.x, sz.y) * 0.5);
  float F = zc + floor(a_meta.z) * 0.25 + (fixed_ ? 0.0 : lift * 0.9 * u_k); // tilted, a push lifts blocks off the page
  vec3 C = vec3(c.x, fixed_ ? c.y : c.y - u_scroll, F - h.z);
  bool fl = fixed_ || u_flat > 0.5;
  mat4 VP = fixed_ ? u_vp0 : u_vp;
  vec3 ax = normalize(vec3((fixed_ ? 0.0 : u_k) * (fract(a_to.xy * 0.0137 + a_to.yx * 0.071) - 0.5) * 2.0, 1.0)); // tilted, tumbles go 3D
  float cs = cos(ang), sn = sin(ang);
  mat3 R = mat3(cs) + (1.0 - cs) * outerProduct(ax, ax) + sn * mat3(0.0, ax.z, -ax.y, -ax.z, 0.0, ax.x, ax.y, -ax.x, 0.0);
  vec3 dl = (fixed_ ? vec3(0.0, 0.0, 1.0) : u_eye + u_s * (u_piv - C)) * R; // towards the camera, in the cube's frame
  // The nearest corner, then the six around it; mirrored corners walk the rim the other way, so front faces wind alike.
  vec3 s = vec3(greaterThanEqual(dl, vec3(0.0))) * 2.0 - 1.0;
  int j = gl_VertexID, k = (s.x * s.y * s.z > 0.0 ? j + 5 : 7 - j) % 6;
  vec3 q = j == 0 ? s : s * (k == 0 ? vec3(-1, 1, 1) : k == 1 ? vec3(-1, -1, 1) : k == 2 ? vec3(1, -1, 1) : k == 3 ? vec3(1, -1, -1) : k == 4 ? vec3(1, 1, -1) : vec3(-1, 1, -1));
  if (fl) { // straight on: the 2D renderer's own sums, and the front face's depth exactly, so ties break as in 2D
    vec2 lp = q.xy * h.xy;
    vec2 pos = c + vec2(cs * lp.x - sn * lp.y, sn * lp.x + cs * lp.y);
    if (!fixed_) pos.y -= u_scroll;
    if (rest) pos = floor(pos * u_dpr + 0.5) / u_dpr;
    gl_Position = vec4(pos.x / u_view.x * 2.0 - 1.0, 1.0 - pos.y / u_view.y * 2.0, (VP * vec4(0.0, 0.0, F, 1.0)).z, 1.0);
  } else gl_Position = VP * vec4(C + R * (q * h), 1.0);
  v_q = q; v_R = R; v_k = fixed_ ? 0.0 : u_k;
  v_ao = fract(a_meta.z);
  v_half = sz * 0.5 * u_dpr;
${VS_BLOCK.slice(j)}`;
})();

const FS = `#version 300 es
precision highp float;
in float v_round, v_tone, v_clip;
in vec2 v_half;
flat in vec4 v_light;
in vec3 v_q;
flat in mat3 v_R;
flat in float v_ao, v_k;
out vec4 o;
${THEME_GLSL}
void main() {
  if ((u_viewDev.y - gl_FragCoord.y) / u_dpr < v_clip) discard;
  // Which face: its own axis is exactly ±1 across it, even past its edge (where MSAA shades edge pixels).
  vec3 q = v_q, a = abs(abs(q) - 1.0);
  vec3 nl = a.z <= min(a.x, a.y) ? vec3(0, 0, sign(q.z)) : a.x <= a.y ? vec3(sign(q.x), 0, 0) : vec3(0, sign(q.y), 0);
  if (v_round > 0.001 && nl.z > 0.5) { // mid-tumble, rounded like the 2D renderer's
    vec2 Q = abs(q.xy) * v_half;
    float r = v_round * min(v_half.x, v_half.y);
    vec2 e = Q - v_half + r;
    if (length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r > 0.0) discard;
  }
  float t = themeK();
  vec3 bg = mix(u_bgA, u_bgB, t), fg = mix(u_fgA, u_fgB, t);
  vec3 col = mix(mix(bg, fg, v_tone), v_light.rgb, v_light.a);
  // Edge occlusion: 4 bits a face (+x -x +y -y +z), one per edge with a cube diagonally in front of it.
  int f = nl.x != 0.0 ? 0 : nl.y != 0.0 ? 1 : 2, fi = f * 2 + (nl.x + nl.y + nl.z < 0.0 ? 1 : 0);
  int m = fi > 4 ? 0 : int(v_ao * 1048576.0 + 0.5) >> (fi * 4);
  vec2 uv = clamp((f == 0 ? q.yz : f == 1 ? q.zx : q.xy) * 0.5 + 0.5, 0.0, 1.0);
  vec4 e = vec4(uv, 1.0 - uv);
  e = e * e * e * vec4((m & 1) != 0, (m & 4) != 0, (m & 2) != 0, (m & 8) != 0);
  float ao = min(0.7, 0.5 * (e.x + e.y + e.z + e.w));
  // Faces by tone, so they read on paper and on ink alike: sides and the bottom
  // fade towards the paper, the top towards white; tilted, the front a little.
  vec3 wn = v_R * nl;
  col = mix(col, bg, 0.1 * v_k * max(wn.z, 0.0) + 0.28 * abs(wn.x) + 0.45 * max(wn.y, 0.0));
  o = vec4(mix(col, vec3(1.0), 0.4 * max(-wn.y, 0.0)) * (1.0 - ao), 1.0);
}`;

// 4×4s, row-major (uploaded transposed).
const mul = (A, B) => A.map((_, i) => { const r = i >> 2, c = i & 3; return A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + A[r * 4 + 3] * B[12 + c]; });
const ZS = 1 / 4000; // depth: ±4000 px about the pivot

/** Camera: tilt (about x, then yaw about y) about the middle of a w × h view, s = 1 / distance (0: orthographic). */
export function camera(w, h, tilt = 0, yaw = 0, s = 0) {
  const ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const R = [cy, sy * st, sy * ct, 0, 0, ct, -st, 0, -sy, cy * st, cy * ct, 0, 0, 0, 0, 1];
  const Rt = [R[0], R[4], R[8], 0, R[1], R[5], R[9], 0, R[2], R[6], R[10], 0, 0, 0, 0, 1];
  const px = w / 2, py = h / 2, ax = 2 / w, ay = -2 / h;
  const T = [1, 0, 0, -px, 0, 1, 0, -py, 0, 0, 1, 0, 0, 0, 0, 1];
  const Ti = [1, 0, 0, px, 0, 1, 0, py, 0, 0, 1, 0, 0, 0, 0, 1];
  const P = [ax, 0, 0, 0, 0, ay, 0, 0, 0, 0, -ZS, 0, 0, 0, -s, 1];
  const Pi = [1 / ax, 0, 0, 0, 0, 1 / ay, 0, 0, 0, 0, -1 / ZS, 0, 0, 0, -s / ZS, 1];
  return { vp: mul(P, mul(R, T)), ivp: mul(Ti, mul(Rt, Pi)), eye: [R[8], R[9], R[10]], piv: [px, py, 0], s };
}

/**
 * Give a Renderer a 3D camera. Returns { view, on, ray, toPage, pick }: set
 * `view` ({ tilt, yaw, s, k }: radians, 1 / distance, how tilted 0-1) and
 * `on`; while off, or at all zeros, the renderer draws exactly as before.
 */
export function attach3D(r) {
  const gl = r.gl, P = program(gl, VS, FS), u = P.u;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(16), gl.STATIC_DRAW); // a_corner: unused, but 8 corners long
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.ibuf);
  for (let i = 0; i < STRIDE / 4; i++) {
    gl.enableVertexAttribArray(1 + i);
    gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
    gl.vertexAttribDivisor(1 + i, 1);
  }
  gl.bindVertexArray(null);
  const flat = [r.blocks, r.vao], draw = r.draw.bind(r);
  const cam = { view: { tilt: 0, yaw: 0, s: 0, k: 0 }, on: true, c: null };

  r.draw = (f) => {
    if (!cam.on) {
      [r.blocks, r.vao] = flat;
      r.verts = r.prim = undefined;
      cam.c = null;
      return draw(f);
    }
    const V = cam.view, c = cam.c = camera(r.w, r.h, V.tilt, V.yaw, V.s);
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.u_vp, true, c.vp);
    gl.uniformMatrix4fv(u.u_vp0, true, camera(r.w, r.h).vp);
    gl.uniform3fv(u.u_eye, c.eye);
    gl.uniform3fv(u.u_piv, c.piv);
    gl.uniform1f(u.u_s, c.s);
    gl.uniform1f(u.u_k, V.k);
    gl.uniform1f(u.u_flat, !V.tilt && !V.yaw && !V.s ? 1 : 0);
    r.blocks = P; r.vao = vao; r.verts = 8; r.prim = gl.TRIANGLE_FAN;
    return draw(f);
  };

  /** The ray through screen point (x, y): origin and direction in world space (flat: the nav's camera). */
  cam.ray = (x, y, flatCam) => {
    const I = (flatCam || !cam.c ? camera(r.w, r.h) : cam.c).ivp;
    const nx = x / r.w * 2 - 1, ny = 1 - y / r.h * 2;
    const at = (z) => { const v = [0, 1, 2, 3].map((k) => I[k * 4] * nx + I[k * 4 + 1] * ny + I[k * 4 + 2] * z + I[k * 4 + 3]); return [v[0] / v[3], v[1] / v[3], v[2] / v[3]]; };
    const o = at(0), e = at(1); // z = -1 can be behind the camera
    return [o, [e[0] - o[0], e[1] - o[1], e[2] - o[2]].map((v) => v || 1e-9)];
  };

  /** Where screen point (x, y) meets the page (z = 0), in screen px, or null if the page isn't there (behind the camera). */
  cam.toPage = (x, y) => {
    const [o, d] = cam.ray(x, y), t = -o[2] / d[2], p = [o[0] + d[0] * t, o[1] + d[1] * t];
    const c = cam.c;
    return !c || c.vp[12] * p[0] + c.vp[13] * p[1] + c.vp[15] > 0 ? p : null;
  };

  /** The block under screen point (x, y): its instance index, or -1 (a ray against each block's box where it is headed). */
  cam.pick = (data, count, x, y, scroll) => {
    const rays = [cam.ray(x, y), cam.ray(x, y, true)];
    let best = Infinity, hit = -1;
    for (let i = 0; i < count; i++) {
      const b = i * STRIDE, w = data[b + 6], h = data[b + 7];
      if (!(w > 0)) continue;
      const zf = data[b + 23] + Math.floor(data[b + 18]) * 0.25, fx = (data[b + 19] & 1) !== 0, [o, d] = rays[fx ? 1 : 0];
      const lo = [data[b + 4], data[b + 5] - (fx ? 0 : scroll), zf - Math.min(w, h)], hi = [lo[0] + w, lo[1] + h, zf];
      let t0 = -Infinity, t1 = Infinity;
      for (let k = 0; k < 3; k++) {
        const a = (lo[k] - o[k]) / d[k], z = (hi[k] - o[k]) / d[k];
        t0 = Math.max(t0, Math.min(a, z)); t1 = Math.min(t1, Math.max(a, z));
      }
      const tt = t0 - (fx ? 1e6 : 0); // the nav is always in front
      if (t0 <= t1 && tt < best) { best = tt; hit = i; }
    }
    return hit;
  };

  return cam;
}

/**
 * Occlusion and hidden cubes, baked once from neighbours. cubes: [x, y, z, ...]
 * on a grid of `cell` (z towards you). Returns per cube a 20-bit mask (4 bits
 * a face, +x -x +y -y +z; per face +u -u +v -v, u and v the next two axes) of
 * the edges with a cube diagonally in front, or -1 where all six faces are
 * covered and nothing of it can show. Give it to the engine as an element's `ao`.
 */
export function bake(cubes, cell) {
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
  const has = new Set();
  for (let i = 0; i < cubes.length; i += 3) has.add(key(cubes[i], cubes[i + 1], cubes[i + 2]));
  const out = new Float32Array(cubes.length / 3);
  for (let i = 0; i < cubes.length; i += 3) {
    const at = (d) => has.has(key(cubes[i] + d[0] * cell, cubes[i + 1] + d[1] * cell, cubes[i + 2] + d[2] * cell));
    let mask = 0, covered = 0;
    for (let f = 0; f < 6; f++) {
      const a = f >> 1, n = [0, 0, 0];
      n[a] = f & 1 ? -1 : 1;
      if (at(n)) { covered++; continue; }
      if (f === 5) continue; // the back face never shows
      [[(a + 1) % 3, 1], [(a + 1) % 3, -1], [(a + 2) % 3, 1], [(a + 2) % 3, -1]].forEach(([b, sg], e) => {
        const d = n.slice();
        d[b] = sg;
        if (at(d)) mask |= 1 << (f * 4 + e);
      });
    }
    out[i / 3] = covered === 6 ? -1 : mask;
  }
  return out;
}
