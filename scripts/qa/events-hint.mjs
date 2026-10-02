// Door-entry presentation: physical threshold, per-entrance lifetime, input pass-through and returns.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3350', out = '/tmp/acm-events-door-hint', mode = 'all'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const passed = [], errors = [], observations = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms)); // QA only, never application progress.
const visible = page => page.waitForFunction(() => document.querySelector('.evx-room-hint').dataset.on === 'true', { timeout:10000 });
const hidden = page => page.waitForFunction(() => document.querySelector('.evx-room-hint').dataset.on === 'false', { timeout:10000 });
const count = page => page.evaluate(() => window.hintStarts.length);
const jump = (page, part, t) => page.evaluate(({ part, t }) => {
  const a = window.__acm; a.jump(a.events.at(part, t), 0, { fade:false });
}, { part, t });
const beforeDoor = async (page, beat = 195) => {
  await page.evaluate(beat => { const a=window.__acm; a.jump(a.intro.progressAt(beat), 0, { fade:false }); }, beat);
  await page.waitForFunction(() => window.__acm.fx.fade < .01);
  await wait(350);
  await page.waitForFunction(() => window.__acm.fx.fade < .01);
  await hidden(page);
};
const scrollToBeat = (page, beat) => page.evaluate(beat => {
  const a=window.__acm; a.scroll(a.intro.progressAt(beat), .25);
}, beat);
async function quietAtWall(page, expected) {
  await page.waitForFunction(() => {
    const a=window.__acm, s=a.events.snapshot(), pixel=1/Math.max(1,document.documentElement.scrollHeight-innerHeight);
    return !s.visiting && s.view.hub>.99 && !a.progress.pending && a.fx.fade<.01
      && (a.store.getState().reducedMotion || Math.abs(a.progress.target-a.progress.value)<2*pixel);
  }, { timeout:15000 });
  await wait(250); await hidden(page);
  assert.equal(await count(page), expected, 'Wall/room/rejoin does not start another instruction');
}
const bay = (page,i) => page.$eval('.evx-bays', (e,i) => {
  const b=e.querySelectorAll('button')[i],r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
  return { x,y,hit:document.elementFromPoint(x,y)===b };
}, i);

