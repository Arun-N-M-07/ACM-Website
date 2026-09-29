/**
 * The loop's mosaic: where the journey comes round (JourneyLoop), the world comes apart into tiles
 * and dissolves into the mist the opening begins in — and, past the seam, the opening is put back
 * together out of it.
 *
 * One fullscreen pass over the finished frame, whichever way it was drawn (the Crew's chain, the
 * opening's, or directly: experience/lens): the frame is copied and redrawn in tiles. Every tile's
 * state is a pure function of one value — `fx.mosaic`, itself a function of the scroll's progress —
 * so it stops when the scroll stops and plays back exactly in reverse. The stages of a tile, each in
 * turn as that value passes it (the edges of the screen first, the centre, where you are looking,
 * last):
 *
 *   seams      the picture shows the joints it was made of
 *   shift      each tile's piece of the picture slides in its own window, some forward, some back
 *   settle     the tile's picture goes to its own average colour
 *   gather     the tile draws in to a soft point of light
 *   dissolve   the point fades into the mist (the same tones as the DOM mist over it: ScreenFx)
 *
 * No objects: the tiles are the pass's arithmetic, a few hundred of them at any screen size. The
 * copy of the frame is made only while the mosaic shows, and given back a few seconds after.
 */
import { FramebufferTexture, LinearFilter, ShaderMaterial, UniformsUtils, Vector2, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const MosaicShader = {
  uniforms: {
    tFrame: { value: null },
    uAmount: { value: 0 },
    uRes: { value: new Vector2(1, 1) },
    uTile: { value: 48 },
    uSeed: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tFrame;
    uniform float uAmount, uTile, uSeed;
    uniform vec2 uRes;
    varying vec2 vUv;

    float h1(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    vec2 h2(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx + p3.yz) * p3.zy);
    }
    // The opening's mist (ScreenFx: .fx-mist-base), top to bottom — the tiles dissolve into the air
    // the DOM mist then deepens over them.
    vec3 mist(float y) {
      float t = 1.0 - y;
      vec3 a = vec3(0.267, 0.282, 0.314);
      vec3 b = vec3(0.282, 0.294, 0.314);
      vec3 c = vec3(0.227, 0.235, 0.251);
      vec3 d = vec3(0.188, 0.192, 0.204);
      return t < 0.45 ? mix(a, b, t / 0.45) : t < 0.7 ? mix(b, c, (t - 0.45) / 0.25) : mix(c, d, (t - 0.7) / 0.3);
    }
    vec3 frameAt(vec2 px) { return texture2D(tFrame, clamp(px, vec2(0.5), uRes - 0.5) / uRes).rgb; }
    // A smooth field over the tiles, so neighbours come apart close together: a front, not static.
    float field(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + 1.0), f.x), f.y);
    }

    void main() {
      vec2 px = vUv * uRes;
      // Square tiles, the grid centred so the part-tiles at the edges match on both sides.
      vec2 off = 0.5 * (uRes - uTile * floor(uRes / uTile));
      vec2 g = (px - off) / uTile;
      vec2 cell = floor(g);
      vec2 q = g - cell;
      vec2 base = cell * uTile + off;
      vec2 mid = ((base + 0.5 * uTile) / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float edge = clamp(length(mid) / 0.95, 0.0, 1.0);
      float r = h1(cell + uSeed * 37.0);
      float wave = field(cell * 0.23 + uSeed * 9.7);
      // Each tile's own moment: an irregular front from the edges of the picture in to the centre
      // (where you are looking), and within it no two tiles quite alike.
      float order = 0.5 * (1.0 - edge) + 0.32 * wave + 0.18 * r;
      float a = clamp((uAmount - 0.62 * order) / 0.38, 0.0, 1.0);

      // Over the whole picture first: the joints it was made of (and gone again once it has come apart).
      float joints = smoothstep(0.0, 0.12, uAmount) * (1.0 - smoothstep(0.6, 0.9, uAmount));
      // Then each tile in turn: it separates, its picture slides in its window, settles to its own
      // colour, draws in to a point of light, and is gone into the mist.
      float open_ = smoothstep(0.0, 0.35, a);
      float slide_ = smoothstep(0.05, 0.55, a);
      float settle = smoothstep(0.35, 0.75, a);
      float gather = smoothstep(0.5, 0.92, a);
      float gone = smoothstep(0.82, 1.0, a);
      float fog = smoothstep(0.1, 0.8, uAmount);

      // Depth: some tiles come a little forward, some fall a little back.
      float z = h1(cell + 11.3 + uSeed) - 0.5;
      float size = (1.0 - 0.07 * open_) * (1.0 + 0.06 * z * slide_) * mix(1.0, 0.07, gather);
      vec2 p = (q - 0.5) / size;
      // The pictures drift outward, as if the world were opening from where you stand, each tile a
      // little its own way.
      vec2 radial = mid / max(length(mid), 1e-3);
      vec2 slide = (radial * vec2(uRes.y / uRes.x, 1.0) * 0.16 + (h2(cell + uSeed * 5.1) - 0.5) * 0.2) * slide_;
      vec2 content = clamp(0.5 + p - slide, 0.5 / uTile, 1.0 - 0.5 / uTile);
      vec3 piece = frameAt(base + content * uTile);
      vec3 avg = 0.25 * (frameAt(base + vec2(0.3, 0.3) * uTile) + frameAt(base + vec2(0.7, 0.3) * uTile) + frameAt(base + vec2(0.3, 0.7) * uTile) + frameAt(base + vec2(0.7, 0.7) * uTile));
      vec3 tile = mix(piece, avg, settle) * (1.0 + 0.12 * z * slide_);
      // As it settles it takes on the air it is going into (dark tiles don't stand out as holes).
      tile = mix(tile, mist(vUv.y), 0.5 * settle * fog);
      // Lit from within as it gathers: a point of light, not a hole.
      vec3 glow = mix(avg, vec3(0.78, 0.8, 0.85), 0.55) * 1.35 + 0.05;
      tile = mix(tile, glow, gather);

      // Its outline: a square with softened corners, rounding to a point as it gathers.
      float rad = mix(0.04, 0.5, smoothstep(0.55, 0.95, a));
      vec2 d = abs(p) - (0.5 - rad);
      float sdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - rad;
      float aa = 1.2 / max(1.0, uTile * size);
      float inside = 1.0 - smoothstep(-aa, aa, sdf);
      // The joints are physical: a fine shadow along each edge, a faint light on each upper lip.
      float nearEdge = max(abs(q.x - 0.5), abs(q.y - 0.5));
      tile *= 1.0 - 0.32 * joints * smoothstep(0.5 - 1.2 / uTile, 0.5, nearEdge) * (1.0 - gather);
      tile += 0.035 * joints * smoothstep(1.0 - 2.4 / uTile, 1.0, q.y) * (1.0 - gather);

      // Behind the tiles: the picture, a step farther back and darker, going to mist.
      vec3 behind = mix(frameAt((px - 0.5 * uRes) * 0.985 + 0.5 * uRes) * 0.35, mist(vUv.y), fog);
      vec3 col = mix(behind, tile, inside * (1.0 - gone));
      // Each point keeps a small halo in the air before it goes.
      float halo = exp(-dot(q - 0.5, q - 0.5) * mix(60.0, 16.0, gather)) * gather * (1.0 - gone) * 0.16;
      col += halo * glow;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/** Tile size in CSS pixels for a screen: a few hundred tiles, whatever its size. */
const tileCss = (w: number, h: number) => Math.min(72, Math.max(28, Math.sqrt(w * h) / 20));

export class MosaicStage {
  private quad: FullScreenQuad;
  private material: ShaderMaterial;
  private frame: FramebufferTexture | null = null;
  private idleFor = 0;
  private readonly size = new Vector2();

  constructor() {
    this.material = new ShaderMaterial({ ...MosaicShader, uniforms: UniformsUtils.clone(MosaicShader.uniforms), depthTest: false, depthWrite: false, toneMapped: false });
    this.quad = new FullScreenQuad(this.material);
  }

  /** Redraw the frame just drawn (on the screen) in tiles, `amount` of the way apart. */
  draw(gl: WebGLRenderer, amount: number, side: number, cssWidth: number, cssHeight: number) {
    this.idleFor = 0;
    gl.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.floor(this.size.x));
    const h = Math.max(1, Math.floor(this.size.y));
    if (!this.frame || this.frame.image.width !== w || this.frame.image.height !== h) {
      this.frame?.dispose();
      this.frame = new FramebufferTexture(w, h);
      this.frame.minFilter = this.frame.magFilter = LinearFilter;
    }
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(null);
    gl.copyFramebufferToTexture(this.frame);
    const u = this.material.uniforms;
    u.tFrame.value = this.frame;
    u.uAmount.value = amount;
    u.uSeed.value = side;
    (u.uRes.value as Vector2).set(w, h);
    u.uTile.value = Math.round(tileCss(cssWidth, cssHeight) * (w / Math.max(1, cssWidth)));
    const auto = gl.autoClear;
    gl.autoClear = false;
    this.quad.render(gl);
    gl.autoClear = auto;
    gl.setRenderTarget(prev);
  }

  /** On frames without the mosaic: the copy of the frame is given back after a while. */
  idle(dt: number, release: number) {
    if (!this.frame) return;
    this.idleFor += dt;
    if (this.idleFor < release) return;
    this.frame.dispose();
    this.frame = null;
  }

  dispose() {
    this.frame?.dispose();
    this.frame = null;
    this.quad.dispose();
    this.material.dispose();
  }
}
