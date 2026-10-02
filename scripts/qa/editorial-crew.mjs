// Complete printed edition: content preservation, native scrolling and the linked people wall.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3350', out = '/tmp/acm-editorial-crew-qa'] = process.argv;
mkdirSync(out, { recursive: true });
const mapping = JSON.parse(readFileSync('src/content/generated/crew-portraits.json', 'utf8')).members;
assert.equal(Object.keys(mapping).length, 15);
assert.equal(readdirSync('acm photos').filter(f => /\.png$/i.test(f)).length, 15);
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
for (const [name, photo] of Object.entries(mapping)) {
  assert.equal(hash(`acm photos/${photo.source.file}`), photo.source.sha256, `${name}: verified identity`);
  assert.equal(hash(`public/media/crew/originals/${photo.source.file}`), photo.source.sha256, `${name}: unchanged original`);
  const response = await fetch(`${base}/media/crew/originals/${encodeURIComponent(photo.source.file)}${photo.revision ? `?v=${photo.revision}` : ''}`);
  assert.equal(response.status, 200, `${name}: original served`);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), photo.source.sha256, `${name}: served bytes match root photograph`);
}
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], passed = [], observations = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const active = p => p.$eval('.crew-people', e => [...e.querySelectorAll('[data-active="true"]')].map(e => e.dataset.person));
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  // Optional comparison against a previous build: content and type metrics survive refinements.
  let previous;
  const chapterSnapshot = () => {
    const root=document.querySelector('.chapter-publication');
    const typeSelectors=['.chapter-title','#about-h','.publication-intro > p','.chapter-event h3','.faculty-row h3','.crew-people-heading h2','.crew-index button','.chapter-reading summary'];
    return {
      sections:Object.fromEntries([...root.querySelectorAll('.chapter-body > .chapter-section')].map(section=>{
        const copy=section.cloneNode(true);
        copy.querySelector('.chapter-section-head > .publication-label')?.remove();
        return [section.id,copy.textContent.replace(/\s+/g,' ').trim()];
      })),
      typography:typeSelectors.map(selector=>{
        const style=getComputedStyle(root.querySelector(selector));
        return {selector,font:style.fontFamily,weight:style.fontWeight,size:style.fontSize,line:style.lineHeight,tracking:style.letterSpacing,margin:style.margin,padding:style.padding};
      }),
    };
  };
  if (process.env.BASELINE) {
    await page.goto(`${process.env.BASELINE}/archive`, {waitUntil:'networkidle0'});
    if(await page.$('.archive')) previous = await page.$eval('.archive', e => ({
      copy: [...e.querySelectorAll('.archive-section p, dd, .programme span, details summary, .faculty strong')].map(e => e.textContent.trim()).filter(Boolean),
      links: [...e.querySelectorAll('a')].map(a => a.getAttribute('href')),
    }));
  }
  for (const [w,h] of [[1920,1080],[1440,900],[1024,768],[768,1024],[390,844],[320,568],[844,390]]) {
    const touch = w < 900;
    await page.setViewport({width:w,height:h,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
    let beforeEdition;
    if(process.env.BASELINE) {
      await page.goto(`${process.env.BASELINE}/archive`, {waitUntil:'networkidle0'});
      await page.evaluate(()=>document.fonts.ready);
      if(await page.$('.chapter-publication')) beforeEdition=await page.evaluate(chapterSnapshot);
    }
    await page.goto(`${base}/archive`, {waitUntil:'networkidle0'});
    await page.evaluate(() => document.fonts.ready);
    // Inspect every section, not only the photographs at the end.
    for (const id of ['about','programmes','gallery','team','alumni','newsletter','faq','contact']) {
      await page.$eval('#'+id, e => e.scrollIntoView());
      await wait(100);
      const layout = await page.$eval('#'+id, e => ({
        id:e.id, background:getComputedStyle(e.closest('.publication')).backgroundColor,
        overflow:[...e.querySelectorAll('h2,h3,h4,p,a,dd')].filter(x => x.scrollWidth > x.clientWidth+2 && x.clientWidth > 0).map(x => x.textContent),
      }));
      assert.deepEqual(layout.overflow, [], `${w}: ${id} text fits`);
      if ([1440,390,844].includes(w)) await page.screenshot({path:`${out}/${w}x${h}-${id}.png`});
    }
    for (const img of await page.$$('.chapter-publication img')) {
      // Scroll the physical cell, not the 1.8x transformed print that extends outside it.
      const cell = await img.evaluateHandle(i => i.closest('.crew-photo-wall button') ?? i);
      await cell.asElement().scrollIntoView();
      await cell.dispose();
      try {
        await page.waitForFunction(i => i.complete && i.naturalWidth > 0, {timeout:30000}, img);
      } catch (error) {
        console.error('Image did not become visible/loaded', await img.evaluate(i => ({alt:i.alt,src:i.currentSrc,rect:i.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight],scroll:scrollY,loaded:i.complete,width:i.naturalWidth})));
        throw error;
      }
    }
    const document = await page.$eval('.chapter-publication', e => ({
      text:e.textContent.replace(/\s+/g,' ').trim(), links:[...e.querySelectorAll('a')].map(a=>a.getAttribute('href')),
      gallery:[...e.querySelectorAll('.chapter-gallery img')].map(i=>new URL(i.currentSrc).searchParams.get('url')),
      programmes:e.querySelectorAll('.chapter-event').length,
      faculty:[...e.querySelectorAll('.chapter-faculty h3')].map(e=>e.textContent),
      faq:e.querySelectorAll('details').length, old:e.querySelectorAll('.archive-section,.archive-mast,.crew-publication').length,
      overflow:window.document.documentElement.scrollWidth > innerWidth,
      order:[...e.querySelectorAll('.chapter-body > .chapter-section')].map(s=>s.id),
      navigation:[...e.querySelectorAll('.editorial-index a')].map(a=>({id:a.hash.slice(1),number:a.firstElementChild.textContent})),
      backgrounds:[...window.document.querySelectorAll('.chapter-edition,.chapter-edition > .archive-back,.chapter-publication,.chapter-mast,.chapter-section')].map(x=>getComputedStyle(x).backgroundColor),
      titleColor:getComputedStyle(e.querySelector('.chapter-title')).color,
      bodyColor:getComputedStyle(e).color,
    }));
    assert.equal(document.old,0,'No old structure pasted into the new publication');
    assert.equal(document.programmes,9); assert.equal(document.faq,11);
    assert.deepEqual(document.gallery, [1,2,3,4,5,6,7,8,10,11,12,13,14,15,16].map(n=>`/media/explore/gallery/${n}.jpg`));
    assert.deepEqual(document.faculty,['Dr. Ranjani Parthasarathi','Dr. Bama Srinivasan','Dr. R Arockia Xavier Annie']);
    assert.equal(document.overflow,false);
    const order=['about','programmes','gallery','team','alumni','newsletter','faq','contact'];
    assert.deepEqual(document.order,order,'Faculty and Crew precede Alumni / office bearers');
    assert.deepEqual(document.navigation,order.map((id,i)=>({id,number:String(i+1).padStart(2,'0')})),'Index numbering matches document order');
    assert.ok(document.backgrounds.every(color=>['rgb(8, 8, 8)','rgba(0, 0, 0, 0)'].includes(color)),'One near-black publication background');
    assert.equal(document.titleColor,document.bodyColor,'Masthead and editorial share warm typography color');
    if(beforeEdition) assert.deepEqual(await page.evaluate(chapterSnapshot),beforeEdition,'Existing section copy, typography and spacing unchanged');
    if (previous) {
      for (const copy of previous.copy) assert.ok(document.text.includes(copy.replace(/\s+/g,' ')), `Existing content retained: ${copy}`);
      for (const href of previous.links) assert.ok(document.links.includes(href), `Existing destination retained: ${href}`);
    }
    const data = await page.$eval('.crew-people', e => ({
      names:[...e.querySelectorAll('.crew-index button')].map(b=>b.firstElementChild.textContent),
      photos:[...e.querySelectorAll('.crew-photo-wall img')].map(i=>({alt:i.alt,src:new URL(i.currentSrc).searchParams.get('url')})),
      titles:[...e.querySelectorAll('.crew-index h3')].map(h=>h.textContent),
      anchors:[...e.querySelectorAll('.crew-index section')].map(e=>e.id),
      columns:getComputedStyle(e.querySelector('.crew-photo-wall')).gridTemplateColumns.split(' ').length,
      text:e.textContent, links:e.querySelectorAll('a').length,
    }));
    assert.equal(data.photos.length,15); assert.equal(data.names.length,15);
    assert.equal(new Set(data.photos.map(p=>p.src)).size,15); assert.deepEqual(data.photos.map(p=>p.alt),data.names);
    assert.equal(data.columns,w<=360?1:w<=640||(touch&&w<=1000&&h<=500)?2:w<=1000?3:4,'Four desktop columns, three tablet, one/two phone');
    assert.equal(data.links,0); assert.equal(/2023\d{6}/.test(data.text),false);
    for(const photo of data.photos) {
      const expected=mapping[photo.alt];
      assert.equal(decodeURIComponent(photo.src),`/media/crew/originals/${expected.source.file}${expected.revision ? `?v=${expected.revision}` : ''}`);
    }
    if(w===1440) {
      for(const id of ['renuka-devi-a-c','suhasri-s','swayamprabha-narayanan','janis-miracline-a']) {
        const portrait=await page.$(`.crew-photo-wall [data-person="${id}"]`);
        await portrait.scrollIntoView(); await portrait.focus();
        assert.deepEqual(await active(page),[id,id],'Edited portrait and index remain linked');
        await page.screenshot({path:`${out}/edited-${id}.png`});
      }
    }
    assert.ok(data.titles[0].endsWith('CORE')); assert.ok(data.titles[1].endsWith('WEB AND APP DEVELOPMENT')); assert.ok(data.titles[5].endsWith('HR AND LOGISTICS'));
    assert.equal(new Set(data.anchors).size,7,'Existing domain deep links remain available');
    const name = await page.$('.crew-index [data-person="prithvi"]'); await name.scrollIntoView();
    if(touch) await name.tap(); else await name.hover();
    await wait(250); assert.deepEqual(await active(page),['prithvi','prithvi']);
    const dim = await page.$eval('.crew-photo-wall [data-person="manesh-ram"]',e=>Number(getComputedStyle(e).opacity));
    assert.ok(dim>=.3 && dim<=.5);
    const photo = await page.$('.crew-photo-wall [data-person="prithvi"]'); await photo.scrollIntoView();
    const before=await photo.boundingBox(); if(touch) await photo.tap(); else await photo.hover();
    await wait(250); assert.deepEqual(await active(page),['prithvi','prithvi']); assert.deepEqual(await photo.boundingBox(),before);
    const next = await page.$('.crew-photo-wall [data-person="varshhaa"]'); await next.scrollIntoView(); await next.focus();
    assert.deepEqual(await active(page),['varshhaa','varshhaa']); await page.keyboard.press('Escape'); assert.deepEqual(await active(page),[]);
    await next.tap(); await page.$eval('#team-h',e=>e.scrollIntoView()); await page.click('#team-h'); assert.deepEqual(await active(page),[]);
    await page.$eval('.crew-people-heading',e=>e.scrollIntoView()); await page.screenshot({path:`${out}/${w}x${h}-crew.png`});
    await page.$eval('.chapter-mast',e=>e.scrollIntoView()); await page.screenshot({path:`${out}/${w}x${h}-hero.png`});
    for(const id of order) {
      await page.click(`.editorial-index a[href="#${id}"]`); await wait(100);
      assert.equal(await page.evaluate(()=>location.hash),'#'+id);
      assert.ok(await page.$eval('#'+id,e=>{const r=e.getBoundingClientRect();return r.top<innerHeight && r.bottom>0;}),'Section anchor remains reachable');
    }
    await page.click('.editorial-index a[href="#faq"]'); await wait(100);
    await page.click('details summary'); assert.equal(await page.$eval('details',e=>e.open),true);
    passed.push(`${w}x${h}: all sections fit; 15 gallery + 15 verified portraits; ${data.columns} photo columns; names/photo hover, touch, focus; stable layout; anchors and FAQ`);
    observations.push({w,h,data,document});
  }
  await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
  await page.goto(`${base}/archive`,{waitUntil:'networkidle0'});
  await page.$eval('#programmes',e=>e.scrollIntoView());
  const y0=await page.evaluate(()=>scrollY);
  await page.mouse.wheel({deltaY:240}); await wait(350);
  const y1=await page.evaluate(()=>scrollY); await wait(600);
  assert.equal(await page.evaluate(()=>scrollY),y1,'No autoplay after stopping');
  await page.mouse.wheel({deltaY:-240}); await wait(350);
  assert.equal(await page.evaluate(()=>scrollY),y0,'Native scroll is reversible');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto(`${base}/archive`,{waitUntil:'networkidle0'});
  assert.ok(await page.$eval('.crew-index button',e=>parseFloat(getComputedStyle(e).transitionDuration)<.001),'Reduced motion disables perceptible transitions');
  // Text Version uses its original native scroller; it must not move the 3D journey.
  await page.goto(`${base}/?debug#archive`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__acm && document.documentElement.dataset.archive==='open',{timeout:180000});
  const progress=await page.evaluate(()=>window.__acm.progress.target);
  for(const id of ['about','programmes','gallery','team','alumni','newsletter','faq','contact']) {
    // The index is not sticky: return to it before clicking, so an offscreen
    // anchor cannot be covered by the fixed return control during automation.
    await page.$eval('.chapter-mast',e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    await page.click(`.editorial-index a[href="#${id}"]`);
    await page.waitForFunction(id=>{
      const r=document.getElementById(id).getBoundingClientRect();
      return r.top<innerHeight && r.bottom>0;
    },{timeout:30000},id);
    assert.equal(await page.evaluate(()=>window.__acm.progress.target),progress);
    assert.equal(await page.evaluate(()=>location.hash),'#archive',`Overlay anchor: ${id}`);
  }
  assert.ok(await page.$eval('.archive-layer',e=>e.scrollTop)>0);
  assert.equal(await page.evaluate(()=>window.__acm.progress.target),progress);
  assert.equal(await page.evaluate(()=>location.hash),'#archive');
  await page.click('.archive-close'); await wait(500);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.archive),'closed');
  assert.equal(await page.evaluate(()=>window.__acm.progress.target),progress);
  passed.push('Native scroll stop/reverse, reduced motion, Text Version anchor isolation and return to unchanged journey');
  assert.deepEqual(errors,[],'No browser errors or broken local assets');
} finally {
  await browser.close(); writeFileSync(`${out}/results.json`,JSON.stringify({passed,errors,observations},null,2));
}
console.log(passed.join('\n'));