try {
  for(const [w,h,touch,reduced] of [[1920,1080,false,false],[1280,800,false,false],[768,1024,true,false],[390,844,true,false],[844,390,true,false],[1280,800,false,true]]) {
    if(mode==='reduced'&&!reduced || mode==='desktop'&&(touch||reduced)) continue;
    const page=await browser.newPage(),name=`${w}x${h}${reduced?'-reduced':''}`;
    await page.setViewport({width:w,height:h,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
    if(reduced) await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    page.on('pageerror', e=>errors.push(`${name}: ${e.message}`));
    page.on('console', m=>{ if(m.type()==='error') errors.push(`${name}: ${m.text()}`); });
    await page.goto(`${base}/?debug`,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.loader[data-state="ready"]',{timeout:240000});
    assert.equal(await page.$eval('.evx-room-hint',e=>e.dataset.on),'false','No hint during loading');
    await page.click('[aria-label="Enter silently"]');
    await page.waitForFunction(()=>window.__acm.store.getState().phase==='cinematic');
    await page.evaluate(()=>{
      window.hintStarts=[]; window.hintEnds=[];
      window.hintObserver=new MutationObserver(list=>{
        for(const m of list) {
          const a=window.__acm;
          if(m.target.dataset.on==='true') window.hintStarts.push({at:performance.now(),camera:a.teams.camera(),p:a.progress.value,target:a.progress.target,hub:a.events.snapshot().view.hub});
          else window.hintEnds.push(performance.now());
        }
      });
      window.hintObserver.observe(document.querySelector('.evx-room-hint'),{attributes:true,attributeFilter:['data-on']});
    });
    await beforeDoor(page,189.5); assert.equal(await count(page),0,'Door opening alone does not trigger');
    await beforeDoor(page,195); assert.equal(await count(page),0,'Open door, outside camera: no hint');
    if(!reduced) {
      await page.mouse.wheel({deltaY:-24}); await wait(250);
      await page.mouse.wheel({deltaY:24}); await wait(250);
      assert.equal(await count(page),0,'Reversing outside the threshold does not start an instruction');
    }
    // Actual wheel input, not a cut to the wall: slow entrance through the physical doorway.
    for(let n=0;n<120 && await count(page)===0;n++) {
      await page.mouse.wheel({deltaY:reduced?40:24}); await wait(45);
    }
    await visible(page);
    const first=await page.evaluate(()=>window.hintStarts[0]);
    observations.push({name,first});
    assert.ok(first.camera.z<=26.001,'Camera cleared the door plane (27.2) and interior face (26.8)');
    if(!reduced) {
      assert.ok(first.camera.z>25.65,'Slow input starts at the physical entry threshold, not a later wall state');
      assert.ok(first.p<await page.evaluate(()=>window.__acm.events.track.arrival.start),'Hint starts inside doorway, before hall-to-wall travel');
    }
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.evx-room-hint p')).opacity)>.98);
    const style=await page.$eval('.evx-room-hint',e=>{
      const p=e.querySelector('p'),s=getComputedStyle(p),veil=getComputedStyle(e,'::before'),r=p.getBoundingClientRect();
      return {text:p.textContent,font:s.fontFamily,siteFont:getComputedStyle(document.body).fontFamily,
        weight:s.fontWeight,size:parseFloat(s.fontSize),tint:veil.backgroundColor,pointer:getComputedStyle(e).pointerEvents,
        overflow:p.scrollWidth>p.clientWidth+1,bounds:[r.left,r.top,r.right,r.bottom],duration:veil.animationDuration,motion:veil.animationTimingFunction};
    });
    assert.equal(style.text,touch?'Tap a room to explore more':'Hover over the rooms to explore more');
    assert.equal(style.font,style.siteFont); assert.equal(style.weight,'600'); assert.ok(style.size>=22&&style.size<=40);
    assert.equal(style.tint,'rgba(0, 0, 0, 0.48)'); assert.equal(style.pointer,'none'); assert.equal(style.overflow,false);
    assert.ok(style.bounds[0]>=0&&style.bounds[1]>=0&&style.bounds[2]<=w+1&&style.bounds[3]<=h+1);
    assert.equal(style.duration,reduced?'2s':'3s'); if(reduced) assert.equal(style.motion,'steps(1)');
    assert.equal((await bay(page,4)).hit,true,'The active veil passes input through to the actual room aperture');
    await page.screenshot({path:`${out}/${name}-door-hint.png`});
    const stopped=await page.evaluate(()=>window.__acm.progress.target);
    await wait(850);
    assert.equal(await page.$eval('.evx-room-hint',e=>e.dataset.on),'true','Reading time remains available after scroll stops');
    const settling=await page.evaluate(stopped=>Math.abs(window.__acm.progress.target-stopped)*(document.documentElement.scrollHeight-innerHeight),stopped);
    // The last real 24px wheel gesture may still be settling; the veil must not add travel.
    assert.ok(settling<=24,`No added navigation beyond the last input's tail: ${settling}px`);
    await hidden(page);
    const elapsed=await page.evaluate(()=>window.hintEnds[0]-window.hintStarts[0].at);
    assert.ok(elapsed>=(reduced?1850:2800)&&elapsed<(reduced?2600:3700),`Natural CSS lifetime: ${elapsed}ms`);
    assert.equal(await page.$eval('.evx-room-hint',e=>e.getAttribute('aria-hidden')),'true');
    const held=await page.evaluate(()=>window.__acm.progress.target);
    await wait(350);
    assert.equal(await page.evaluate(()=>window.__acm.progress.target),held,'Retirement never advances navigation');
    // Crossing the threshold backwards and forwards without leaving Events does not replay it.
    if(!reduced) {
      await scrollToBeat(page,196); await wait(650); await hidden(page);
      await scrollToBeat(page,200.5); await wait(650); await hidden(page);
      assert.equal(await count(page),1,'Threshold oscillation is not a new entrance');
    }
    await jump(page,'hub',.3); await quietAtWall(page,1);
    const hit=await bay(page,4); assert.equal(hit.hit,true,'Non-blocking veil preserves real aperture hit testing');
    if(touch) await page.touchscreen.tap(hit.x,hit.y);
    else { await page.mouse.move(hit.x,hit.y); await page.waitForFunction(()=>window.__acm.events.snapshot().hover===4); await page.evaluate(()=>document.querySelectorAll('.evx-bay')[4].focus({preventScroll:true})); await page.keyboard.press('Enter'); }
    await page.waitForFunction(()=>window.__acm.events.snapshot().view.room>.99,{timeout:15000});
    assert.equal(await page.evaluate(()=>window.__acm.events.snapshot().selected),4);
    await hidden(page);
    await jump(page,'read',.02); await wait(400); await hidden(page);
    await page.keyboard.press('Escape'); await quietAtWall(page,1);
    await page.evaluate(()=>{const a=window.__acm;a.jump(a.segments.portal.start+.001,0,{fade:false});});
    await page.waitForFunction(()=>window.__acm.events.snapshot().view.split>0); await hidden(page);
    await jump(page,reduced?'hub':'rejoin',reduced ? .3 : .7); await quietAtWall(page,1);
    if(w===768) {
      await page.setViewport({width:1024,height:768,hasTouch:true,isMobile:true,deviceScaleFactor:1}); await wait(400); await hidden(page);
      assert.equal(await count(page),1,'Orientation does not replay hint');
      await page.setViewport({width:w,height:h,hasTouch:true,isMobile:true,deviceScaleFactor:1}); await wait(400);
    }
    // Fully leave, return OUTSIDE the door, then enter quickly. Same physical trigger, new entrance.
    await beforeDoor(page,188); await beforeDoor(page,195);
    const dy=await page.evaluate(reduced=>{
      const a=window.__acm;
      // Reduced motion uses existing authored stills: reach the first still inside the doorway.
      const goal=reduced?a.events.hubRest:a.intro.progressAt(200.5);
      return (goal-a.progress.target)*(document.documentElement.scrollHeight-innerHeight)/(reduced?1:.85);
    },reduced);
    await page.mouse.wheel({deltaY:dy}); await visible(page);
    assert.equal(await count(page),2,'Second door entrance shows hint again');
    const second=await page.evaluate(()=>window.hintStarts[1]);
    assert.ok(second.camera.z<=26.001,'Fast entrance is still physically inside, never at door opening');
    await hidden(page);
    await jump(page,'hub',.3); await quietAtWall(page,2);
    // A chapter jump directly into the wall must not impersonate a physical entrance.
    await page.keyboard.press('m'); await page.waitForSelector('.index-chapters');
    await page.click('.index-chapters li:nth-child(1) button');
    await page.waitForFunction(()=>window.__acm.store.getState().chapter==='arrival'&&window.__acm.fx.fade<.01,{timeout:15000});
    await page.keyboard.press('m'); await page.waitForSelector('.index-chapters');
    await page.click('.index-chapters li:nth-child(6) button'); await quietAtWall(page,2);
    if(w===1280&&!reduced) {
      // Selecting a room immediately after crossing the door, before the veil's threshold,
      // already demonstrates exploration. Its return must not resurrect the pending instruction.
      await beforeDoor(page,188); await beforeDoor(page,195);
      await scrollToBeat(page,197.05); await wait(650);
      assert.equal(await count(page),2);
      const early=await bay(page,4); assert.equal(early.hit,true);
      await page.mouse.click(early.x,early.y);
      await page.waitForFunction(()=>window.__acm.events.snapshot().view.room>.99,{timeout:15000});
      await hidden(page); assert.equal(await count(page),2,'No instruction inside a room');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!window.__acm.events.snapshot().visiting,{timeout:15000});
      await scrollToBeat(page,200.5); await wait(650); await hidden(page);
      assert.equal(await count(page),2,'Early room return consumes the pending entrance instruction');
    }
    await page.evaluate(()=>window.hintObserver.disconnect());
    observations.push({name,first,second,style,elapsed});
    passed.push(`${name}: physical slow/fast entry, two entrances, stable presentation, no wall/room/reverse/portal/navigation replay, pointer/touch/keyboard${w===768?', orientation':''}`);
    await page.close();
  }
  assert.deepEqual(errors,[],'No runtime/console errors');
} finally {
  await browser.close(); writeFileSync(`${out}/results.json`,JSON.stringify({passed,errors,observations},null,2));
}
console.log(passed.join('\n'));
