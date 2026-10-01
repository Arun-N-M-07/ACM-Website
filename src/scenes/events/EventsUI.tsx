'use client';
/**
 * The Events' interface: the page over the hall (EventsHall), moved by
 * eventsFrame once a frame — nothing here keeps time of its own but a hover's
 * own entrance.
 *
 *   the whole matrix  a hit area over each bay, where the world puts it. The
 *                     pointer on one (or the keyboard's focus) lights it: the
 *                     bay hatched and its corners marked (EventsHall), and the
 *                     way in — "[Visit PatternX]" — with the pointer, kept
 *                     inside that room's opening. A click, Enter,
 *                     or a single tap on a touch screen, goes in
 *                     (controller.visitEvent). At the matrix's foot, the way
 *                     on: "Next, let's meet the Crew".
 *   an event's record after the room threshold, the scroll unfolds it — the
 *                     room going down under it — into an editorial page: its
 *                     number, kind and cadence; its name, large; what it is;
 *                     the record's own words; its facts; how it runs; its
 *                     programme; registration where the record has a real
 *                     link. At its end, the choice — nothing goes on to another
 *                     event unasked: [ Back to full view ] or [ Visit … → ].
 *
 * All of it is real text in the page — read by assistive technology, reached
 * by the keyboard (Esc goes back to the full view) — and nothing is invented:
 * every word is the event's record (content/events.ts) or its dossier
 * (content/dossiers.ts).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { essenceOf } from '@/components/experience/Dossier';
import { DOSSIERS, type DossierFlow } from '@/content/dossiers';
import { EVENTS, type EventRecord } from '@/content/events';
import { experience, useExperience } from '@/store/experience';
import { anchorAt, onProjected, stage, toNdc } from '@/systems/anchors/anchors';
import { cancelScrollMotion } from '@/systems/scroll/ScrollTimeline';
import { backToFullView, canVisitEvent, visitCrew, visitEvent, visitNextEvent } from './controller';
import { eventsFrame, eventsState, useEvents } from './state';

const N = EVENTS.length;
const pad2 = (n: number) => String(n).padStart(2, '0');
const TOTAL = pad2(N);
/** A record's registration links: the ones it calls so (never one it doesn't have). */
const isRegistration = (label: string) => /regist/i.test(label);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The last value written to each element's style or attribute (a write that changes nothing still costs a style pass). */
const written = new WeakMap<Element, Record<string, string>>();
function put(el: HTMLElement, key: string, value: string) {
  let w = written.get(el);
  if (!w) written.set(el, (w = {}));
  if (w[key] === value) return;
  w[key] = value;
  if (key.startsWith('--')) el.style.setProperty(key, value);
  else if (key === 'inert') el.toggleAttribute('inert', value === 'true');
  else if (key.startsWith('data-') || key.startsWith('aria-')) el.setAttribute(key, value);
  else (el.style as unknown as Record<string, string>)[key] = value;
}

// ─── An event's record ───────────────────────────────────────────────────────

/**
 * A flow of the dossier's that only restates the record's facts — a set whose every part is a fact's
 * label or named in a fact (the details say it: it isn't said twice).
 */
const restatesFacts = (flow: DossierFlow, e: EventRecord) =>
  flow.kind === 'set' &&
  flow.steps.every((st) => {
    const t = st.title.toLowerCase();
    return e.facts.some((f) => f.label.toLowerCase() === t || f.value.toLowerCase().includes(t));
  });
/** A flow of the dossier's: its label on the left — and whether it is the exhibition's reading — its steps on the right. */
function Flow({ flow, id }: { flow: DossierFlow; id: string }) {
  const List = flow.kind === 'sequence' ? 'ol' : 'ul';
  return (
    <section className="evx-split" data-reveal aria-labelledby={id}>
      <h3 className="evx-cap evx-side" id={id}>
        {flow.label}
        {flow.reading ? <span className="evx-cap-note">The exhibition’s reading</span> : null}
      </h3>
      <List className={`evx-rows evx-steps evx-steps-${flow.kind}`}>
        {flow.steps.map((st) => (
          <li key={st.title}>
            <span className="evx-step-title">{st.title}</span>
            {st.note ? <span className="evx-step-note">{st.note}</span> : null}
          </li>
        ))}
      </List>
    </section>
  );
}

