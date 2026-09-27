'use client';
/**
 * The film's lens: bloom where light is bright enough to bloom (lamps in the
 * mist, the sun, embers, the name's chrome, the door's light), and a grade
 * that follows the colour script — colour arriving with the light.
 *
 * Built from three's own passes, like the Teams world's (no new dependency):
 *   RenderPass → UnrealBloomPass (not on the low tier) → OutputPass (tone
 *   mapping + sRGB) → GradePass (saturation, lift / gain, contrast, vignette)
 *
 * Mounted only while the film is on screen, never at the same time as the
 * Teams world's composer (that one runs at the portal and beyond). The grade
 * is exactly neutral at the handoff, so the Events open on an ungraded frame
 * with no step. On the low tier the grade is a cheap CSS filter instead.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, HalfFloatType, SRGBColorSpace, Vector2, Vector3, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useExperience } from '@/store/experience';
import { look } from '../look';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uLift: { value: new Vector3() },
    uGain: { value: new Vector3(1, 1, 1) },
    uVignette: { value: 0 },
    uAspect: { value: 1 },
    uMix: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation, uContrast, uVignette, uAspect, uMix;
    uniform vec3 uLift, uGain;
    varying vec2 vUv;
    void main() {
      vec3 src = texture2D(tDiffuse, vUv).rgb;
      vec3 c = src;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Colour lives in the lights: bright pixels (lamps, embers, the sun)
      // keep theirs while the misted world is drained of it.
      float keep = smoothstep(0.5, 0.95, max(c.r, max(c.g, c.b)));
      c = mix(vec3(l), c, mix(uSaturation, max(uSaturation, 1.0), keep));
      c = c * uGain + uLift * (1.0 - c);
      c = (c - 0.5) * uContrast + 0.5;
      vec2 d = vUv - 0.5;
      d.x *= uAspect;
      c *= 1.0 - uVignette * smoothstep(0.3, 1.0, length(d) * 1.25);
      gl_FragColor = vec4(mix(src, clamp(c, 0.0, 1.0), uMix), 1.0);
    }
  `,
};

const _c = new Color();

function Composer() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const quality = useExperience((s) => s.quality);
  const dpr = gl.getPixelRatio();

  const res = useMemo(() => {
    const target = new WebGLRenderTarget(2, 2, { type: HalfFloatType });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.3, 0.62, 0.92);
    composer.addPass(bloom);
    const output = new OutputPass();
    composer.addPass(output);
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    return { composer, target, bloom, output, grade };
  }, [gl, scene, camera]);

  useEffect(() => {
    res.composer.setPixelRatio(dpr);
    res.composer.setSize(size.width, size.height);
    res.grade.material.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  }, [res, size.width, size.height, dpr]);

  useEffect(
    () => () => {
      res.composer.dispose();
      res.target.dispose();
      res.bloom.dispose();
      res.output.dispose();
      res.grade.dispose();
    },
    [res],
  );

  // Ramp in from nothing when the composer takes over (no pop).
  const blend = useRef(0);
  useFrame((_, dt) => {
    blend.current = Math.min(1, blend.current + dt * 2);
    const g = look.grade;
    const u = res.grade.material.uniforms;
    u.uSaturation.value = g.saturation;
    u.uContrast.value = g.contrast;
    g.lift.getRGB(_c, SRGBColorSpace);
    (u.uLift.value as Vector3).set(_c.r, _c.g, _c.b);
    g.gain.getRGB(_c, SRGBColorSpace);
    (u.uGain.value as Vector3).set(_c.r, _c.g, _c.b);
    u.uVignette.value = g.vignette;
    u.uMix.value = blend.current;
    res.bloom.enabled = quality !== 'low' && g.bloom > 0.005;
    res.bloom.strength = g.bloom * blend.current;
    res.composer.render(dt);
  }, 1);

  return null;
}

/** The low tier: the same grade as a CSS filter on the canvas (no extra pass). */
function CssGrade() {
  const last = useRef('');
  useFrame(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.experience-canvas canvas');
    if (!canvas) return;
    const g = look.grade;
    const f = `saturate(${g.saturation.toFixed(2)}) contrast(${g.contrast.toFixed(2)})`;
    if (f !== last.current) {
      canvas.style.filter = f;
      last.current = f;
    }
  });
  useEffect(
    () => () => {
      const canvas = document.querySelector<HTMLCanvasElement>('.experience-canvas canvas');
      if (canvas) canvas.style.filter = '';
    },
    [],
  );
  return null;
}

export function IntroPost() {
  const quality = useExperience((s) => s.quality);
  return quality === 'low' ? <CssGrade /> : <Composer />;
}
