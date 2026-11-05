// Lab: the block renderer in 3D. Every block becomes a cube (its depth is its
// smaller side) whose front face sits where the 2D renderer draws the block.
// Same 24-float instances as today; the two spare floats (20-23's z, w) carry
// the cube's front-face z, from and to, so the GPU morphs depth too. The
// block's layer (16-19's z) keeps its whole part; its fraction is baked
// ambient occlusion.
//
// Two ways to draw a cube, picked with `mode`:
//   A  one quad over the cube's projected bounds; the fragment shader
//      ray-casts the box and writes gl_FragDepth.
//   B  the up-to-three faces that face the camera, as an 8-vertex fan
//      around the nearest corner; no gl_FragDepth, so early-z keeps working.
// Straight on with the flat camera both take the 2D renderer's own sums, so
// the page comes out pixel for pixel the same.

import { Renderer, VS_BLOCK, THEME_GLSL, STRIDE, program } from '../../engine/renderer.js';

const UNI = `
uniform mat4 u_vp, u_vp0, u_ivp, u_ivp0; // world -> clip: the camera, and flat (the nav); inverses
uniform vec3 u_eye, u_piv;               // toward the camera; what it turns about
uniform float u_s, u_k, u_flat;          // perspective (1 / distance); how tilted (0-1); straight on
out vec4 v_ra, v_rb;
out vec3 v_q;
flat out vec3 v_C, v_h;
flat out mat3 v_R;
flat out float v_ao, v_fix, v_fl, v_F, v_k;
vec4 proj(vec3 q, bool fl, mat4 VP, vec3 C, mat3 R, vec3 h, vec2 c, float cs, float sn, bool fx, bool snap, float F) {
  vec4 k = VP * vec4(C + R * (q * h), 1.0);
  if (!fl) return k;
  vec2 lp = q.xy * h.xy;
  vec2 pos = c + vec2(cs * lp.x - sn * lp.y, sn * lp.x + cs * lp.y);
  if (!fx) pos.y -= u_scroll;
  if (snap) pos = floor(pos * u_dpr + 0.5) / u_dpr;
  return vec4(pos.x / u_view.x * 2.0 - 1.0, 1.0 - pos.y / u_view.y * 2.0, (VP * vec4(0.0, 0.0, F, 1.0)).z, 1.0); // the front face's depth, exactly: ties break as in 2D
}
`;

