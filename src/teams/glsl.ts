/**
 * Small GLSL building blocks shared by the Teams shaders. Textureless and
 * cheap: value noise, 3-octave fbm, and an analytic, divergence-free-ish flow
 * built from a few incommensurate sines (enough to make dust drift like air
 * without the cost of real curl noise).
 */
export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
`;

export const FLOW = /* glsl */ `
// Smooth swirling offset field (not a true curl, but close enough to read as air).
vec3 flow(vec3 p, float t) {
  return vec3(
    sin(p.y * 0.83 + t * 0.61) + sin(p.z * 1.31 - t * 0.37) * 0.6,
    sin(p.z * 0.71 + t * 0.53) + sin(p.x * 1.13 + t * 0.29) * 0.6,
    sin(p.x * 0.97 - t * 0.47) + sin(p.y * 1.27 + t * 0.41) * 0.6
  );
}
`;
