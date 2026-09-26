/**
 * Portal shaders.
 *
 * MEMBRANE — the disc inside the ring. A tunnel mapping (depth = k / r) turns
 * polar noise into filaments and rings that recede into the centre, so the
 * flat disc reads as a deep well. The vanishing point shifts slightly with
 * the pointer (parallax), and far down the well a thin vertical light hints
 * at what's on the other side.
 *   uFlow      integrated scroll of the well (JS integrates speed × dt, so
 *              speeding up never jumps the pattern)
 *   uHold      0..1 hold progress: brightens, warms, opens the far light
 *   uPressure  scroll pushed against the gate: the rim flares (a hint)
 *   uPointer   smoothed pointer (NDC)
 *
 * CHANNEL — a thin ring of light inside the frame. It fills clockwise from
 * the top as the hold progresses (with a bright leading head); idle, three
 * soft pulses circle it to say "this is interactive".
 *   uHold, uTime, uPressure
 *
 * MOTES — dust in front of the portal. Idle, it drifts; from 0.75 s of hold
 * it is drawn in and spirals into the ring.
 *   uTime, uPull (0..1), uGlow, uPixelRatio
 */
import { FLOW, NOISE } from '../glsl';

export const MEMBRANE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const MEMBRANE_FRAG = /* glsl */ `
uniform float uFlow;
uniform float uHold;
uniform float uPressure;
uniform float uTime;
uniform vec2 uPointer;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r0 = length(p);
  vec2 q = p - uPointer * 0.1 * (1.0 - r0 * r0);
  float r = length(q);
  float a = atan(q.y, q.x);
  float depth = 0.32 / (r + 0.05);
  float z = depth + uFlow;
  vec2 ring = vec2(cos(a), sin(a)) * 2.4;
  float n = fbm(ring + vec2(z * 0.8, z * 0.35));
  float fil = smoothstep(0.52, 0.86, n) * smoothstep(0.03, 0.5, r);
  float rings = pow(0.5 + 0.5 * sin(z * 5.2), 14.0) * smoothstep(0.08, 0.7, r);
  float h = uHold;
  vec3 cool = vec3(0.46, 0.64, 1.0);
  vec3 warm = vec3(1.0, 0.76, 0.8);
  vec3 tint = mix(cool, warm, smoothstep(0.35, 1.0, h));
  vec3 col = vec3(0.010, 0.012, 0.020) * (1.0 - r * 0.4);
  col += tint * fil * (0.05 + 0.3 * h + 0.25 * h * h);
  col += tint * rings * (0.025 + 0.14 * h);
  float rim = smoothstep(0.8, 1.0, r0);
  col += cool * rim * (0.12 + 0.55 * h + 0.5 * uPressure);
  // Far down the well: a thin vertical light — the world on the other side.
  float far = exp(-abs(q.x) * 120.0) * smoothstep(0.26, 0.0, abs(q.y)) * smoothstep(0.3, 0.02, r);
  col += warm * far * (0.12 + 0.9 * h) * (0.85 + 0.15 * sin(uTime * 1.7));
  // The opening: light at the end of the tunnel, blooming as the hold completes.
  col += vec3(1.0, 0.96, 0.93) * exp(-r * r * mix(70.0, 24.0, h)) * (0.02 + 1.3 * h * h * h * h);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const CHANNEL_VERT = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CHANNEL_FRAG = /* glsl */ `
uniform float uHold;
uniform float uTime;
uniform float uPressure;
uniform float uInner;
uniform float uOuter;
varying vec2 vPos;
void main() {
  float a = fract(atan(vPos.x, vPos.y) / 6.28318530718);
  float rr = (length(vPos) - uInner) / (uOuter - uInner);
  float band = exp(-pow((rr - 0.5) * 3.2, 2.0));
  float track = 0.05 + 0.05 * uPressure;
  float filled = uHold > 0.001 ? step(a, uHold) : 0.0;
  float head = uHold > 0.001 ? exp(-abs(a - uHold) * 90.0) * (1.0 - step(0.999, uHold)) : 0.0;
  float idle = 0.0;
  for (int k = 0; k < 3; k++) {
    float c = fract(uTime * 0.07 + float(k) / 3.0);
    float d = min(abs(a - c), 1.0 - abs(a - c));
    idle += exp(-d * 60.0);
  }
  idle *= (0.22 + 0.5 * uPressure) * (1.0 - smoothstep(0.0, 0.08, uHold));
  float breathe = 0.85 + 0.15 * sin(uTime * 1.6);
  float glow = track * breathe + idle + filled * (0.55 + 1.6 * uHold) + head * 3.0;
  vec3 col = mix(vec3(0.62, 0.76, 1.0), vec3(1.0, 0.9, 0.9), smoothstep(0.4, 1.0, uHold));
  gl_FragColor = vec4(col * glow * band, 1.0);
}
`;

export const MOTES_VERT = /* glsl */ `
uniform float uTime;
uniform float uPull;
uniform float uPixelRatio;
uniform float uGlow;
attribute vec4 aSeed;
varying float vAlpha;
${FLOW}
void main() {
  vec3 p = position;
  p += flow(p * 0.9 + aSeed.xyz * 6.0, uTime * 0.35) * 0.12;
  // Drawn in: spiral towards the ring's centre and into it.
  float pull = clamp(uPull * (0.75 + 0.5 * aSeed.w), 0.0, 1.0);
  float ang = atan(p.y, p.x) + pull * pull * (2.2 + aSeed.x * 1.5);
  float rad = length(p.xy) * (1.0 - 0.88 * pull * pull);
  vec3 target = vec3(cos(ang) * rad, sin(ang) * rad, p.z * (1.0 - pull) - pull * 0.4);
  p = mix(p, target, smoothstep(0.0, 1.0, pull));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = (1.2 + aSeed.w * 2.4) * (1.0 + uGlow * 0.8);
  gl_PointSize = size * uPixelRatio * (6.0 / -mv.z);
  vAlpha = (0.25 + 0.75 * aSeed.y) * (0.35 + uGlow) * (1.0 - smoothstep(0.85, 1.0, pull) * 0.9);
}
`;

export const MOTES_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * a * vAlpha, a * vAlpha);
}
`;