const MID = `
  float zc = mix(a_csize.z, a_csize.w, ease(p));
  vec3 h = vec3(sz * 0.5, min(sz.x, sz.y) * 0.5);
  float F = zc + floor(a_meta.z) * 0.25 + (fixed_ ? 0.0 : lift * 0.9 * u_k); // tilted, a push lifts blocks off the page
  vec3 C = vec3(c.x, fixed_ ? c.y : c.y - u_scroll, F - h.z);
  bool fl = fixed_ || u_flat > 0.5;
  mat4 VP = fixed_ ? u_vp0 : u_vp;
  vec3 ax = normalize(vec3((fixed_ ? 0.0 : u_k) * (fract(a_to.xy * 0.0137 + a_to.yx * 0.071) - 0.5) * 2.0, 1.0));
  float cs = cos(ang), sn = sin(ang);
  mat3 R = mat3(cs) + (1.0 - cs) * outerProduct(ax, ax) + sn * mat3(0.0, ax.z, -ax.y, -ax.z, 0.0, ax.x, ax.y, -ax.x, 0.0);
  vec3 dl = (fixed_ ? vec3(0.0, 0.0, 1.0) : u_eye + u_s * (u_piv - C)) * R;
  v_C = C; v_h = h; v_R = R; v_ao = (flags & 4) != 0 ? 0.0 : a_cells.x; v_k = fixed_ ? 0.0 : u_k; v_fix = fixed_ ? 1.0 : 0.0; v_fl = fl ? 1.0 : 0.0; v_F = F;
  v_half = sz * 0.5 * u_dpr;
#ifdef RAY
  vec2 lo = vec2(1e9), hi = -lo;
  float wm = 1e9;
  for (int i = 0; i < (fl ? 0 : 8); i++) {
    vec4 k = proj(vec3(i & 1, (i >> 1) & 1, i >> 2) * 2.0 - 1.0, fl, VP, C, R, h, c, cs, sn, fixed_, rest, F);
    wm = min(wm, k.w); lo = min(lo, k.xy / k.w); hi = max(hi, k.xy / k.w);
  }
  // Straight on, the cube is its front face: draw exactly that quad, as 2D does.
  vec2 n = fl ? proj(vec3(a_corner * 2.0 - 1.0, 1.0), fl, VP, C, R, h, c, cs, sn, fixed_, rest, F).xy : mix(lo, hi, a_corner);
  gl_Position = !fl && wm < 0.05 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(n, 0.0, 1.0);
  mat4 I = fixed_ ? u_ivp0 : u_ivp;
  vec4 r0 = I * vec4(n, 0.0, 1.0), r1 = I * vec4(n, 1.0, 1.0); // the near plane can be behind the camera
  v_ra = vec4((r0.xyz - C * r0.w) * R / h, r0.w);
  v_rb = vec4((r1.xyz - C * r1.w) * R / h, r1.w);
#else
  vec3 s = vec3(greaterThanEqual(dl, vec3(0.0))) * 2.0 - 1.0;
  int j = gl_VertexID, k = (s.x * s.y * s.z > 0.0 ? j + 5 : 7 - j) % 6; // mirrored corners walk the rim the other way, so front faces wind alike
  vec3 q = j == 0 ? s : s * (k == 0 ? vec3(-1, 1, 1) : k == 1 ? vec3(-1, -1, 1) : k == 2 ? vec3(1, -1, 1) : k == 3 ? vec3(1, -1, -1) : k == 4 ? vec3(1, 1, -1) : vec3(-1, 1, -1));
  gl_Position = proj(q, fl, VP, C, R, h, c, cs, sn, fixed_, rest, F);
  v_q = q;
#endif
`;

const vs = (ray) => {
  const i = VS_BLOCK.indexOf('  vec2 lp ='), j = VS_BLOCK.indexOf('  v_cam =');
  return VS_BLOCK.slice(0, i).replace('es\n', `es\n${ray ? '#define RAY\n' : ''}`).replace('const float PI', `${UNI}const float PI`)
    .replace('  if (u_trailN > 0) {', '  float lift = 0.0;\n  if (u_trailN > 0) {').replace('      c += ps.xy;', '      c += ps.xy;\n      lift = pl;') + MID + VS_BLOCK.slice(j);
};