/**
 * An event's record: a black sheet the scroll moves up over its room, px for px, and on up the screen
 * to its end — one story, told in the order it is understood:
 *
 *   what it is        its small index first, then a dominant name and the record's introduction;
 *                     the wider title column lets long names wrap without shrinking their voice
 *   what kind         its category; then about it, in the record's own words where they say more;
 *                     how it runs; its programme
 *   the details       one later layer, ruled: kind, cadence, the record's facts, its links
 *   the room          the exhibition's reading of it, in a line (and labelled so)
 *   what it joins     the programmes the record connects it to — where the story hasn't said so
 *   the choice        back to the full view, or on to the next event — never taken unasked
 *
 * Every word is the event's record (content/events.ts) or its dossier (content/dossiers.ts).
 */
function Record({ index }: { index: number }) {
  const e: EventRecord = EVENTS[index];
  const d = DOSSIERS[e.slug];
  const { essence, record } = essenceOf(e);
  const told = d?.flows.filter((f) => !f.reading && !restatesFacts(f, e)) ?? [];
  const readings = d?.flows.filter((f) => f.reading) ?? [];
  // (A connection the opening already makes — "a precursor to CodeX" — isn't made again.)
  const joins = (d?.related ?? []).filter((r) => {
    const other = EVENTS.find((x) => x.slug === r.slug);
    return !other || !essence.includes(other.title);
  });
  const register = e.links.filter((l) => isRegistration(l.label));
  const more = e.links.filter((l) => !isRegistration(l.label));
  const next = index + 1 < N ? EVENTS[index + 1] : null;
  const kinds = [e.kind, e.cadence, ...(e.flagship ? ['Flagship'] : [])];
  return (
    <>
      <header className="evx-intro">
        <div className="evx-meta">
          <span className="evx-meta-at">Event {pad2(index + 1)} / {TOTAL}</span>
          <button type="button" className="evx-toplink" onClick={() => backToFullView()}>
            <span aria-hidden="true">←</span> Back to full view
          </button>
        </div>
        <div className="evx-name">
          <h2 className="evx-title" id="evx-title" tabIndex={-1}>
            {e.title}
          </h2>
        </div>
        <div className="evx-opening">
          <p className="evx-lede">{essence}</p>
          {d?.character ? <p className="evx-lede-2">{d.character}</p> : null}
        </div>
      </header>

      <section className="evx-split evx-kind" data-reveal aria-labelledby={`evx-kind-${index}`}>
        <h3 className="evx-cap evx-side" id={`evx-kind-${index}`}>
          Category
        </h3>
        <p className="evx-kindlist">
          {kinds.map((k, j) => (
            <span key={k}>
              {j > 0 ? <span className="evx-dot"> · </span> : null}
              {k}
            </span>
          ))}
        </p>
      </section>

      {record ? (
        <section className="evx-split evx-about" data-reveal aria-labelledby={`evx-about-${index}`}>
          <h3 className="evx-cap evx-side" id={`evx-about-${index}`}>
            About
          </h3>
          <p className="evx-text evx-said">{record}</p>
        </section>
      ) : null}

      {told.map((flow, k) => (
        <Flow key={flow.label} flow={flow} id={`evx-flow-${index}-${k}`} />
      ))}

      {e.programme ? (
        <section className="evx-split" data-reveal aria-labelledby={`evx-prog-${index}`}>
          <h3 className="evx-cap evx-side" id={`evx-prog-${index}`}>
            The programme
          </h3>
          <ul className="evx-rows evx-prog">
            {e.programme.map((p) => (
              <li key={p.title}>
                <span className="evx-step-title">{p.title}</span>
                <span className="evx-step-note">{p.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="evx-split" data-reveal aria-labelledby={`evx-details-${index}`}>
        <h3 className="evx-cap evx-side" id={`evx-details-${index}`}>
          Details
        </h3>
        <div className="evx-details">
          <dl className="evx-rows evx-facts">
            <div>
              <dt>Kind</dt>
              <dd>{e.kind}</dd>
            </div>
            <div>
              <dt>Cadence</dt>
              <dd>{e.cadence}</dd>
            </div>
            {e.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
            {d?.with?.length && !e.facts.some((f) => f.label === 'With') ? (
              <div>
                <dt>With</dt>
                <dd>{d.with.join(' · ')}</dd>
              </div>
            ) : null}
          </dl>
          {register.length > 0 ? (
            <ul className="evx-rows evx-register" aria-label="Registration">
              {register.map((l) => (
                <li key={l.href}>
                  <a className="evx-rowlink" href={l.href} target="_blank" rel="noopener noreferrer">
                    <span>{l.label}</span>
                    <span className="evx-rowlink-go" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {more.length > 0 ? (
            <ul className="evx-rows evx-more" aria-label="Links">
              {more.map((l) => (
                <li key={l.href}>
                  <a className="evx-rowlink" href={l.href} target="_blank" rel="noopener noreferrer">
                    <span>{l.label}</span>
                    <span className="evx-rowlink-go" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {readings.length ? (
        <section className="evx-split evx-room" data-reveal aria-labelledby={`evx-room-${index}`}>
          <h3 className="evx-cap evx-side" id={`evx-room-${index}`}>
            In the room
            <span className="evx-cap-note">The exhibition’s reading</span>
          </h3>
          <div>
            {readings.map((flow) => (
              <ol key={flow.label} className="evx-path" aria-label={flow.label}>
                {flow.steps.map((st, j) => (
                  <li key={st.title}>
                    {j > 0 ? (
                      <span className="evx-path-to" aria-hidden="true">
                        →{' '}
                      </span>
                    ) : null}
                    {st.title}
                  </li>
                ))}
              </ol>
            ))}
          </div>
        </section>
      ) : null}

      {joins.length ? (
        <section className="evx-split" data-reveal aria-labelledby={`evx-related-${index}`}>
          <h3 className="evx-cap evx-side" id={`evx-related-${index}`}>
            Connects to
          </h3>
          <ul className="evx-rows evx-related">
            {joins.map((r) => (
              <li key={r.slug}>
                <span className="evx-step-title">{EVENTS.find((x) => x.slug === r.slug)?.title}</span>
                <span className="evx-related-note">{r.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="evx-decide" aria-label="Where next" data-reveal>
        <p className="evx-cap evx-decide-note">Where next is yours</p>
        <button type="button" className="evx-choice evx-back" onClick={() => backToFullView()}>
          <span className="evx-choice-k">Return</span>
          <span className="evx-choice-t">
            <span className="evx-arrow" aria-hidden="true">
              ←
            </span>{' '}
            Back to full view
          </span>
        </button>
        <button type="button" className="evx-choice evx-next" onClick={() => visitNextEvent()}>
          <span className="evx-choice-k">{next ? `Next event — ${pad2(index + 2)} / ${TOTAL}` : 'Next chapter'}</span>
          <span className="evx-choice-t evx-choice-big">{next ? next.title : 'The Crew'}</span>
          <span className="evx-choice-go">
            {next ? `Visit ${next.title}` : 'Next, let’s meet the Crew'}{' '}
            <span className="evx-arrow" aria-hidden="true">
              →
            </span>
          </span>
        </button>
      </nav>
    </>
  );
}

// ─── The interface ───────────────────────────────────────────────────────────

export function EventsUI() {
  const phase = useExperience((s) => s.phase);
  const reduced = useExperience((s) => s.reducedMotion);
  const touch = useExperience((s) => s.isTouch);
  const selected = useEvents((s) => s.selected);
  const visiting = useEvents((s) => s.visiting);
  const [shown, setShown] = useState(-1);
  const [focusBay, setFocusBay] = useState(-1);
  const [announce, setAnnounce] = useState('');

  const root = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLElement>(null);
  const bays = useRef<(HTMLButtonElement | null)[]>([]);
  const label = useRef<HTMLDivElement>(null);
  const labelSize = useRef({ w: 0, h: 0 });
  const crew = useRef<HTMLDivElement>(null);
  /** Invitation + safe-area padding, measured on layout changes, never in the frame loop. */
  const crewHeight = useRef(0);
  const record = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const shownRef = useRef(-1);
  /** The screen the record is read on (px), and its parts' places in it. */
  const measure = useRef({ parts: [] as { el: HTMLElement; top: number }[], vh: 0 });
  /** Remember the initiating input so keyboard focus returns to its original bay. */
  const pressedWith = useRef<'mouse' | 'touch' | 'pen' | 'key'>('key');
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  /** The bay an event was visited from, and the keyboard's way back to it once the matrix is there again. */
  const openedFrom = useRef(-1);
  const focusBack = useRef(-1);

  // Once a frame, after the camera is placed and the world projected.
  useEffect(
    () =>
      onProjected(() => {
        const el = root.current;
        if (!el) return;
        const F = eventsFrame;
        const v = F.view;
        const ex = experience();
        const overlay = ex.menuOpen || !!ex.dossier || ex.textVersionOpen;
        const on = ex.phase === 'cinematic';
        put(el, '--hub', (on ? v.hub : 0).toFixed(3));
        put(el, '--unfold', (on ? v.unfold : 0).toFixed(4));
        put(el, '--decide', v.decide.toFixed(3));
        put(el, '--covered', smooth(0.9, 1, v.unfold).toFixed(3));
        put(el, 'data-tall', stage.w / Math.max(1, stage.h) < 0.95 ? 'true' : 'false');

        // The whole matrix: its bays' hit areas where the world puts them.
        const h = hub.current;
        if (h) {
          const live = on && !overlay && v.hub > 0.9 && canVisitEvent();
          put(h, 'data-live', live ? 'true' : 'false');
          put(h, 'inert', live ? 'false' : 'true');
          put(h, 'visibility', on && v.hub > 0.01 ? 'visible' : 'hidden');
          if (!live && !overlay && F.hover >= 0) {
            F.hover = -1;
          }
          if (v.hub > 0.01) {
            for (let i = 0; i < N; i++) {
              const b = bays.current[i];
              const a = anchorAt(`events:bay:${i}:a`);
              const c = anchorAt(`events:bay:${i}:b`);
              if (!b || !a || !c) continue;
              put(b, 'transform', `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`);
              put(b, 'width', `${Math.max(0, c.x - a.x).toFixed(1)}px`);
              put(b, 'height', `${Math.max(0, c.y - a.y).toFixed(1)}px`);
            }
          }
          // The label: the lit room's name and its way in, with the pointer — a little below and right of
          // it, and kept inside the room's own opening (never over another's). From the keyboard, at the
          // opening's foot.
          const q = label.current;
          const lit = F.hover;
          if (q) {
            put(q, 'data-on', live && lit >= 0 && !touch ? 'true' : 'false');
            if (lit >= 0) {
              const a = anchorAt(`events:bay:${lit}:a`);
              const c = anchorAt(`events:bay:${lit}:b`);
              if (a && c) {
                const { w, h: lh } = labelSize.current;
                const P = F.pointer;
                const inBay = P.active && P.px >= a.x && P.px <= c.x && P.py >= a.y && P.py <= c.y;
                const x0 = a.x + 12;
                const y0 = a.y + 10;
                const x1 = Math.max(x0, c.x - w - 12);
                const y1 = Math.max(y0, c.y - lh - 10);
                const x = inBay ? Math.min(x1, Math.max(x0, P.px + 16)) : x0;
                const y = inBay ? Math.min(y1, Math.max(y0, P.py + 18)) : y1;
                put(q, 'transform', `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
              }
            }
          }
          // Back from a room: the keyboard to the bay it was visited from, once it can be chosen again.
          if (live && focusBack.current >= 0) {
            bays.current[focusBack.current]?.focus({ preventScroll: true });
            focusBack.current = -1;
          }
          // The way on, at the matrix's foot.
          const cr = crew.current;
          const foot = anchorAt('events:foot');
          if (cr && foot && crewHeight.current > 0) put(cr, 'transform', `translate3d(-50%, ${Math.min(foot.y + 16, stage.h - crewHeight.current).toFixed(1)}px, 0)`);
        }

        // An event's record.
        const i = v.index;
        if (i >= 0 && i !== shownRef.current) {
          shownRef.current = i;
          setShown(i);
        }
        const r = record.current;
        if (r) {
          const present = on && v.unfold > 0.002;
          put(r, 'data-on', present ? 'true' : 'false');
          // (The site's chapter rail steps back while a record has the screen: events.css.)
          put(document.documentElement, 'data-evx-record', present ? 'true' : 'false');
          // (…and is quiet all through the Events: the matrix and its rooms are the page.)
          put(document.documentElement, 'data-evx-quiet', on && (v.hub > 0.01 || v.enter > 0) ? 'true' : 'false');
          put(r, 'inert', present && v.unfold > 0.6 && !overlay ? 'false' : 'true');
          put(r, 'aria-hidden', present ? 'false' : 'true');
        }
        // The scroll moves the record as a page, px for px: its edge up from the foot of the screen over
        // the room, then the record on up the screen to its end — each part coming in as it rises into
        // view. (Reduced motion: all of it at once, and it scrolls itself.)
        const pg = page.current;
        if (pg && r) {
          const m = measure.current;
          if (ex.reducedMotion) {
            put(pg, 'transform', 'none');
            for (const pt of m.parts) put(pt.el, '--in', '1');
          } else {
            const y = m.vh - v.page;
            put(pg, 'transform', `translate3d(0, ${y.toFixed(1)}px, 0)`);
            for (const pt of m.parts) {
              const top = pt.top + y;
              put(pt.el, '--in', smooth(m.vh * 0.98, m.vh * 0.8, top).toFixed(3));
            }
          }
        }
      }),
    [touch],
  );

  // The record's measure: its length and the screen's (for the scroll's wall at its end: controller),
  // and where its parts stand in it.
  useLayoutEffect(() => {
    const pg = page.current;
    const r = record.current;
    if (!pg || !r) return;
    const run = () => {
      const vh = r.clientHeight || window.innerHeight;
      const parts = [...pg.querySelectorAll<HTMLElement>('[data-reveal]')].map((el) => ({ el, top: el.offsetTop }));
      measure.current = { parts, vh };
      eventsFrame.record.height = pg.offsetHeight;
      eventsFrame.record.screen = vh;
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(pg);
    ro.observe(r);
    return () => ro.disconnect();
  }, [shown]);

  // The label's size, when what it says changes (not read back every frame).
  useLayoutEffect(() => {
    const q = label.current;
    if (q) labelSize.current = { w: q.offsetWidth, h: q.offsetHeight };
  }, [focusBay]);

  // The invitation can wrap, compact into one row, or gain hardware safe-area padding. Its actual
  // height is the viewport constraint; a fixed 104px reserve pushed it over the last room row on
  // short landscape screens. Observe display/size changes rather than forcing frame-time layout.
  useLayoutEffect(() => {
    const cr = crew.current;
    if (!cr) return;
    const measureCrew = () => { crewHeight.current = cr.offsetHeight; };
    measureCrew();
    const ro = new ResizeObserver(measureCrew);
    ro.observe(cr, { box: 'border-box' });
    return () => ro.disconnect();
  }, []);

  // Said as it happens (for assistive technology): going in, and back.
  useEffect(() => {
    if (visiting && selected >= 0) setAnnounce(`Entering ${EVENTS[selected].title}, event ${selected + 1} of ${N}. Scroll at any time to control the approach; continue scrolling to read its record.`);
    else if (!visiting && selected < 0 && announce.startsWith('Entering')) setAnnounce('Back at the full view of the events.');
    if (!visiting && openedFrom.current >= 0) {
      const from = openedFrom.current;
      openedFrom.current = -1;
      const a = document.activeElement;
      if (!a || a === document.body || record.current?.contains(a)) focusBack.current = from;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiting, selected]);

  // Keys: Esc goes back to the full view from a room or its record.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const ex = experience();
      if (e.key !== 'Escape' || ex.menuOpen || ex.dossier || ex.textVersionOpen || ex.phase !== 'cinematic') return;
      if (!eventsState().visiting) return;
      e.preventDefault();
      backToFullView();
    };
    // (The capture phase: read before any overlay's own Escape has closed it.)
    window.addEventListener('keydown', key, { capture: true });
    // The pointer (a mouse): the matrix's lean.
    const move = (e: PointerEvent) => {
      const P = eventsFrame.pointer;
      if (e.pointerType !== 'mouse') {
        P.active = false;
        return;
      }
      const p = toNdc(e.clientX, e.clientY);
      P.x = p.x;
      P.y = p.y;
      P.px = e.clientX;
      P.py = e.clientY;
      P.active = true;
    };
    const leave = () => {
      eventsFrame.pointer.active = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      window.removeEventListener('keydown', key, { capture: true });
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, []);

  const light = (i: number) => {
    eventsFrame.hover = i;
    setFocusBay(i);
  };
  const unlight = (i: number) => {
    if (eventsFrame.hover !== i) return;
    eventsFrame.hover = -1;
    setFocusBay(-1);
  };
  const go = (i: number) => {
    if (!canVisitEvent()) return;
    // (The keyboard is brought back to the bay only if it went in from the keyboard: a pointer or a
    // finger went in by itself, and a bay focused under a finger would light it again.)
    openedFrom.current = pressedWith.current === 'key' ? i : -1;
    setFocusBay(-1);
    // Retire the hit layer synchronously. A second click before the next projected frame must not
    // restart the flight or pick another room while the camera already approaches the first.
    if (hub.current) {
      put(hub.current, 'data-live', 'false');
      put(hub.current, 'inert', 'true');
    }
    visitEvent(i);
  };
  const choose = (i: number) => {
    // A bay is a real button on every input device. One tap must do the same
    // thing as one click/Enter, rather than silently arming a second action.
    go(i);
  };

  const ev = focusBay >= 0 ? EVENTS[focusBay] : null;
  return (
    <div ref={root} className="evx" data-phase={phase} data-reduced={reduced ? 'true' : 'false'} data-touch={touch ? 'true' : 'false'}>
      <p className="evx-hidden" aria-live="polite">
        {announce}
      </p>
      <section ref={hub} className="evx-hub" aria-labelledby="evx-hub-heading" data-live="false" inert>
        <h2 id="evx-hub-heading" className="evx-hidden">
          Events — {N} rooms, in this year’s order. Choose one to visit it.
        </h2>
        <ol className="evx-bays">
          {EVENTS.map((e, i) => (
            <li key={e.slug}>
              <button
                ref={(b) => void (bays.current[i] = b)}
                className="evx-bay"
                type="button"
                aria-label={`Visit ${e.title} — event ${i + 1} of ${N}, ${e.kind}${e.flagship ? ', flagship' : ''}`}
                onPointerDown={(p) => {
                  if (p.button !== 0 || !p.isPrimary || !canVisitEvent()) return;
                  pressedWith.current = p.pointerType === 'touch' ? 'touch' : p.pointerType === 'pen' ? 'pen' : 'mouse';
                  press.current = { id: p.pointerId, x: p.clientX, y: p.clientY, moved: false };
                  // The physical bay/hit rectangle can move under a stationary pointer. Keep the
                  // release on the button that was actually pressed, without selecting on down.
                  p.currentTarget.setPointerCapture(p.pointerId);
                  cancelScrollMotion();
                }}
                onPointerCancel={() => void (press.current = null)}
                onKeyDown={() => { pressedWith.current = 'key'; press.current = null; }}
                // (Lit by a mouse moving over it — not by the browser's own enter when the page changes
                // under a pointer left still, as a touch screen's is.)
                onPointerMove={(p) => {
                  const down = press.current;
                  if (down && down.id === p.pointerId && Math.hypot(p.clientX - down.x, p.clientY - down.y) > 10) down.moved = true;
                  if (p.pointerType === 'mouse' && eventsFrame.hover !== i) light(i);
                }}
                onPointerLeave={(p) => p.pointerType === 'mouse' && unlight(i)}
                onFocus={() => eventsFrame.hover !== i && light(i)}
                onBlur={() => unlight(i)}
                onClick={(e) => {
                  const dragged = e.detail > 0 && press.current?.moved;
                  press.current = null;
                  if (!dragged) choose(i);
                }}
              />
            </li>
          ))}
        </ol>
        <div ref={label} className="evx-label" aria-hidden="true" data-on="false">
          {ev && <span className="evx-label-text">[Visit {ev.title}]</span>}
        </div>
        {touch && (
          <div className="evx-focusbar" data-on={ev ? 'true' : 'false'}>
            {ev && (
              <>
                <p className="evx-focusbar-name">
                  <span className="evx-label-num">{pad2(focusBay + 1)}</span> {ev.title}
                  <span className="evx-focusbar-kind">{ev.kind}</span>
                </p>
                <button type="button" className="evx-focusbar-visit" onClick={() => go(focusBay)}>
                  <span className="evx-br">[</span> Visit {ev.title} <span className="evx-arrow">→</span> <span className="evx-br">]</span>
                </button>
              </>
            )}
          </div>
        )}
        <div ref={crew} className="evx-crew" data-away={touch && ev ? 'true' : 'false'}>
          <p className="evx-crew-hint">{visiting && selected >= 0 ? `Entering ${EVENTS[selected].title} · scroll to control the approach` : `${touch ? 'Tap' : 'Click'} a room to enter · or go on`}</p>
          <button type="button" className="evx-crew-btn" onClick={() => visitCrew()}>
            <span className="evx-crew-k">Next,</span> let’s meet the Crew{' '}
            <span className="evx-arrow" aria-hidden="true">
              ↓
            </span>
          </button>
        </div>
      </section>

      <section ref={record} className="evx-record" aria-labelledby="evx-title" data-on="false" aria-hidden="true" inert>
        <div ref={page} className="evx-page evx-sheet">
          {shown >= 0 && <Record index={shown} />}
        </div>
      </section>
    </div>
  );
}
