// WebGL2 renderer: one instanced draw call for every block on the page.
// Each instance carries its own from/to state and timing, so the GPU evaluates
// all motion; the CPU only rewrites buffers when the scene changes.
//
// Instance layout (24 floats):
//   0-3   from x, y, w, h        (CSS px; doc space unless FIXED)
//   4-7   to   x, y, w, h
//   8-11  mosaic cell A center xy, cell B center xy
//   12-15 t0, dur, arc, tumble   (seconds; arc = sideways bend; tumble = radians)
//   16-19 fromTone, toTone, z, flags
//   20-23 cell A size, cell B size, -, -
//
// Plain instances move from -> to. MOSAIC instances take three steps:
// coalesce into cell square A, tumble across to cell square B, resolve into
// their target — so a page pixelates, re-arranges as coarse squares, and
// sharpens into the next page.

export const STRIDE = 24;
export const FIXED = 1; // ignores scroll (nav)
export const FLAT = 2; // no tumble/rounding while moving (large fills)
export const MOSAIC = 4; // three-step path through grid cells
export const TRAIL = 48; // pointer samples kept for the push field
export const PULSES = 4; // simultaneous click light pulses

const THEME_GLSL = `
uniform vec3 u_bgA, u_fgA, u_bgB, u_fgB;
uniform float u_themeT;
uniform vec2 u_themeOrigin;
uniform vec2 u_viewDev;
uniform float u_dpr;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// Pixel-dissolve between the previous (A) and current (B) theme.
float themeK() {
  if (u_themeT >= 2.0) return 1.0;
  vec2 sp = vec2(gl_FragCoord.x, u_viewDev.y - gl_FragCoord.y) / u_dpr;
  float cell = 12.0;
  vec2 c = floor(sp / cell);
  float d = distance((c + 0.5) * cell, u_themeOrigin) / length(u_viewDev / u_dpr);
  return step(d * 0.75 + hash12(c) * 0.25, u_themeT);
}
`;

// The pointer's recent path pushes blocks around. Each sample is an impulse
// (where the pointer was, how far it moved, when); a block's offset is the
// sum of damped-spring responses to the impulses near it, so blocks get
// shoved along and sideways, overshoot a little and settle back. Stateless:
// it is a pure function of the samples, so re-packing instances or starting
// a morph never interrupts it.
const PUSH_GLSL = `
uniform vec4 u_trail[${TRAIL}];  // doc-space x, y; pointer motion dx, dy (px)
uniform vec2 u_trailM[${TRAIL}]; // time, click-burst strength
uniform int u_trailN;
uniform float u_pushR;
uniform float u_pushGain;
uniform vec4 u_trailBox; // doc-space bounds of every sample's reach (cheap early-out)
float springResp(float a) {
  return (1.0 - exp(-a * 45.0)) * exp(-a * 6.5) * (cos(a * 15.0) + 0.43 * sin(a * 15.0));
}
// Offset (xy) and spin (z) for a block centred at doc-space p.
vec3 pushAt(vec2 p, float mass) {
  vec3 acc = vec3(0.0);
  if (p.x < u_trailBox.x || p.y < u_trailBox.y || p.x > u_trailBox.z || p.y > u_trailBox.w) return acc;
  for (int i = 0; i < ${TRAIL}; i++) {
    if (i >= u_trailN) break;
    vec4 s = u_trail[i];
    vec2 m = u_trailM[i];
    float age = u_time - m.x;
    if (age < 0.0 || age > 1.3) continue;
    float R = m.y > 0.0 ? u_pushR * 2.2 : u_pushR;
    vec2 d = p - s.xy;
    float r = length(d);
    if (r >= R) continue;
    vec2 rd = r > 0.001 ? d / r : vec2(0.0, -1.0);
    float fall = 1.0 - (r * r) / (R * R);
    fall *= fall;
    float resp = springResp(age);
    if (m.y > 0.0) { // click: radial burst
      acc.xy += rd * fall * m.y * resp;
      continue;
    }
    float imp = length(s.zw);
    if (imp < 0.001) continue;
    vec2 vd = s.zw / imp;
    vec2 dv = rd + vd * 0.7; // forward and outward, like wading through sand
    float dl = length(dv);
    float w = fall * min(imp, 60.0) * resp;
    acc.xy += (dl > 0.001 ? dv / dl : vd) * w;
    acc.z += (rd.x * vd.y - rd.y * vd.x) * w; // either side of the path spins opposite ways
  }
  acc.xy *= u_pushGain * mass;
  float L = length(acc.xy);
  float M = 30.0 * mass;
  if (L > 0.0001) acc.xy *= M * tanh(L / M) / L;
  acc.z = clamp(acc.z * u_pushGain * 0.025, -0.8, 0.8);
  return acc;
}
`;

