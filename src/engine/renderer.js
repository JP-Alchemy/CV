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
  vec2 lp = (a_corner - 0.5) * sz;
  float cs = cos(ang), sn = sin(ang);
  vec2 pos = c + vec2(cs * lp.x - sn * lp.y, sn * lp.x + cs * lp.y);
  bool fixed_ = (flags & 1) != 0;
  if (!fixed_) pos.y -= u_scroll;
  if (rest) pos = floor(pos * u_dpr + 0.5) / u_dpr;
  gl_Position = vec4(pos.x / u_view.x * 2.0 - 1.0, 1.0 - pos.y / u_view.y * 2.0, 0.5 - a_meta.z * 0.04, 1.0);
  v_uv = a_corner * 2.0 - 1.0;
  v_half = sz * 0.5 * u_dpr;
  v_round = rnd;
  v_tone = tone;
  v_clip = fixed_ ? -1e6 : u_navClip;
}`;

const FS_BLOCK = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_half;
in float v_round;
in float v_tone;
in float v_clip;
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
  o = vec4(mix(bg, fg, v_tone), 1.0);
}`;

const VS_BG = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.999, 1.0);
}`;

const FS_BG = `#version 300 es
precision highp float;
uniform float u_scroll;
uniform vec2 u_gridOrigin;
uniform float u_gridStep;
uniform vec2 u_mouse;
uniform float u_dotAlpha;
out vec4 o;
${THEME_GLSL}
void main() {
  float t = themeK();
  vec3 bg = mix(u_bgA, u_bgB, t);
  vec3 fg = mix(u_fgA, u_fgB, t);
  vec2 sp = vec2(gl_FragCoord.x, u_viewDev.y - gl_FragCoord.y) / u_dpr;
  vec2 m = mod(sp + vec2(0.0, u_scroll) - u_gridOrigin, u_gridStep);
  float near = smoothstep(240.0, 0.0, distance(sp, u_mouse));
  float a = (m.x < 2.0 && m.y < 2.0) ? u_dotAlpha + near * 0.22 : 0.0;
  o = vec4(mix(bg, fg, a), 1.0);
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
    u[info.name] = gl.getUniformLocation(p, info.name);
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

    let { u, p } = this.bg;
    gl.useProgram(p);
    setTheme(u);
    gl.uniform1f(u.u_scroll, f.scroll);
    gl.uniform2f(u.u_gridOrigin, f.gridOrigin[0], f.gridOrigin[1]);
    gl.uniform1f(u.u_gridStep, f.gridStep);
    gl.uniform2f(u.u_mouse, f.mouse[0], f.mouse[1]);
    gl.uniform1f(u.u_dotAlpha, f.dotAlpha);
    gl.bindVertexArray(this.bgVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!this.count) return;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    ({ u, p } = this.blocks);
    gl.useProgram(p);
    setTheme(u);
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
