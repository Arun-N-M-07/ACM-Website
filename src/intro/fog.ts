/**
 * Ground mist for the film's materials.
 *
 * three.js fog only knows distance. Morning mist also knows height: it lies
 * thick on the ground and thins upward, which is what lets the clock tower
 * come out of it before the porch does, and leaves a breath of it lying on
 * the lawns once the day has broken. This patch replaces a material's fog
 * with both, integrated exactly along each view ray:
 *
 *   haze  = 1 − exp(−(ρ·d)²)                                  (the scene's FogExp2)
 *   mist  = 1 − exp(−∫ d0·e^(−(y − y0)/H) ds)                 (height-falling density)
 *   fog   = 1 − (1 − haze)(1 − mist)
 *
 * and tints the fog towards the sun where the view looks into it (light
 * scattered forward through the mist).
 *
 * The uniforms are one shared object, so every patched material follows the
 * film's light with a single write per frame (IntroAtmosphere). With the
 * mist amount at 0, the result is exactly the scene's fog.
 */
import { Color, type Material, Vector3, Vector4 } from 'three';

export const mistUniforms = {
  /** x: density at the ground, y: thinning height (m), z: ground level (m), w: amount (0 = off). */
  uMist: { value: new Vector4(0, 8, 0, 0) },
  uMistSun: { value: new Vector3(0.8, 0.1, 0.5) },
  /** Colour of the mist lit from behind by the sun. */
  uMistGlow: { value: new Color('#ffd2a8') },
  /** Lightning: where in the sky it is (xyz, unit) and how much of it the air holds (w). */
  uMistFlash: { value: new Vector4(0, 1, 0, 0) },
  uMistFlashColor: { value: new Color('#c9d4ec') },
};

const PARS_VERTEX = /* glsl */ `
#include <fog_pars_vertex>
#ifdef USE_FOG
varying vec3 vMistWorld;
#endif
`;

const VERTEX = /* glsl */ `
#include <fog_vertex>
#ifdef USE_FOG
{
  vec4 mw = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    mw = instanceMatrix * mw;
  #endif
  vMistWorld = ( modelMatrix * mw ).xyz;
}
#endif
`;

const PARS_FRAGMENT = /* glsl */ `
#include <fog_pars_fragment>
#ifdef USE_FOG
varying vec3 vMistWorld;
uniform vec4 uMist;
uniform vec3 uMistSun;
uniform vec3 uMistGlow;
uniform vec4 uMistFlash;
uniform vec3 uMistFlashColor;
#endif
`;

const FRAGMENT = /* glsl */ `
#ifdef USE_FOG
{
  vec3 rd = vMistWorld - cameraPosition;
  float dist = length( rd );
  rd /= max( dist, 1e-4 );
  #ifdef FOG_EXP2
    float haze = 1.0 - exp( - fogDensity * fogDensity * dist * dist );
  #else
    float haze = smoothstep( fogNear, fogFar, dist );
  #endif
  float mist = 0.0;
  if ( uMist.w > 0.0 ) {
    float H = max( uMist.y, 0.1 );
    float oy = clamp( cameraPosition.y - uMist.z, -30.0, 400.0 );
    float k = rd.y / H;
    float integ = abs( k ) > 1e-4
      ? exp( - oy / H ) * ( 1.0 - exp( - k * dist ) ) / k
      : exp( - oy / H ) * dist;
    mist = ( 1.0 - exp( - uMist.x * max( integ, 0.0 ) ) ) * uMist.w;
  }
  float fogAmount = 1.0 - ( 1.0 - haze ) * ( 1.0 - mist );
  float toward = pow( max( dot( rd, uMistSun ), 0.0 ), 5.0 );
  vec3 fc = mix( fogColor, uMistGlow, toward * 0.85 * uMist.w );
  // Lightning in the air: the whole of it lifts, and far more towards the flash — the more air
  // between here and the lens, the more of the light it holds (it is carried by fogAmount).
  if ( uMistFlash.w > 0.0 ) {
    float lobe = pow( max( dot( rd, uMistFlash.xyz ), 0.0 ), 3.0 );
    fc += uMistFlashColor * uMistFlash.w * ( 0.22 + 1.1 * lobe );
  }
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fc, fogAmount );
}
#endif
`;

/** Give a material the film's mist (idempotent). */
export function patchMist(m: Material) {
  const mm = m as Material & { fog?: boolean; userData: Record<string, unknown> };
  if (mm.userData.mist || mm.fog === false) return false;
  mm.userData.mist = true;
  // The program-cache key must still tell apart materials with different
  // hooks of their own: take it before the hook is wrapped.
  const baseKey = mm.customProgramCacheKey ? mm.customProgramCacheKey() : '';
  const prev = mm.onBeforeCompile;
  mm.onBeforeCompile = (shader, renderer) => {
    prev?.call(mm, shader, renderer);
    Object.assign(shader.uniforms, mistUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <fog_pars_vertex>', PARS_VERTEX).replace('#include <fog_vertex>', VERTEX);
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_pars_fragment>', PARS_FRAGMENT).replace('#include <fog_fragment>', FRAGMENT);
  };
  mm.customProgramCacheKey = () => `${baseKey}|mist`;
  mm.needsUpdate = true;
  return true;
}