// Click light: a ring expanding from the click point. Pixels inside the ring
// take one flat colour from a 7-step spectrum (red at the leading edge,
// violet at the trailing edge, like a rainbow) and the brightness is
// quantised with a per-pixel dither, so it reads as lit pixels rather than
// a smooth glow. It fades with distance and time.
const LIGHT_GLSL = `
uniform vec4 u_pulse[${PULSES}]; // doc-space x, y; start time; strength
uniform int u_pulseN;
uniform float u_pulseSpeed;
uniform float u_pulseWidth;
const vec3 SPECTRUM[7] = vec3[7](
  vec3(1.00, 0.27, 0.23), vec3(1.00, 0.58, 0.16), vec3(1.00, 0.86, 0.20), vec3(0.30, 0.86, 0.42),
  vec3(0.20, 0.80, 0.95), vec3(0.25, 0.42, 1.00), vec3(0.62, 0.32, 1.00));
float hashL(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// Light at doc-space p: rgb + level (0 = unlit). seed is stable per pixel.
vec4 lightAt(vec2 p, vec2 seed) {
  float I = 0.0, k = 0.0;
  for (int i = 0; i < ${PULSES}; i++) {
    if (i >= u_pulseN) break;
    vec4 P = u_pulse[i];
    float age = u_time - P.z;
    if (age < 0.0) continue;
    float r = distance(p, P.xy);
    float u = (age * u_pulseSpeed - r) / u_pulseWidth; // 0 leading edge .. 1 trailing edge
    if (u <= 0.0 || u >= 1.0) continue;
    float v = sin(3.14159265 * u) * P.w * exp(-r / 700.0) * (1.0 - smoothstep(0.8, 1.5, age));
    if (v > I) { I = v; k = u; }
  }
  if (I <= 0.0) return vec4(0.0);
  float level = floor(min(I, 1.0) * 4.0 + hashL(seed)) / 4.0;
  int band = int(clamp(floor(k * 7.0 + (hashL(seed + 17.31) - 0.5) * 0.9), 0.0, 6.0));
  return vec4(SPECTRUM[band], level);
}
`;

