// Production profile, not a benchmark that lowers quality. Test-only instrumentation covers ALL
// WebGL passes (renderer.info resets per pass), CDP main-thread counters and optional GPU queries.
// node scripts/qa/performance.mjs URL OUT [desktop|phone|both]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const [, , base = 'http://localhost:3303', out = '/tmp/acm-performance', mode = 'both'] = process.argv;
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const reports = [];
try {
  for (const device of mode === 'both' ? ['desktop', 'phone'] : [mode]) {
    const p = await browser.newPage();
    const phone = device === 'phone';
    await p.setViewport({ width: phone ? 390 : 1440, height: phone ? 844 : 900, deviceScaleFactor: phone ? 3 : 1, isMobile: phone, hasTouch: phone });
    await p.evaluateOnNewDocument(() => {
      window.perfDraw = { calls: 0, triangles: 0, uploads: 0, bufferUploads: 0, ctx: null };
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        const ctx = original.call(this, type, ...args);
        if (!ctx || type !== 'webgl2' || ctx.profiled) return ctx;
        ctx.profiled = true; window.perfDraw.ctx = ctx;
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
          const fn = ctx[name];
          ctx[name] = function (...a) {
            window.perfDraw.calls++;
            const count = a[name.includes('Elements') ? 1 : 2];
            const instances = name.endsWith('Instanced') ? a.at(-1) : 1;
            if (a[0] === ctx.TRIANGLES) window.perfDraw.triangles += count / 3 * instances;
            return fn.apply(this, a);
          };
        }
        for (const name of ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D']) {
          const fn = ctx[name];
          ctx[name] = function (...a) { window.perfDraw.uploads++; return fn.apply(this, a); };
        }
        for (const name of ['bufferData', 'bufferSubData']) {
          const fn = ctx[name];
          ctx[name] = function (...a) { window.perfDraw.bufferUploads++; return fn.apply(this, a); };
        }
        return ctx;
      };
    });
    const errors = [], warnings = [], failedRequests = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warn') warnings.push(m.text()); });
    p.on('requestfailed', (r) => failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
    const start = performance.now();
    await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
    const readyMs = performance.now() - start;
    await p.click('[aria-label="Enter silently"]'); await wait(1200);
    const cdp = await p.createCDPSession(); await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const phases = [
      ['gas', 'intro', -18], ['paper', 'intro', 20], ['building', 'intro', 105], ['ascent', 'intro', 132],
      ['wordmark', 'intro', 151], ['doorway', 'intro', 197.5], ['matrix', 'hub', 0],
      ['patternx', 'room', 4], ['prodigy', 'room', 6], ['codher', 'room', 8], ['editorial', 'editorial', 6],
      ['crew-entrance', 'crew', -0.6], ['crew-core', 'crew', 0], ['crew-web', 'crew', 1], ['crew-marketing', 'crew', 6],
    ];
    const samples = [];
    for (const [name, part, at] of phases) {
      await p.evaluate(({ part, at }) => {
        const a = window.__acm;
        if (part === 'intro') a.intro.at(at);
        else if (part === 'hub') a.jump(a.events.hubRest);
        else if (part === 'room' || part === 'editorial') {
          a.events.room(at, 1); a.jump(a.events.at(part === 'room' ? 'room' : 'read', part === 'room' ? 1 : 0.1));
        } else a.teams.at(at);
      }, { part, at });
      await wait(1800);
      const before = await metrics();
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
      const frameData = await p.evaluate(() => new Promise((resolve) => {
        const d = window.perfDraw;
        // Test-side access to the existing R3F root, not a second renderer or app profiling hook.
        let renderer;
        window.__acm.scene.traverse((o) => { renderer ??= o.__r3f?.root?.getState().gl; });
        const gl = renderer?.getContext();
        const ext = gl?.getExtension('EXT_disjoint_timer_query_webgl2');
        const pending = [], frames = [], gpuFrames = new Map();
        let frameId = 0;
        const render = renderer?.render;
        if (ext) renderer.render = function (...args) {
          const query = gl.createQuery(), id = frameId;
          const sample = gpuFrames.get(id) ?? { ms: 0, pending: 0 };
          sample.pending++; gpuFrames.set(id, sample);
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
          try { return render.apply(this, args); }
          finally { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ query, id }); }
        };
        // Query only submitted rendering commands, not idle time between RAF callbacks.
        let last = performance.now(), start = last, previousCalls = d.calls, previousTri = d.triangles, previousUploads = d.uploads, previousBuffers = d.bufferUploads;
        const tick = (t) => {
          if (ext) {
            for (let i = pending.length - 1; i >= 0; i--) if (gl.getQueryParameter(pending[i].query, gl.QUERY_RESULT_AVAILABLE)) {
              const { query, id } = pending[i], sample = gpuFrames.get(id);
              sample.pending--;
              sample.ms += gl.getParameter(ext.GPU_DISJOINT_EXT) ? NaN : gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
              gl.deleteQuery(query); pending.splice(i, 1);
            }
          }
          frames.push({ ms: t - last, calls: d.calls - previousCalls, triangles: d.triangles - previousTri, uploads: d.uploads - previousUploads, bufferUploads: d.bufferUploads - previousBuffers });
          last = t; previousCalls = d.calls; previousTri = d.triangles; previousUploads = d.uploads; previousBuffers = d.bufferUploads;
          if (t - start >= 2200) {
            if (ext) renderer.render = render;
            for (const { query } of pending) gl.deleteQuery(query);
            const gpu = [...gpuFrames.entries()].filter(([id, s]) => id > 1 && s.pending === 0 && Number.isFinite(s.ms)).map(([, s]) => s.ms);
            resolve({ frames: frames.slice(2), gpu, gpuQuerySupported: !!ext }); return;
          }
          frameId++;
          requestAnimationFrame(tick);
        }; requestAnimationFrame(tick);
      }));
      const { profile } = await cdp.send('Profiler.stop');
      const after = await metrics();
      const state = await p.evaluate(() => {
        const a = window.__acm, scene = a.scene, geos = new Set(), mats = new Set(), tex = new Set();
        let objects = 0, meshes = 0, visibleMeshes = 0, transparent = 0, lights = 0, shadows = 0, rtTextures = 0, geometryBytes = 0, textureBytes = 0;
        scene.traverse((o) => {
          objects++; if (o.isLight && o.intensity > 0) lights++; if (o.castShadow) shadows++;
          if (o.geometry) { meshes++; geos.add(o.geometry); let shown = true; for (let q = o; q; q = q.parent) shown &&= q.visible; if (shown) visibleMeshes++; }
          for (const m of [].concat(o.material ?? [])) {
            mats.add(m); if (m.transparent) transparent++;
            for (const v of [...Object.values(m), ...Object.values(m.uniforms ?? {}).map((u) => u?.value)]) if (v?.isTexture) tex.add(v);
          }
        });
        for (const g of geos) { for (const attr of Object.values(g.attributes)) geometryBytes += attr.array?.byteLength ?? 0; geometryBytes += g.index?.array?.byteLength ?? 0; }
        for (const t of tex) { if (t.isRenderTargetTexture) rtTextures++; const image = t.image; textureBytes += (image?.width ?? 0) * (image?.height ?? 0) * 4 * (t.generateMipmaps ? 4 / 3 : 1); }
        const canvas = document.querySelector('.experience-canvas canvas');
        return { objects, meshes, visibleMeshes, geometries: geos.size, materials: mats.size, textures: tex.size, rtTextures, geometryBytes, estimatedRgbaTextureBytes: textureBytes,
          gpuResources: a.memory(), transparent, activeLights: lights, shadowCasters: shadows, canvas: [canvas?.width, canvas?.height], quality: a.store.getState().quality, degrade: a.store.getState().degrade,
          heap: performance.memory?.usedJSHeapSize, dom: document.getElementsByTagName('*').length, intro: a.intro.snapshot(), crew: a.teams.snapshot(), events: a.events.snapshot() };
      });
      const ms = frameData.frames.map((f) => f.ms).sort((a,b)=>a-b), q = (x) => ms[Math.floor((ms.length-1)*x)];
      const sum = (k) => frameData.frames.reduce((s,f)=>s+f[k],0), mean = (k) => sum(k)/frameData.frames.length;
      const duration = after.Timestamp - before.Timestamp;
      const counters = Object.fromEntries(['ScriptDuration','TaskDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map((k)=>[k,after[k]-before[k]]));
      const report = { name, state, frame: { n: ms.length, median: q(.5), p95: q(.95), max: ms.at(-1), over33: ms.filter(x=>x>33.4).length, over50: ms.filter(x=>x>50).length, meanCalls: mean('calls'), meanTriangles: mean('triangles'), uploads: sum('uploads'), bufferUploads: sum('bufferUploads') }, gpuMs: frameData.gpu, gpuQuerySupported: frameData.gpuQuerySupported, duration, counters };
      samples.push(report); writeFileSync(`${out}/${device}-${name}-cpu.json`, JSON.stringify(profile));
      await p.screenshot({ path: `${out}/${device}-${name}.png` });
      console.log(device, name, JSON.stringify({ frame: report.frame, cpuMs: counters.TaskDuration*1000, resources: state.gpuResources, quality: state.quality, degrade: state.degrade }));
    }
    const loading = await p.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.(js|woff2|mp3|json)/.test(r.name)).map(({ name, transferSize, encodedBodySize, decodedBodySize, duration }) => ({ name, transferSize, encodedBodySize, decodedBodySize, duration })));
    reports.push({ device, readyMs, samples, loading, errors, warnings, failedRequests });
    await p.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/results.json`, JSON.stringify(reports, null, 2)); }
