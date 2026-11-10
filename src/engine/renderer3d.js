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

import { VS_BLOCK, THEME_GLSL, LIGHT_GLSL, STRIDE, program } from './renderer.js';

const SHADE = `
// Which face of a cube: its own axis is exactly ±1 across it, even past its edge (where MSAA shades edge pixels).
vec3 face(vec3 q) {
  vec3 a = abs(abs(q) - 1.0);
  return a.z <= min(a.x, a.y) ? vec3(0, 0, sign(q.z)) : a.x <= a.y ? vec3(sign(q.x), 0, 0) : vec3(0, sign(q.y), 0);
}
// Faces by tone, so they read on paper and on ink alike: sides and the bottom
// fade towards the paper, the top towards white; tilted, the front a little.
vec3 shade(vec3 col, vec3 bg, vec3 wn, float k) {
  col = mix(col, bg, 0.1 * k * max(wn.z, 0.0) + 0.28 * abs(wn.x) + 0.45 * max(wn.y, 0.0));
  return mix(col, vec3(1.0), 0.4 * max(-wn.y, 0.0));
}`;

// Powers of Ten's scales (FS_ZOOM in renderer.js) as cubes: one instance per
// cell of its grid, the same size, colour and tone, standing on the page's
// plane. A depth for the cell (u_zDeep: front and back, cells towards you)
// stretches its cube from one to the other, so a desk side on runs back
// into the room and a house seen from above stands up off the ground; a
// second block in the cell (u_zDeep's zw, its tone and size in the grid's
// alpha) is a wall behind, the ground, or whatever else didn't fit. Without
// a depth a cell stands one cube deep. A map of the Earth's surface (Z.ball:
// its middle and radius, px) is a view straight down onto the globe, so each
// cell is lifted back onto the sphere it was seen on, and where the ground
// slopes away the cell grows deeper, so no gaps show.
const VS_ZOOM = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_zGrid, u_zDeep;
uniform vec4 u_zArea; // x, y, cols, rows
uniform float u_zB, u_scroll, u_time, u_s, u_k, u_face;
uniform float u_zDot, u_zRing; // how much of its cell a block fills; 1 for a far ring (smaller, flat, and only beyond the middle)
uniform vec4 u_zHole; // x0, y0, x1, y1: a finer grid is drawn here (the far ring leaves it out)
uniform vec4 u_ball; // x, y, radius (0: flat), how far the ball's middle is in front of a radius behind the page
uniform mat4 u_vp;
uniform vec3 u_eye, u_piv;
out vec3 v_q;
flat out vec4 v_light;
flat out vec2 v_kt; // colour (0 ink, 1-7 the spectrum), tone
${LIGHT_GLSL}
const vec4 GONE = vec4(2.0, 2.0, 2.0, 1.0);
void main() {
  int cols = int(u_zArea.z), n = cols * int(u_zArea.w), id = gl_InstanceID % n;
  bool second = gl_InstanceID >= n;
  ivec2 g = ivec2(id % cols, id / cols);
  vec4 t = texelFetch(u_zGrid, g, 0), D = texelFetch(u_zDeep, g, 0);
  int a = int(t.a * 255.0 + 0.5);
  float size = second ? float(a & 15) / 15.0 : t.r, tone = second ? float(a >> 4) / 15.0 : t.b;
  vec2 zr = second ? D.zw : D.xy;
  bool deep = zr.x != 0.0 || zr.y != 0.0;
  // Tilted, the painted area's edge shows: dissolve the outer eighth of it, a cell at a time.
  vec2 e = min(vec2(g) + 0.5, u_zArea.zw - vec2(g) - 0.5) / (u_zArea.zw * 0.12);
  float keep = clamp(min(e.x, e.y), 0.0, 1.0) * u_face; // and the whole flat layer as it turns away
  if (size <= 0.0 || hashL(vec2(g) + 3.7) >= keep) { gl_Position = GONE; return; }
  vec3 h = vec3(size * u_zB * 0.5 * u_zDot);
  if (u_zRing > 0.0 && !deep) h.z = min(h.z, u_zB * 0.06); // tiles on the ground, not blocks standing on it
  vec2 c = u_zArea.xy + (vec2(g) + 0.5) * u_zB;
  if (c.x > u_zHole.x && c.y > u_zHole.y && c.x < u_zHole.z && c.y < u_zHole.w) { gl_Position = GONE; return; }
  vec3 C = vec3(c, -h.z - 0.5); // a hair behind the page's blocks
  if (deep) { C.z = (zr.x + zr.y) * 0.5 * u_zB - 0.5; h.z = max((zr.x - zr.y) * 0.5 * u_zB, 0.25); }
  if (u_ball.z > 0.0) {
    vec2 d = c - u_ball.xy;
    float R = u_ball.z, r2 = dot(d, d), up = R * sqrt(max(1.0 - r2 / (R * R), 0.0));
    float dp = min(sqrt(r2) / max(up, 1e-3), 10.0) * u_zB * 0.5; // the slope, in cells
    C.z += -r2 / (R + up) + u_ball.w - dp; // how far the ground falls away (written so a town, on a ball millions of px across, stays exact)
    h.z += dp;
  }
  if (u_zRing > 0.0 && (u_vp * vec4(C, 1.0)).w < (u_vp * vec4(u_piv, 1.0)).w) { gl_Position = GONE; return; } // the near side of a ring would loom past the camera
  if (deep) { // what runs out towards the camera stops short of it, and nothing goes past the back of the depth buffer
    float zb = max(C.z - h.z, -3800.0), zf = C.z + h.z;
    if (u_s > 0.0) { // towards you, depth is eased in: the camera stays a fixed way off on screen, so close up a street in front would reach it
      float m = 0.4 / u_s;
      if (zf > 0.0) zf /= 1.0 + zf / m;
      if (zb > 0.0) zb /= 1.0 + zb / m;
    }
    float wb = (u_vp * vec4(c, zb, 1.0)).w, wf = (u_vp * vec4(c, zf, 1.0)).w;
    if (wb < 0.25) { gl_Position = GONE; return; }
    if (wf < 0.25) zf = zb + (zf - zb) * (wb - 0.25) / (wb - wf);
    if (zf <= zb) { gl_Position = GONE; return; }
    C.z = (zf + zb) * 0.5; h.z = (zf - zb) * 0.5;
  }
  vec3 dl = u_eye + u_s * (u_piv - C);
  vec3 s = vec3(greaterThanEqual(dl, vec3(0.0))) * 2.0 - 1.0;
  int j = gl_VertexID, k = (s.x * s.y * s.z > 0.0 ? j + 5 : 7 - j) % 6;
  vec3 q = j == 0 ? s : s * (k == 0 ? vec3(-1, 1, 1) : k == 1 ? vec3(-1, -1, 1) : k == 2 ? vec3(1, -1, 1) : k == 3 ? vec3(1, -1, -1) : k == 4 ? vec3(1, 1, -1) : vec3(-1, 1, -1));
  gl_Position = u_vp * vec4(C + q * h, 1.0);
  v_q = q;
  v_kt = second ? vec2(0.0, tone) : vec2(t.g * 255.0, tone);
  v_light = u_pulseN > 0 ? lightAt(c + vec2(0.0, u_scroll), vec2(g)) : vec4(0.0);
}`;

const FS_ZOOM = `#version 300 es
precision highp float;
precision highp int;
in vec3 v_q;
flat in vec4 v_light;
flat in vec2 v_kt;
uniform float u_k, u_time;
out vec4 o;
${THEME_GLSL}
${LIGHT_GLSL}
${SHADE}
void main() {
  float t = themeK();
  vec3 bg = mix(u_bgA, u_bgB, t), fg = mix(u_fgA, u_fgB, t);
  int k = int(v_kt.x + 0.5);
  vec3 col = k > 0 ? SPECTRUM[clamp(k - 1, 0, 6)] : mix(bg, fg, v_kt.y);
  col = mix(col, v_light.rgb, v_light.a);
  o = vec4(shade(col, bg, face(v_q), u_k), 1.0);
}`;

const FAN = `
  vec3 s = vec3(greaterThanEqual(dl, vec3(0.0))) * 2.0 - 1.0;
  int j = gl_VertexID, k = (s.x * s.y * s.z > 0.0 ? j + 5 : 7 - j) % 6;
  vec3 q = j == 0 ? s : s * (k == 0 ? vec3(-1, 1, 1) : k == 1 ? vec3(-1, -1, 1) : k == 2 ? vec3(1, -1, 1) : k == 3 ? vec3(1, -1, -1) : k == 4 ? vec3(1, 1, -1) : vec3(-1, 1, -1));`;

const VS_POINTS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 a_p; // x, y, z (px from the centre), size (px)
layout(location=1) in vec4 a_m; // colour, tone, fade, -
uniform vec3 u_centre, u_eye, u_piv;
uniform float u_s;
uniform mat4 u_vp;
out vec3 v_q;
flat out vec2 v_ct;
float hashS(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
void main() {
  if (hashS(floor(a_p.xyz) * 0.37 + 1.3) >= a_m.z) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 C = u_centre + a_p.xyz, h = vec3(a_p.w * 0.5);
  if ((u_vp * vec4(C, 1.0)).w < 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } // at or behind the camera
  vec3 dl = u_eye + u_s * (u_piv - C);
${FAN}
  gl_Position = u_vp * vec4(C + q * h, 1.0);
  v_q = q;
  v_ct = a_m.xy;
}`;