const VS_BLOCK = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_from;
layout(location=2) in vec4 a_to;
layout(location=3) in vec4 a_cells;
layout(location=4) in vec4 a_anim;
layout(location=5) in vec4 a_meta;
layout(location=6) in vec4 a_csize;
uniform vec2 u_view;
uniform float u_dpr;
uniform float u_scroll;
uniform float u_time;
uniform float u_shrink;
uniform float u_navClip;
out vec2 v_uv;
out vec2 v_half;
out float v_round;
out float v_tone;
out float v_clip;
flat out vec4 v_light;
${PUSH_GLSL}
${LIGHT_GLSL}
const float PI = 3.14159265;
const float SA = 0.3;
const float SB = 0.7;
float ease(float p) { return p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) * 0.5; }
void main() {
  float p = a_anim.y > 0.0 ? clamp((u_time - a_anim.x) / a_anim.y, 0.0, 1.0) : 1.0;
  int flags = int(a_meta.w + 0.5);
  bool flat_ = (flags & 2) != 0;
  vec2 c0 = a_from.xy + a_from.zw * 0.5;
  vec2 c1 = a_to.xy + a_to.zw * 0.5;
  vec2 c;
  vec2 sz;
  float ang = 0.0;
  float rnd = 0.0;
  float tone;
  bool rest = p <= 0.0 || p >= 1.0;
  if ((flags & 4) != 0) {
    vec2 A = a_cells.xy, B = a_cells.zw;
    if (p < SA) {
      float q = ease(p / SA);
      c = mix(c0, A, q);
      sz = mix(a_from.zw, vec2(a_csize.x), q);
    } else if (p < SB) {
      float q = (p - SA) / (SB - SA);
      float e = ease(q);
      float b = sin(PI * q);
      vec2 d = B - A;
      c = mix(A, B, e) + vec2(-d.y, d.x) * b * a_anim.z;
      sz = vec2(mix(a_csize.x, a_csize.y, e)) * (1.0 - b * u_shrink * 0.5);
      ang = b * a_anim.w;
      rnd = b * 0.45;
    } else {
      float q = ease((p - SB) / (1.0 - SB));
      c = mix(B, c1, q);
      sz = mix(vec2(a_csize.y), a_to.zw, q);
    }
    tone = mix(a_meta.x, a_meta.y, smoothstep(SA, SB, p));
  } else {
    float e = ease(p);
    float b = sin(PI * p);
    vec2 d = c1 - c0;
    c = mix(c0, c1, e) + vec2(-d.y, d.x) * b * a_anim.z;
    sz = mix(a_from.zw, a_to.zw, e) * (1.0 - b * (flat_ ? 0.0 : u_shrink));
    ang = flat_ ? 0.0 : b * a_anim.w;
    rnd = flat_ ? 0.0 : b * 0.55;
    tone = mix(a_meta.x, a_meta.y, e);
  }
  bool fixed_ = (flags & 1) != 0;
  if (u_trailN > 0) {
    // Heavier (bigger) blocks travel further; body-text pixels barely budge.
    float mass = clamp(sqrt(max(sz.x, sz.y) / 8.0), 0.5, 1.2);
    vec3 ps = pushAt(fixed_ ? c + vec2(0.0, u_scroll) : c, mass);
    float pl = length(ps.xy);
    if (pl > 0.05) {
      c += ps.xy;
      ang += ps.z;
      sz *= 1.0 - min(pl / 70.0, 0.18); // detach from neighbours while displaced
      rnd = max(rnd, min(pl / 45.0, 0.3));
      rest = false;
    }
  }
  vec2 lp = (a_corner - 0.5) * sz;
  float cs = cos(ang), sn = sin(ang);
  vec2 pos = c + vec2(cs * lp.x - sn * lp.y, sn * lp.x + cs * lp.y);
  if (!fixed_) pos.y -= u_scroll;
  if (rest) pos = floor(pos * u_dpr + 0.5) / u_dpr;
  gl_Position = vec4(pos.x / u_view.x * 2.0 - 1.0, 1.0 - pos.y / u_view.y * 2.0, 0.5 - a_meta.z * 0.04, 1.0);
  v_uv = a_corner * 2.0 - 1.0;
  v_half = sz * 0.5 * u_dpr;
  v_round = rnd;
  v_tone = tone;
  v_clip = fixed_ ? -1e6 : u_navClip;
  v_light = u_pulseN > 0 ? lightAt(fixed_ ? c + vec2(0.0, u_scroll) : c, a_to.xy) : vec4(0.0);
}`;

const FS_BLOCK = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_half;
in float v_round;
in float v_tone;
in float v_clip;
flat in vec4 v_light;
out vec4 o;
${THEME_GLSL}
void main() {
  float cssY = (u_viewDev.y - gl_FragCoord.y) / u_dpr;
  if (cssY < v_clip) discard;
  if (v_round > 0.001) {
    vec2 q = abs(v_uv) * v_half;
    float r = v_round * min(v_half.x, v_half.y);
    vec2 k = q - v_half + r;
    if (length(max(k, 0.0)) + min(max(k.x, k.y), 0.0) - r > 0.0) discard;
  }
  float t = themeK();
  vec3 bg = mix(u_bgA, u_bgB, t);
  vec3 fg = mix(u_fgA, u_fgB, t);
  o = vec4(mix(mix(bg, fg, v_tone), v_light.rgb, v_light.a), 1.0);
}`;

