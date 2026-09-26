import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const [, , url, out] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 180000 });
const res = await page.evaluate(() => {
  const m = window.__acm.scene.getObjectByName('parchment-began');
  const c = m.userData.sheet;
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let gmax = 0, gsum = 0, amin = 255, amax = 0;
  for (let k = 0; k < d.length; k += 4) { gmax = Math.max(gmax, d[k + 1]); gsum += d[k + 1]; amin = Math.min(amin, d[k + 3]); amax = Math.max(amax, d[k + 3]); }
  // Render the G channel as an image for a look.
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const ox = o.getContext('2d'); const img = ox.createImageData(c.width, c.height);
  for (let k = 0; k < d.length; k += 4) { img.data[k] = d[k + 1]; img.data[k + 1] = d[k]; img.data[k + 2] = d[k + 2]; img.data[k + 3] = 255; }
  ox.putImageData(img, 0, 0);
  return { w: c.width, h: c.height, gmax, gmean: gsum / (d.length / 4), amin, amax, png: o.toDataURL('image/png') };
});
writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
delete res.png;
console.log(JSON.stringify(res));
await browser.close();