const FS_POINTS = `#version 300 es
precision highp float;
precision highp int;
in vec3 v_q;
flat in vec2 v_ct;
uniform float u_k, u_time;
out vec4 o;
${THEME_GLSL}
${LIGHT_GLSL}
${SHADE}
void main() {
  float t = themeK();
  vec3 bg = mix(u_bgA, u_bgB, t), fg = mix(u_fgA, u_fgB, t);
  int k = int(v_ct.x + 0.5);
  vec3 col = k > 0 ? SPECTRUM[clamp(k - 1, 0, 6)] : mix(bg, fg, v_ct.y);
  o = vec4(shade(col, bg, face(v_q), u_k), 1.0);
}`;

const VS_SOLID = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 a_cube; // x, y, z (grid steps), tone
uniform vec3 u_centre, u_sun, u_eye, u_piv;
uniform float u_size, u_s, u_fade, u_tone, u_lit;
uniform vec4 u_hole; // x0, y0, x1, y1: where a finer map of the near side is drawn, just sea
uniform mat4 u_vp;
out vec3 v_q;
flat out float v_tone;
float hashS(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
void main() {
  if (hashS(a_cube.xyz + 5.1) >= u_fade) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } // dissolving in or out
  vec3 C = u_centre + a_cube.xyz * u_size, h = vec3(u_size * 0.5);
  bool under = a_cube.z > 0.0 && C.x > u_hole.x && C.y > u_hole.y && C.x < u_hole.z && C.y < u_hole.w; // under the finer map: a plain floor, so what's behind doesn't show through it
  if ((u_vp * vec4(C, 1.0)).w < 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } // at or behind the camera
  vec3 dl = u_eye + u_s * (u_piv - C);
${FAN}
  gl_Position = u_vp * vec4(C + q * h, 1.0);
  v_q = q;
  float day = dot(normalize(a_cube.xyz), u_sun);
  v_tone = (under ? 0.16 : a_cube.w) * u_tone * (u_lit > 0.5 ? mix(0.55, 1.0, smoothstep(-0.08, 0.08, day)) : 1.0);
}`;

const FS_SOLID = `#version 300 es
precision highp float;
in vec3 v_q;
flat in float v_tone;
uniform float u_k, u_time;
uniform int u_colour;
out vec4 o;
${THEME_GLSL}
${LIGHT_GLSL}
${SHADE}
void main() {
  float t = themeK();
  vec3 bg = mix(u_bgA, u_bgB, t), fg = mix(u_fgA, u_fgB, t);
  vec3 col = u_colour > 0 ? mix(bg, SPECTRUM[clamp(u_colour - 1, 0, 6)], v_tone) : mix(bg, fg, v_tone);
  o = vec4(shade(col, bg, face(v_q), u_k), 1.0);
}`;

const VS = (() => {
  const i = VS_BLOCK.indexOf('  vec2 lp ='), j = VS_BLOCK.indexOf('  v_cam =');
  const head = VS_BLOCK.slice(0, i)
    .replace('const float PI', `uniform mat4 u_vp, u_vp0;  // world (CSS px, y down, z towards you) -> clip: the camera, and flat (the nav)
