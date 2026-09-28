/**
 * The light the name's metal reflects (world/AcmStone.tsx): a studio painted
 * once on a canvas and prefiltered for image-based reflections — so the metal
 * reads as metal in a pre-dawn world that has almost no light of its own.
 */
import { CanvasTexture, EquirectangularReflectionMapping, PMREMGenerator, SRGBColorSpace, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/**
 * A studio of light for the chrome, painted once and prefiltered for
 * reflections — neutral, like polished silver under a softbox sky: bright
 * sky, dark streaks across it (what makes metal read as metal), a hard dark
 * horizon, grey ground. No colour in it: the red is the metal's own, on the
 * letters' extruded sides.
 */
/**
 * One studio per renderer, made once and kept: the stone and ACM-CEG share it,
 * and it is never rebuilt as the opening streams out and back in (a render
 * target made in a component's factory each time it mounts is exactly what
 * builds up over a looping journey).
 */
const studios = new WeakMap<WebGLRenderer, WebGLRenderTarget>();
export function chromeStudio(gl: WebGLRenderer) {
  let s = studios.get(gl);
  if (!s) {
    s = paintStudio(gl);
    studios.set(gl, s);
  }
  return s;
}

function paintStudio(gl: WebGLRenderer) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#c4c9cf');
  g.addColorStop(0.14, '#e6e9ed');
  g.addColorStop(0.32, '#ffffff');
  g.addColorStop(0.45, '#eef0f3');
  g.addColorStop(0.48, '#1b1d21');
  g.addColorStop(0.505, '#2c2e33');
  g.addColorStop(0.56, '#8d9096');
  g.addColorStop(0.7, '#3a3c40');
  g.addColorStop(1, '#0c0c0e');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 512);
  // Dark, liquid streaks through the sky and the ground.
  x.filter = 'blur(9px)';
  x.strokeStyle = '#1a1c20';
  x.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    const u = ((k * 0.61803) % 1) * 1024;
    const v = (0.12 + ((k * 0.37) % 0.3)) * 512;
    x.lineWidth = 10 + ((k * 7) % 22);
    x.beginPath();
    x.moveTo(u, v);
    x.bezierCurveTo(u + 60, v + 40, u + 120, v - 50, u + 190, v + 30 + ((k * 13) % 40));
    x.stroke();
  }
  for (let k = 0; k < 8; k++) {
    const u = ((k * 0.41 + 0.2) % 1) * 1024;
    x.lineWidth = 14 + ((k * 5) % 16);
    x.beginPath();
    x.moveTo(u, 300);
    x.bezierCurveTo(u + 50, 330, u + 90, 290, u + 160, 340);
    x.stroke();
  }
  // Hard white strips high and low: the sharp highlights.
  x.filter = 'blur(2px)';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0.4 * 512, 1024, 0.012 * 512);
  for (let k = 0; k < 5; k++) x.fillRect(((k * 0.2 + 0.05) % 1) * 1024, 0.22 * 512, 36, 0.14 * 512);
  const tex = new CanvasTexture(c);
  tex.mapping = EquirectangularReflectionMapping;
  tex.colorSpace = SRGBColorSpace;
  const pm = new PMREMGenerator(gl);
  const target = pm.fromEquirectangular(tex);
  pm.dispose();
  tex.dispose();
  return target;
}