const VS_BG = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.999, 1.0);
}`;

const FS_BG = `#version 300 es
precision highp float;
out vec4 o;
${THEME_GLSL}
void main() {
  o = vec4(mix(u_bgA, u_bgB, themeK()), 1.0);
}`;

// The background dot grid is drawn as tiny blocks too, so the empty "space"
// can be pushed around like everything else. One instance per visible dot,
// positioned from gl_InstanceID; no instance buffer needed.
const VS_DOTS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 a_corner;
uniform vec2 u_view;
uniform float u_dpr;
uniform float u_scroll;
uniform float u_time;
uniform vec2 u_gridOrigin;
uniform float u_gridStep;
uniform int u_cols;
uniform vec2 u_mouse;
uniform float u_dotAlpha;
out vec2 v_uv;
out vec2 v_half;
out float v_round;
out float v_tone;
out float v_clip;
flat out vec4 v_light;
${PUSH_GLSL}
${LIGHT_GLSL}
void main() {
  int col = gl_InstanceID % u_cols;
  int row = gl_InstanceID / u_cols;
  float st = u_gridStep;
  float x0 = u_gridOrigin.x - ceil(u_gridOrigin.x / st) * st;
  float y0 = u_scroll - mod(u_scroll, st) - st;
  vec2 c = vec2(x0 + float(col) * st, y0 + float(row) * st) + 1.0;
  float near = smoothstep(240.0, 0.0, distance(c - vec2(0.0, u_scroll), u_mouse));
  float ang = 0.0;
  bool rest = true;
  if (u_trailN > 0) {
    vec3 ps = pushAt(c, 0.6);
    if (length(ps.xy) > 0.05) { c += ps.xy; ang = ps.z; rest = false; }
  }
  // Lit dots swell from 2px to up to 8px (even sizes stay pixel-aligned).
  vec4 L = u_pulseN > 0 ? lightAt(c, vec2(float(col), y0 + float(row) * st)) : vec4(0.0);
  float ds = 2.0 + 2.0 * floor(L.a * 3.0 + 0.5);
  vec2 lp = (a_corner - 0.5) * ds;
  float cs = cos(ang), sn = sin(ang);
  vec2 pos = c + vec2(cs * lp.x - sn * lp.y, sn * lp.x + cs * lp.y);
  pos.y -= u_scroll;
  if (rest) pos = floor(pos * u_dpr + 0.5) / u_dpr;
  gl_Position = vec4(pos.x / u_view.x * 2.0 - 1.0, 1.0 - pos.y / u_view.y * 2.0, 0.9, 1.0);
  v_uv = a_corner * 2.0 - 1.0;
  v_half = vec2(ds * 0.5 * u_dpr);
  v_round = 0.0;
  v_tone = u_dotAlpha + near * 0.22;
  v_clip = -1e6;
  v_light = L;
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  const u = {};
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: true, alpha: false, depth: true, stencil: false,
      premultipliedAlpha: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.canvas = canvas;
    this.gl = gl;
    this.blocks = program(gl, VS_BLOCK, FS_BLOCK);
    this.bg = program(gl, VS_BG, FS_BG);
    this.dots = program(gl, VS_DOTS, FS_BLOCK);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf);
    for (let i = 0; i < STRIDE / 4; i++) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    gl.bindVertexArray(null);
    this.bgVao = gl.createVertexArray();
    this.dotVao = gl.createVertexArray();
    gl.bindVertexArray(this.dotVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.capacity = 0;
    this.count = 0;
    this.w = 1; this.h = 1; this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
  }

  setInstances(data, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf);
    if (count > this.capacity) {
      this.capacity = Math.ceil(count * 1.5) + 256;
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity * STRIDE * 4, gl.DYNAMIC_DRAW);
    }
    if (count) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * STRIDE);
    this.count = count;
  }

  updateInstances(data, srcOffset, dstInstance, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, dstInstance * STRIDE * 4, data, srcOffset, count * STRIDE);
  }

  draw(f) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const setTheme = (u) => {
      gl.uniform3fv(u.u_bgA, f.themeA.bg);
      gl.uniform3fv(u.u_fgA, f.themeA.fg);
      gl.uniform3fv(u.u_bgB, f.themeB.bg);
      gl.uniform3fv(u.u_fgB, f.themeB.fg);
      gl.uniform1f(u.u_themeT, f.themeT);
      gl.uniform2f(u.u_themeOrigin, f.themeOrigin[0], f.themeOrigin[1]);
      gl.uniform2f(u.u_viewDev, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.u_dpr, this.dpr);
    };

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    const setPush = (u) => {
      const T = f.trail;
      const n = T ? T.n : 0;
      gl.uniform1i(u.u_trailN, n);
      if (!n) return;
      gl.uniform4fv(u.u_trail, T.pos, 0, n * 4);
      gl.uniform2fv(u.u_trailM, T.meta, 0, n * 2);
      gl.uniform1f(u.u_pushR, f.pushR);
      gl.uniform1f(u.u_pushGain, f.pushGain);
      const b = T.box;
      gl.uniform4f(u.u_trailBox, b[0], b[1], b[2], b[3]);
    };

    const setLight = (u) => {
      const P = f.pulses;
      const n = P ? P.n : 0;
      gl.uniform1i(u.u_pulseN, n);
      if (!n) return;
      gl.uniform4fv(u.u_pulse, P.data, 0, n * 4);
      gl.uniform1f(u.u_pulseSpeed, f.pulseSpeed);
      gl.uniform1f(u.u_pulseWidth, f.pulseWidth);
    };

    let { u, p } = this.bg;
    gl.useProgram(p);
    setTheme(u);
    gl.bindVertexArray(this.bgVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const st = f.gridStep;
    const x0 = f.gridOrigin[0] - Math.ceil(f.gridOrigin[0] / st) * st;
    const cols = Math.ceil((this.w - x0) / st) + 1;
    const rows = Math.ceil(this.h / st) + 3;
    ({ u, p } = this.dots);
    gl.useProgram(p);
    setTheme(u);
    setPush(u);
    setLight(u);
    gl.uniform2f(u.u_view, this.w, this.h);
    gl.uniform1f(u.u_scroll, f.scroll);
    gl.uniform1f(u.u_time, f.time);
    gl.uniform2f(u.u_gridOrigin, f.gridOrigin[0], f.gridOrigin[1]);
    gl.uniform1f(u.u_gridStep, st);
    gl.uniform1i(u.u_cols, cols);
    gl.uniform2f(u.u_mouse, f.mouse[0], f.mouse[1]);
    gl.uniform1f(u.u_dotAlpha, f.dotAlpha);
    gl.bindVertexArray(this.dotVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cols * rows);

    if (!this.count) return;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    ({ u, p } = this.blocks);
    gl.useProgram(p);
    setTheme(u);
    setPush(u);
    setLight(u);
    gl.uniform2f(u.u_view, this.w, this.h);
    gl.uniform1f(u.u_scroll, f.scroll);
    gl.uniform1f(u.u_time, f.time);
    gl.uniform1f(u.u_shrink, f.shrink);
    gl.uniform1f(u.u_navClip, f.navClip);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }
}