const fs = (ray) => `#version 300 es
${ray ? '#define RAY' : ''}
precision highp float;
in float v_round, v_tone, v_clip;
in vec2 v_half;
flat in vec4 v_light;
in vec4 v_ra, v_rb;
in vec3 v_q;
flat in vec3 v_C, v_h;
flat in mat3 v_R;
flat in float v_ao, v_fix, v_fl, v_F, v_k;
uniform mat4 u_vp, u_vp0;
out vec4 o;
${THEME_GLSL}
void main() {
  if ((u_viewDev.y - gl_FragCoord.y) / u_dpr < v_clip) discard;
#ifdef RAY
  vec3 ro = v_ra.xyz / v_ra.w, rd = v_rb.xyz / v_rb.w - ro;
  rd = mix(rd, vec3(1e-9), equal(rd, vec3(0.0)));
  vec3 iv = 1.0 / rd, ta = (-1.0 - ro) * iv, tb = (1.0 - ro) * iv, tn = min(ta, tb), tf = max(ta, tb);
  float t0 = max(max(tn.x, tn.y), tn.z), t1 = min(min(tf.x, tf.y), tf.z);
  bool fl = v_fl > 0.5;
  if (!fl && t0 > t1) discard;
  vec3 q = fl ? vec3(ro.xy, 1.0) : ro + rd * t0;
  vec3 nl = fl ? vec3(0, 0, 1) : step(tn.yzx, tn) * step(tn.zxy, tn) * -sign(rd);
  vec4 k = (v_fix > 0.5 ? u_vp0 : u_vp) * (fl ? vec4(0.0, 0.0, v_F, 1.0) : vec4(v_C + v_R * (q * v_h), 1.0));
  gl_FragDepth = k.z / k.w * 0.5 + 0.5;
#else
  // A face's own axis is exactly ±1 across it, even past its edge (where MSAA shades edge pixels).
  vec3 q = v_q, a = abs(abs(q) - 1.0);
  vec3 nl = a.z <= min(a.x, a.y) ? vec3(0, 0, sign(q.z)) : a.x <= a.y ? vec3(sign(q.x), 0, 0) : vec3(0, sign(q.y), 0);
#endif
  if (v_round > 0.001 && nl.z > 0.5) {
    vec2 Q = abs(q.xy) * v_half;
    float r = v_round * min(v_half.x, v_half.y);
    vec2 e = Q - v_half + r;
    if (length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r > 0.0) discard;
  }
  float t = themeK();
  vec3 bg = mix(u_bgA, u_bgB, t), fg = mix(u_fgA, u_fgB, t);
  vec3 col = mix(mix(bg, fg, v_tone), v_light.rgb, v_light.a);
  // Edge ambient occlusion: 4 bits a face, one per edge with a cube diagonally in front of it.
  int f = nl.x != 0.0 ? 0 : nl.y != 0.0 ? 1 : 2;
  int m = int(v_ao + 0.5) >> ((f * 2 + (nl.x + nl.y + nl.z < 0.0 ? 1 : 0)) * 4);
  vec2 uv = clamp((f == 0 ? q.yz : f == 1 ? q.zx : q.xy) * 0.5 + 0.5, 0.0, 1.0);
  vec4 e = vec4(uv, 1.0 - uv);
  e = e * e * e * vec4((m & 1) != 0, (m & 4) != 0, (m & 2) != 0, (m & 8) != 0);
  float ao = min(0.7, 0.5 * (e.x + e.y + e.z + e.w));
  // Faces by tone, so they read on paper and on ink alike: sides and the bottom
  // fade towards the paper, the top towards white; tilted, the front fades a little.
  vec3 wn = v_R * nl;
  col = mix(col, bg, 0.1 * v_k * max(wn.z, 0.0) + 0.28 * abs(wn.x) + 0.45 * max(wn.y, 0.0));
  o = vec4(mix(col, vec3(1.0), 0.4 * max(-wn.y, 0.0)) * (1.0 - ao), 1.0);
}`;

// 4×4s, row-major (uploaded transposed).
const mul = (A, B) => A.map((_, i) => { const r = i >> 2, c = i & 3; return A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + A[r * 4 + 3] * B[12 + c]; });
const ZS = 1 / 4000; // depth: ±4000 px about the pivot

/** Camera: world (CSS px, y down, z towards you) -> clip, and back. */
export function camera(w, h, tilt = 0, yaw = 0, s = 0) {
  const ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
  // Rotate about x (tilt), then y (yaw).
  const R = [cy, sy * st, sy * ct, 0, 0, ct, -st, 0, -sy, cy * st, cy * ct, 0, 0, 0, 0, 1];
  const px = w / 2, py = h / 2;
  const T = [1, 0, 0, -px, 0, 1, 0, -py, 0, 0, 1, 0, 0, 0, 0, 1];
  const Ti = [1, 0, 0, px, 0, 1, 0, py, 0, 0, 1, 0, 0, 0, 0, 1];
  const Rt = [R[0], R[4], R[8], 0, R[1], R[5], R[9], 0, R[2], R[6], R[10], 0, 0, 0, 0, 1];
  const ax = 2 / w, ay = -2 / h;
  const P = [ax, 0, 0, 0, 0, ay, 0, 0, 0, 0, -ZS, 0, 0, 0, -s, 1];
  const Pi = [1 / ax, 0, 0, 0, 0, 1 / ay, 0, 0, 0, 0, -1 / ZS, 0, 0, 0, -s / ZS, 1];
  return { vp: mul(P, mul(R, T)), ivp: mul(Ti, mul(Rt, Pi)), eye: [R[8], R[9], R[10]], piv: [px, py, 0], s };
}