uniform vec3 u_eye, u_piv; // towards the camera; what it turns about
uniform float u_s, u_k, u_flat; // perspective (1 / distance); how tilted (0-1); straight on
out vec3 v_q;
flat out mat3 v_R;
flat out float v_ao, v_k;
uniform vec4 u_camClip;
const float PI`)
    .replace('  if (u_trailN > 0) {', '  float lift = 0.0;\n  if (u_trailN > 0) {')
    .replace('      c += ps.xy;', '      c += ps.xy;\n      lift = pl;');
  return `${head}
  float zc = mix(a_csize.z, a_csize.w, ease(p));
  float camS = fixed_ ? 1.0 : u_camS; // Powers of Ten: the page scales about u_cam.xy, which lands at u_cam.zw
  vec3 h = vec3(sz * 0.5, min(sz.x, sz.y) * 0.5) * camS;
  float F = (zc + floor(a_meta.z) * 0.25 + (fixed_ ? 0.0 : lift * 0.9 * u_k)) * camS; // tilted, a push lifts blocks off the page
  vec3 C = vec3(c.x, fixed_ ? c.y : c.y - u_scroll, F - h.z);
  if (camS != 1.0) C.xy = u_cam.zw + (C.xy - u_cam.xy) * camS;
  bool gone = camS != 1.0 && (C.x < u_camClip.x || C.y < u_camClip.y || C.x >= u_camClip.z || C.y >= u_camClip.w); // outside the screen on the desk
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
  } else gl_Position = gone ? vec4(2.0, 2.0, 2.0, 1.0) : VP * vec4(C + R * (q * h), 1.0);
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
flat in float v_cam;
uniform float u_camFade;
out vec4 o;
${THEME_GLSL}
${SHADE}
void main() {
  if ((u_viewDev.y - gl_FragCoord.y) / u_dpr < v_clip) discard;
  if (v_cam > 0.5 && u_camFade < 1.0 && hash12(floor(gl_FragCoord.xy / u_dpr / 6.0) + 11.0) >= u_camFade) discard; // the zoomed page dissolves
  vec3 q = v_q, nl = face(q);
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
  o = vec4(shade(col, bg, v_R * nl, v_k) * (1.0 - ao), 1.0);
}`;

// 4×4s, row-major (uploaded transposed).
const mul = (A, B) => A.map((_, i) => { const r = i >> 2, c = i & 3; return A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + A[r * 4 + 3] * B[12 + c]; });
const ZS = 1 / 4000; // depth: ±4000 px about the pivot

/** Camera: tilt (about x, then yaw about y) about `piv` (screen px; the middle of the w × h view by default), s = 1 / distance (0: orthographic). */
export function camera(w, h, tilt = 0, yaw = 0, s = 0, piv = null) {
  const ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const R = [cy, sy * st, sy * ct, 0, 0, ct, -st, 0, -sy, cy * st, cy * ct, 0, 0, 0, 0, 1];
  const Rt = [R[0], R[4], R[8], 0, R[1], R[5], R[9], 0, R[2], R[6], R[10], 0, 0, 0, 0, 1];
  const px = piv ? piv[0] : w / 2, py = piv ? piv[1] : h / 2, ax = 2 / w, ay = -2 / h;
  // Turn about (px, py), and put it back where it was on screen: the view's middle moves with it only if the pivot is the middle.
  const qx = w / 2 - px, qy = h / 2 - py;
  const T = [1, 0, 0, -px, 0, 1, 0, -py, 0, 0, 1, 0, 0, 0, 0, 1];
  const Ti = [1, 0, 0, px, 0, 1, 0, py, 0, 0, 1, 0, 0, 0, 0, 1];
  const Q = [1, 0, 0, -qx, 0, 1, 0, -qy, 0, 0, 1, 0, 0, 0, 0, 1], Qi = [1, 0, 0, qx, 0, 1, 0, qy, 0, 0, 1, 0, 0, 0, 0, 1];
  const P = [ax, 0, 0, 0, 0, ay, 0, 0, 0, 0, -ZS, 0, 0, 0, -s, 1];
  const Pi = [1 / ax, 0, 0, 0, 0, 1 / ay, 0, 0, 0, 0, -1 / ZS, 0, 0, 0, -s / ZS, 1];
  // Towards the camera, as the shader wants it (s × the way from the pivot to the eye, which sits over the screen's middle).
  const eye = [0, 1, 2].map((k) => R[8 + k] + s * (qx * R[k] + qy * R[4 + k]));
  return { vp: mul(P, mul(Q, mul(R, T))), ivp: mul(Ti, mul(Rt, mul(Qi, Pi))), eye, piv: [px, py, 0], s };
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
  const cam = { view: { tilt: 0, yaw: 0, s: 0, k: 0, piv: null }, on: true, c: null, solid: null };
  r.cam3d = cam; // for scenes with solid things (Powers of Ten's globe)

  r.draw = (f) => {
    if (!cam.on) {
      [r.blocks, r.vao] = flat;
      r.verts = r.prim = undefined;
      cam.c = null;
      return draw(f);
    }
    const V = cam.view, c = cam.c = camera(r.w, r.h, V.tilt, V.yaw, V.s, V.piv);
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.u_vp, true, c.vp);
    gl.uniformMatrix4fv(u.u_vp0, true, camera(r.w, r.h).vp);
    gl.uniform3fv(u.u_eye, c.eye);
    gl.uniform3fv(u.u_piv, c.piv);
    gl.uniform1f(u.u_s, c.s);
    gl.uniform1f(u.u_k, V.k);
    gl.uniform1f(u.u_flat, !V.tilt && !V.yaw && !V.s ? 1 : 0);
    r.blocks = P; r.vao = vao; r.verts = 8; r.prim = gl.TRIANGLE_FAN;
    // Screen-space layers don't tilt: the zoom's scales become cubes after the
    // blocks (same depth buffer); the slime mould's map waits until flat again.
    const Z = r.zoom, M = r.slime;
    r.zoom = r.slime = null;
    try { draw(f); } finally { r.zoom = Z; r.slime = M; }
    if (Z) zoomCubes(f, Z, c, r.ztex, r.zdeep);
    if (Z) (cam.far || []).forEach((F, i) => { // the ground further out, coarser, in rings round the zoom's grid
      let T = ftex[i];
      if (!T) T = ftex[i] = { tex: gl.createTexture(), deep: gl.createTexture(), v: -1 };
      if (F.version !== T.v) {
        gridTex(T.tex, F.cols, F.rows, F.buf);
        deepTex(T.deep, F.cols, F.rows, F.deep);
        T.v = F.version;
      }
      zoomCubes(f, F, c, T.tex, T.deep);
    });
    for (const S of [].concat(cam.solid || [])) if (S?.n) solidCubes(f, S, c);
    if (cam.points?.n) pointCubes(f, cam.points, c);
  };

  let ZP = null, SP = null;
  const zvao = gl.createVertexArray();
  function common(z, f, c) {
    gl.uniform3fv(z.u_bgA, f.themeA.bg); gl.uniform3fv(z.u_fgA, f.themeA.fg);
    gl.uniform3fv(z.u_bgB, f.themeB.bg); gl.uniform3fv(z.u_fgB, f.themeB.fg);
    gl.uniform1f(z.u_themeT, f.themeT);
    gl.uniform2f(z.u_themeOrigin, f.themeOrigin[0], f.themeOrigin[1]);
    gl.uniform2f(z.u_viewDev, r.canvas.width, r.canvas.height);
    gl.uniform1f(z.u_dpr, r.dpr);
    gl.uniformMatrix4fv(z.u_vp, true, c.vp);
    gl.uniform3fv(z.u_eye, c.eye);
    gl.uniform3fv(z.u_piv, c.piv);
    gl.uniform1f(z.u_s, c.s);
    gl.uniform1f(z.u_k, cam.view.k);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  // Solid things (cam.solid: one or a list of { buf, n, centre: [x, y], size,
  // sun: [x, y, z], fade, tone, colour, lit }): cubes on a grid, `size` px
  // apart, about `centre` (screen px, at z = 0). buf holds x, y, z (grid
  // steps; y down, z towards you) and a tone a cube, times `tone`; `colour`
  // 1-7 is the spectrum instead of ink; with `lit` (the default) the side
  // away from the Sun is night, a little darker. Each buf is uploaded once.
  const bufs = new WeakMap();
  function solidCubes(f, S, c) {
    SP ||= program(gl, VS_SOLID, FS_SOLID);
    const z = SP.u;
    gl.useProgram(SP.p);
    common(z, f, c);
    let B = bufs.get(S.buf);
    if (!B) {
      B = { vao: gl.createVertexArray(), buf: gl.createBuffer() };
      gl.bindVertexArray(B.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, B.buf);
      gl.bufferData(gl.ARRAY_BUFFER, S.buf, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
      gl.vertexAttribDivisor(0, 1);
      bufs.set(S.buf, B);
    }
    gl.bindVertexArray(B.vao);
    gl.uniform3f(z.u_centre, S.centre[0], S.centre[1], S.centre[2] || 0);
    gl.uniform1f(z.u_size, S.size);
    gl.uniform3fv(z.u_sun, S.sun || [0, 0, 1]);
    gl.uniform1f(z.u_fade, S.fade ?? 1);
    gl.uniform1f(z.u_tone, S.tone ?? 1);
    gl.uniform1f(z.u_lit, S.lit === false ? 0 : 1);
    gl.uniform4fv(z.u_hole, S.hole || [0, 0, 0, 0]);
    gl.uniform1i(z.u_colour, S.colour || 0);
    gl.uniform1f(z.u_time, f.time);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 8, S.n);
    gl.bindVertexArray(null);
  }

  // Points in space (cam.points: { buf, n, centre: [x, y], version }): buf
  // holds 8 floats a point: x, y, z (px from centre; y down, z towards you),
  // size (px), colour (0 ink, 1-7 the spectrum), tone, fade, -. Uploaded
  // when `version` changes.
  let PP = null;
  const pvao = gl.createVertexArray(), pbuf = gl.createBuffer();
  let pVersion = -1;
  function pointCubes(f, Pt, c) {
    PP ||= program(gl, VS_POINTS, FS_POINTS);
    const z = PP.u;
    gl.useProgram(PP.p);
    common(z, f, c);
    gl.bindVertexArray(pvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
    if (Pt.version !== pVersion) {
      gl.bufferData(gl.ARRAY_BUFFER, Pt.buf, gl.DYNAMIC_DRAW);
      pVersion = Pt.version;
    }
    for (const [loc, off] of [[0, 0], [1, 16]]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 32, off);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.uniform3f(z.u_centre, Pt.centre[0], Pt.centre[1], Pt.centre[2] || 0);
    gl.uniform1f(z.u_time, f.time);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 8, Pt.n);
    gl.bindVertexArray(null);
  }

  const ftex = [];
  let none = null;
  const nearest = () => { for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); };
  function gridTex(tex, cols, rows, buf) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    nearest();
  }
  /** A grid's depths (Grid.deep: 4 floats a cell), or none. */
  function deepTex(tex, cols, rows, deep) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    if (deep) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cols, rows, 0, gl.RGBA, gl.FLOAT, deep);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(4));
    nearest();
  }
  /** The zoom's own grid's depths, uploaded when they change (renderer.setZoom marks them). */
  r.zdeep = null;
  cam.deep = (z) => {
    r.zdeep ||= gl.createTexture();
    deepTex(r.zdeep, z.cols, z.rows, z.deep);
  };
  function zoomCubes(f, Z, c, tex, deep) {
    ZP ||= program(gl, VS_ZOOM, FS_ZOOM);
    const z = ZP.u;
    gl.useProgram(ZP.p);
    gl.uniform3fv(z.u_bgA, f.themeA.bg); gl.uniform3fv(z.u_fgA, f.themeA.fg);
    gl.uniform3fv(z.u_bgB, f.themeB.bg); gl.uniform3fv(z.u_fgB, f.themeB.fg);
    gl.uniform1f(z.u_themeT, f.themeT);
    gl.uniform2f(z.u_themeOrigin, f.themeOrigin[0], f.themeOrigin[1]);
    gl.uniform2f(z.u_viewDev, r.canvas.width, r.canvas.height);
    gl.uniform1f(z.u_dpr, r.dpr);
    const n = f.pulses ? f.pulses.n : 0;
    gl.uniform1i(z.u_pulseN, n);
    if (n) {
      gl.uniform4fv(z.u_pulse, f.pulses.data, 0, n * 4);
      gl.uniform1f(z.u_pulseSpeed, f.pulseSpeed);
      gl.uniform1f(z.u_pulseWidth, f.pulseWidth);
    }
    gl.uniform1f(z.u_time, f.time);
    gl.uniform1f(z.u_scroll, f.scroll);
    gl.uniformMatrix4fv(z.u_vp, true, c.vp);
    gl.uniform3fv(z.u_eye, c.eye);
    gl.uniform3fv(z.u_piv, c.piv);
    gl.uniform1f(z.u_s, c.s);
    gl.uniform1f(z.u_k, cam.view.k);
    // A flat picture (the desk, the town) fades as it turns away, rather than show mirrored; points in space (cam.view.round) are seen from either side.
    gl.uniform1f(z.u_face, cam.view.round ? 1 : Math.min(1, Math.max(0, (c.eye[2] - 0.15) / 0.35)));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(z.u_zGrid, 0);
    if (!deep) { if (!none) deepTex(none = gl.createTexture(), 1, 1, null); deep = none; } // no depths: every cell a cube deep
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, deep);
    gl.uniform1i(z.u_zDeep, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4fv(z.u_zHole, Z.hole || [0, 0, 0, 0]);
    gl.uniform1f(z.u_zDot, Z.dot || 1);
    gl.uniform1f(z.u_zRing, Z.ring ? 1 : 0);
    gl.uniform4f(z.u_zArea, Z.x, Z.y, Z.cols, Z.rows);
    gl.uniform1f(z.u_zB, Z.cell);
    gl.uniform4fv(z.u_ball, Z.ball || [0, 0, 0, 0]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.bindVertexArray(zvao);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 8, Z.cols * Z.rows * 2); // each cell's block, then its second one
    gl.bindVertexArray(null);
  }

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
