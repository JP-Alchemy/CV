// The time-dependent Schrödinger equation on the GPU, for one electron in two
// dimensions, iħ ∂ψ/∂t = −(ħ²/2m)∇²ψ + Vψ, in units where ħ = m = one grid
// cell = 1.
//
// The scheme is Visscher's (A fast explicit algorithm for the time-dependent
// Schrödinger equation, Computers in Physics 5, 596, 1991): split ψ into its
// real and imaginary parts R and I, keep R at whole steps and I half a step
// later, and leapfrog them: R += dt·H·I, then I −= dt·H·R. Each half is one
// five-point stencil, a single fragment pass over the grid. It conserves
// probability (to within the grid's rounding) for any dt·E_max < 2.
//
// The barrier with the slits in it absorbs, like the metal foil of a real
// slit plate: inside it ψ is damped harder the deeper it goes, so most of
// what hits it is taken rather than bounced back.
//
// The edges of the grid are absorbing: there ψ is damped a little every step,
// and what's taken is added up in the field's third channel. Taken at the
// right-hand edge it is the detector screen's: the electron's chance of
// landing on each row. Anywhere else it bounced back or went off the side.
//
// Textures: the field is RGBA float (R, I, absorbed, 0); the walls are RGBA8
// (hard wall, the grid's rim; damping; screen; barrier). One small pass a frame sums
// each row (screen, lost, still in flight, peak) into a 1 × NY texture, which
// is read back without stalling (a pixel-pack buffer and a fence).

export const NX = 256; // along the beam
export const NY = 160; // across it
export const DT = 0.4; // the kinetic energy tops out at 4 here, so dt·E_max = 1.6 < 2

/** The experiment's layout, in cells. */
export const GEO = {
  edge: 18,        // absorbing border, top, bottom and back
  screen: 34,      // the detector screen's absorbing depth, at the right
  barrier: 84,     // the barrier's left face
  thick: 8,
  slitW: 7,
  slitD: 22,       // centre to centre
  gunX: 40,
};
export const SCREEN_X = NX - GEO.screen; // where the screen starts

const VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_f;
uniform highp sampler2D u_p;
uniform float u_dt;
out vec4 o;
vec4 F(ivec2 c) { return texelFetch(u_f, c, 0); }
`;

// R += dt·H·I, with H = −½∇² (walls are zero, so they need nothing more).
const FS_R = `${HEAD}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 f = F(c);
  vec4 p = texelFetch(u_p, c, 0);
  if (p.r > 0.0) { o = vec4(0.0, 0.0, f.b, 0.0); return; }
  float lap = F(c + ivec2(1, 0)).g + F(c - ivec2(1, 0)).g + F(c + ivec2(0, 1)).g + F(c - ivec2(0, 1)).g - 4.0 * f.g;
  o = vec4(f.r - u_dt * 0.5 * lap, f.g, f.b, 0.0);
}`;

// I −= dt·H·R, then the edges damp both and keep count of what they took.
const FS_I = `${HEAD}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 f = F(c);
  vec4 p = texelFetch(u_p, c, 0);
  if (p.r > 0.0) { o = vec4(0.0, 0.0, f.b, 0.0); return; }
  float lap = F(c + ivec2(1, 0)).r + F(c - ivec2(1, 0)).r + F(c + ivec2(0, 1)).r + F(c - ivec2(0, 1)).r - 4.0 * f.r;
  float re = f.r, im = f.g + u_dt * 0.5 * lap;
  float m = 1.0 - p.g;
  o = vec4(re * m, im * m, f.b + (1.0 - m * m) * (re * re + im * im), 0.0);
}`;

// Each row of the grid, summed: (absorbed by the screen, absorbed elsewhere, in flight, peak |ψ|²).
const FS_SUM = `${HEAD}
void main() {
  int y = int(gl_FragCoord.y);
  vec4 s = vec4(0.0);
  for (int x = 0; x < ${NX}; x++) {
    vec4 f = F(ivec2(x, y));
    float d = f.r * f.r + f.g * f.g;
    bool scr = texelFetch(u_p, ivec2(x, y), 0).b > 0.5;
    s += vec4(scr ? f.b : 0.0, scr ? 0.0 : f.b, d, 0.0);
    s.a = max(s.a, d);
  }
  o = s;
}`;

// A new electron: a Gaussian packet at u_g (centre, σx, σy) moving with u_k,
// I a half step on, as the leapfrog wants it.
const FS_FIRE = `${HEAD}
uniform vec4 u_g;
uniform vec2 u_k;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (texelFetch(u_p, c, 0).r > 0.0) { o = vec4(0.0); return; }
  vec2 d = vec2(c) - u_g.xy;
  float env = exp(-0.25 * (d.x * d.x / (u_g.z * u_g.z) + d.y * d.y / (u_g.w * u_g.w)));
  float E = (1.0 - cos(u_k.x)) + (1.0 - cos(u_k.y)); // the grid's own dispersion
  float ph = dot(u_k, vec2(c));
  o = vec4(env * cos(ph), env * sin(ph - E * u_dt * 0.5), 0.0, 0.0);
}`;

// A measurement: ψ times a Gaussian window round u_m (x, y, σ) if the
// electron was found there, or times one minus it if it wasn't; renormalised
// by u_s. What the edges had taken is forgotten: it's a fresh state.
const FS_MEASURE = `${HEAD}
uniform vec3 u_m;
uniform float u_found;
uniform float u_s;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 f = F(c);
  vec2 d = vec2(c) - u_m.xy;
  float w = exp(-dot(d, d) / (2.0 * u_m.z * u_m.z));
  float k = (u_found > 0.5 ? w : 1.0 - w) * u_s;
  o = vec4(f.r * k, f.g * k, 0.0, 0.0);
}`;

const FS_CLEAR = `${HEAD}
void main() { o = vec4(0.0); }`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

/** Which float format this GPU can render into, or null: 32-bit, else 16-bit. */
export function floatFormat(gl) {
  if (gl.getExtension('EXT_color_buffer_float')) return { internal: gl.RGBA32F, type: gl.FLOAT, bits: 32 };
  if (gl.getExtension('EXT_color_buffer_half_float')) return { internal: gl.RGBA16F, type: gl.HALF_FLOAT, bits: 16 };
  return null;
}

/** The walls and edges for `slits` (1 or 2) as RGBA8: hard wall (the grid's rim), damping (0-255), screen, barrier. */
export function wallMap(slits) {
  const { edge, screen, barrier, thick, slitW, slitD } = GEO;
  const buf = new Uint8Array(NX * NY * 4);
  const mid = NY / 2;
  const open = (y) => (slits === 2
    ? Math.abs(Math.abs(y + 0.5 - mid) - slitD / 2) < slitW / 2
    : Math.abs(y + 0.5 - mid) < slitW / 2);
  // A smooth ramp keeps the absorbing edge from reflecting much.
  const ramp = (d, w, top) => (d >= w ? 0 : top * (1 - d / w) ** 2);
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const k = (y * NX + x) * 4;
      const border = x === 0 || y === 0 || x === NX - 1 || y === NY - 1;
      if (border) { buf[k] = 2; continue; }
      // The barrier soaks electrons up, the way a real slit plate does:
      // damping that deepens through it, so little bounces back off its face.
      if (x >= barrier && x < barrier + thick && !open(y)) {
        const d = (x - barrier + 1) / thick;
        buf[k + 1] = Math.round(Math.min(1, 0.04 + 0.5 * d * d) * 255);
        buf[k + 3] = 255;
        continue;
      }
      const scr = x >= NX - screen;
      const damp = Math.max(
        ramp(x, edge, 0.12), ramp(y, edge, 0.12), ramp(NY - 1 - y, edge, 0.12),
        scr ? ramp(NX - 1 - x, screen, 0.14) : 0,
      );
      buf[k + 1] = Math.round(Math.min(1, damp) * 255);
      buf[k + 2] = scr ? 255 : 0;
    }
  }
  return buf;
}

export class Solver {
  constructor(gl, fmt) {
    this.gl = gl;
    this.fmt = fmt;
    this.progs = {
      r: program(gl, FS_R), i: program(gl, FS_I), sum: program(gl, FS_SUM),
      fire: program(gl, FS_FIRE), measure: program(gl, FS_MEASURE), clear: program(gl, FS_CLEAR),
    };
    this.vao = gl.createVertexArray();
    const tex = (w, h) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, gl.RGBA, fmt.type, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb, w, h };
    };
    this.a = tex(NX, NY);
    this.b = tex(NX, NY);
    this.sumT = tex(1, NY);
    this.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.walls = gl.createTexture();
    this.slits = 0;
    this.pbo = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, NY * 16, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.fence = null;
    this.rows = new Float32Array(NY * 4);
    this.clear();
  }

  /** The current field texture (for drawing) and the walls. */
  get field() { return this.a.t; }

  setSlits(n) {
    if (n === this.slits) return;
    const gl = this.gl;
    this.slits = n;
    this.wallBuf = wallMap(n);
    gl.bindTexture(gl.TEXTURE_2D, this.walls);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NX, NY, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.wallBuf);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  }

  /** Run `prog` into `dst` with the field `src` and the walls bound. */
  pass(prog, dst, src, set) {
    const gl = this.gl;
    const { p, u } = prog;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src ? src.t : null);
    gl.uniform1i(u.u_f, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.walls);
    gl.uniform1i(u.u_p, 1);
    gl.uniform1f(u.u_dt, DT);
    set?.(u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  begin() {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.vao);
  }

  end() {
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Into the other texture and back: a.t always holds the latest field. */
  swap() { [this.a, this.b] = [this.b, this.a]; }

  clear() {
    this.begin();
    this.pass(this.progs.clear, this.a, null);
    this.pass(this.progs.clear, this.b, null);
    this.end();
  }

  /** A new electron at (x, y) with wavevector (kx, ky) and widths σx, σy. Peak |ψ| is 1. */
  fire(x, y, kx, ky, sx, sy) {
    this.begin();
    this.pass(this.progs.fire, this.b, null, (u) => {
      this.gl.uniform4f(u.u_g, x, y, sx, sy);
      this.gl.uniform2f(u.u_k, kx, ky);
    });
    this.swap();
    this.end();
    this.norm0 = 2 * Math.PI * sx * sy; // ∑|ψ|² of the packet
    this.drop(); // anything in flight was the last electron's
  }

  step(n) {
    this.begin();
    for (let k = 0; k < n; k++) {
      this.pass(this.progs.r, this.b, this.a);
      this.swap();
      this.pass(this.progs.i, this.b, this.a);
      this.swap();
    }
    this.end();
  }

  /**
   * Sum the rows and start reading them back; true if a reading was started.
   * With `sync` set (for driving frames by hand, when nothing returns to the
   * event loop for a fence to signal) it reads them at once, stalling.
   */
  request() {
    if (this.fence || this.ready) return false;
    const gl = this.gl;
    this.begin();
    this.pass(this.progs.sum, this.sumT, this.a);
    if (this.sync) {
      gl.readPixels(0, 0, 1, NY, gl.RGBA, gl.FLOAT, this.rows);
      this.ready = true;
      this.end();
      return true;
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.readPixels(0, 0, 1, NY, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    this.end();
    return true;
  }

  /** The rows, once they've arrived: Float32Array of NY × (screen, lost, flight, peak), else null. */
  poll() {
    if (this.ready) { this.ready = false; return this.rows; }
    if (!this.fence) return null;
    const gl = this.gl;
    const s = gl.clientWaitSync(this.fence, 0, 0);
    if (s === gl.TIMEOUT_EXPIRED) return null;
    gl.deleteSync(this.fence);
    this.fence = null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.rows);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return this.rows;
  }

  /** The whole field, now (for a measurement): Float32Array NX × NY × 4. */
  read() {
    const gl = this.gl;
    const out = new Float32Array(NX * NY * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.a.fb);
    gl.readPixels(0, 0, NX, NY, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }

  /** Apply a measurement's outcome at (x, y) with window σ, rescaled by s. */
  measure(x, y, sigma, found, s) {
    this.begin();
    this.pass(this.progs.measure, this.b, this.a, (u) => {
      this.gl.uniform3f(u.u_m, x, y, sigma);
      this.gl.uniform1f(u.u_found, found ? 1 : 0);
      this.gl.uniform1f(u.u_s, s);
    });
    this.swap();
    this.end();
    this.drop();
  }

  /** Forget a reading in flight. */
  drop() {
    if (this.fence) this.gl.deleteSync(this.fence);
    this.fence = null;
    this.ready = false;
  }
}