export class Renderer3D extends Renderer {
  constructor(canvas) {
    super(canvas);
    const gl = this.gl;
    this.progs = { A: program(gl, vs(1), fs(1)), B: program(gl, vs(0), fs(0)) };
    this.flat = [this.blocks, this.vao];
    this.v3 = gl.createVertexArray();
    gl.bindVertexArray(this.v3);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf);
    for (let i = 0; i < STRIDE / 4; i++) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    gl.bindVertexArray(null);
    this.mode = 'B';
    this.view = { tilt: 0, yaw: 0, s: 0, k: 0 };
  }

  draw(f) {
    const gl = this.gl, m = this.mode;
    if (m === '2D') {
      [this.blocks, this.vao] = this.flat;
      this.verts = 4; this.prim = gl.TRIANGLE_STRIP;
    } else {
      const P = this.blocks = this.progs[m], u = P.u, V = this.view;
      this.vao = this.v3;
      this.verts = m === 'A' ? 4 : 8;
      this.prim = m === 'A' ? gl.TRIANGLE_STRIP : gl.TRIANGLE_FAN;
      const c = this.cam = camera(this.w, this.h, V.tilt, V.yaw, V.s), c0 = camera(this.w, this.h);
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(u.u_vp, true, c.vp);
      gl.uniformMatrix4fv(u.u_ivp, true, c.ivp);
      gl.uniformMatrix4fv(u.u_vp0, true, c0.vp);
      gl.uniformMatrix4fv(u.u_ivp0, true, c0.ivp);
      gl.uniform3fv(u.u_eye, c.eye);
      gl.uniform3fv(u.u_piv, c.piv);
      gl.uniform1f(u.u_s, c.s);
      gl.uniform1f(u.u_k, V.k);
      gl.uniform1f(u.u_flat, !V.tilt && !V.yaw && !V.s ? 1 : 0);
    }
    super.draw(f);
  }

  /** The ray through screen point (x, y): origin and direction in world space (flat: the nav's camera). */
  ray(x, y, flat) {
    const I = (flat || !this.cam ? camera(this.w, this.h) : this.cam).ivp;
    const nx = x / this.w * 2 - 1, ny = 1 - y / this.h * 2;
    const at = (z) => { const v = [0, 1, 2, 3].map((r) => I[r * 4] * nx + I[r * 4 + 1] * ny + I[r * 4 + 2] * z + I[r * 4 + 3]); return [v[0] / v[3], v[1] / v[3], v[2] / v[3]]; };
    const o = at(0), e = at(1); // z = -1 can be behind the camera
    return [o, [e[0] - o[0], e[1] - o[1], e[2] - o[2]].map((v) => v || 1e-9)];
  }

  /** Where screen point (x, y) lands on the page (z = 0), in screen px: hand it to the DOM mirror and clicks work tilted. */
  toPage(x, y) {
    const [o, d] = this.ray(x, y), t = -o[2] / d[2];
    return [o[0] + d[0] * t, o[1] + d[1] * t];
  }

  /**
   * Picking: the block under screen point (x, y), as its instance index, or
   * -1. A ray against every block's box where it is headed (at rest that's
   * where it is); the nav's blocks against the flat camera's ray.
   */
  pick(data, count, x, y, scroll) {
    const R = [this.ray(x, y), this.ray(x, y, true)];
    let best = Infinity, hit = -1;
    for (let i = 0; i < count; i++) {
      const b = i * STRIDE, w = data[b + 6], h = data[b + 7];
      if (!(w > 0)) continue;
      const zf = data[b + 23] + Math.floor(data[b + 18]) * 0.25, fx = (data[b + 19] & 1) !== 0, [o, d] = R[fx ? 1 : 0];
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
  }
}

/**
 * Ambient occlusion and hidden cubes, baked once from neighbours. cubes:
 * [x, y, z, ...] on a grid of `cell`. Per cube a 24-bit mask (4 bits a face,
 * +x -x +y -y +z -z; per face +u -u +v -v, u and v the next two axes) of the
 * edges with a cube diagonally in front of them, or -1 where all six faces
 * are covered (nothing of it can show). Goes in the instance's float 8.
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
