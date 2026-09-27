'use client';
/**
 * An event's dossier: the archive's file on it (accessible dialog), opened
 * from its room's card or from the index.
 *
 * The room answers "what is this?"; the file answers "how does it work?" —
 * the essence once, the record when it says more, how the programme runs
 * (content/dossiers.ts), a figure where the idea has a shape, the facts at a
 * glance, and what it connects to. Opened from a room's card, the file grows
 * out of that card and folds back into it on close; the room stays visible
 * behind it.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DOSSIERS } from '@/content/dossiers';
import { EVENTS, eventBySlug, type EventRecord } from '@/content/events';
import { isAvailable } from '@/content/media';
import { useExperience } from '@/store/experience';
import { DossierFigure } from './DossierFigure';
import { dossierOrigin } from './dossierOrigin';
import { goToRoom } from './navigation';
import { useModalFocus } from './useModalFocus';

const pad2 = (n: number) => String(n).padStart(2, '0');
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/** The summary once, and the record only if it says more than the summary. */
function essenceOf(ev: EventRecord) {
  const sum = words(ev.summary);
  const desc = words(ev.description);
  let shared = 0;
  sum.forEach((w) => desc.has(w) && shared++);
  const repeats = shared / Math.max(1, sum.size) > 0.7 && desc.size < sum.size * 2.2;
  return repeats ? { essence: ev.description, record: null } : { essence: ev.summary, record: ev.description };
}

/** The card a room's dossier grows out of, if it is on screen. */
function cardFor(slug: string) {
  const el = document.querySelector<HTMLElement>(`.plate[data-plate="room-${slug}"] .plate-card`);
  if (!el || Number(getComputedStyle(el).opacity) < 0.2) return null;
  return el.getBoundingClientRect();
}

export function Dossier() {
  const slug = useExperience((s) => s.dossier);
  const reduced = useExperience((s) => s.reducedMotion);
  const set = useExperience((s) => s.set);
  const [shown, setShown] = useState<string | null>(slug);
  const [closing, setClosing] = useState(false);
  const root = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  // Opening shows the file at once; closing lets it fold away first.
  useEffect(() => {
    if (slug) {
      setShown(slug);
      setClosing(false);
    } else if (shown) setClosing(true);
  }, [slug, shown]);

  const ev = shown ? eventBySlug(shown) : undefined;
  useModalFocus(!!ev && !closing, root);

  useEffect(() => {
    if (!ev) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set({ dossier: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ev, set]);

  // Open: the surface grows out of the room's card into the file, then the file's contents come up.
  useLayoutEffect(() => {
    const sheet = root.current;
    if (!ev || closing || !sheet) return;
    sheet.scrollTop = 0;
    const from = dossierOrigin.rect;
    dossierOrigin.rect = null;
    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 200 : 520, easing: 'ease-out' });
    if (reduced) {
      sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      return;
    }
    const to = sheet.getBoundingClientRect();
    if (from && to.width > 0) {
      const t = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
      sheet.animate([{ transform: t, opacity: 0.85 }, { transform: 'none', opacity: 1 }], { duration: 640, easing: 'cubic-bezier(0.22, 0.9, 0.24, 1)' });
    } else {
      sheet.animate([{ transform: 'translateX(48px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(0.22, 0.9, 0.24, 1)' });
    }
    content.current?.animate(
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 0, transform: 'translateY(10px)', offset: 0.5 },
        { opacity: 1, transform: 'none' },
      ],
      { duration: from ? 900 : 700, easing: 'ease-out' },
    );
  }, [ev, closing, reduced]);

  // Close: the contents go, the surface folds back into the card (or slides away), then the file is gone.
  useEffect(() => {
    const sheet = root.current;
    if (!closing || !sheet || !shown) return;
    const done = () => {
      setShown(null);
      setClosing(false);
    };
    if (reduced) {
      sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).onfinish = done;
      return;
    }
    const to = cardFor(shown);
    const from = sheet.getBoundingClientRect();
    content.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
    backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 120, fill: 'forwards' });
    const end = to
      ? { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0.2 }
      : { transform: 'translateX(48px)', opacity: 0 };
    sheet.animate([{ transform: 'none', opacity: 1 }, end], { duration: 520, delay: 120, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)', fill: 'forwards' }).onfinish = done;
  }, [closing, shown, reduced]);

  if (!ev) return null;
  const index = EVENTS.indexOf(ev);
  const file = DOSSIERS[ev.slug];
  const { essence, record } = essenceOf(ev);
  const close = () => set({ dossier: null });
  const visitRoom = (i: number) => {
    set({ dossier: null });
    goToRoom(i);
  };

  return (
    <div ref={backdrop} className="dossier-backdrop" data-state={closing ? 'closing' : 'open'} onClick={close}>
      <aside
        ref={root}
        className="dossier"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-title"
        style={{ ['--accent' as string]: ev.accent }}
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent
      >
        <div ref={content} className="dossier-content">
          <div className="dossier-file">
            <span>ACM-CEG · Events archive</span>
            <span>
              File {pad2(index + 1)} / {pad2(EVENTS.length)}
            </span>
            <button className="dossier-close" onClick={close} aria-label="Close dossier">
              Close ✕
            </button>
          </div>

          <header className="dossier-head">
            <p className="kicker">
              {ev.kind} · {ev.cadence}
              {ev.flagship ? ' · Flagship' : ''}
            </p>
            <h2 id="dossier-title" className="dossier-title">
              {ev.title}
            </h2>
            <p className="dossier-essence">{essence}</p>
            {file?.character && <p className="dossier-character">{file.character}</p>}
          </header>

          <div className="dossier-cols">
            <div className="dossier-main">
              <DossierFigure event={ev} />
              {ev.image && isAvailable(ev.image.src) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="dossier-img" src={ev.image.src} alt={ev.image.alt} />
              )}
              {file?.flows.map((f) => (
                <section key={f.label} className="dossier-section">
                  <h3>
                    {f.label}
                    {f.reading && <span className="dossier-reading">The exhibition’s reading, not a syllabus</span>}
                  </h3>
                  <ol className={`flow flow-${f.kind}`}>
                    {f.steps.map((st, i) => (
                      <li key={st.title}>
                        <span className="flow-n">{pad2(i + 1)}</span>
                        <strong>{st.title}</strong>
                        {st.note && <span className="flow-note">{st.note}</span>}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              {ev.programme && (
                <section className="dossier-section">
                  <h3>Programme</h3>
                  <ol className="programme">
                    {ev.programme.map((p) => (
                      <li key={p.title}>
                        <strong>{p.title}</strong>
                        <span>{p.text}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {record && (
                <section className="dossier-section">
                  <h3>The record</h3>
                  <p className="dossier-record">{record}</p>
                </section>
              )}
            </div>

            <aside className="dossier-side">
              <section className="dossier-section">
                <h3>At a glance</h3>
                <dl className="dossier-meta">
                  <div>
                    <dt>Room</dt>
                    <dd>
                      {pad2(index + 1)} of {pad2(EVENTS.length)}
                    </dd>
                  </div>
                  <div>
                    <dt>Kind</dt>
                    <dd>{ev.kind}</dd>
                  </div>
                  <div>
                    <dt>Runs as</dt>
                    <dd>
                      {ev.cadence}
                      {ev.flagship ? ' · flagship' : ''}
                    </dd>
                  </div>
                  {ev.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {file?.with && (
                <section className="dossier-section">
                  <h3>In collaboration with</h3>
                  <p className="dossier-with">
                    <span>ACM-CEG</span>
                    <em>×</em>
                    {file.with.map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </p>
                </section>
              )}
              {file?.related && (
                <section className="dossier-section">
                  <h3>Connections</h3>
                  <ul className="dossier-related">
                    {file.related.map((r) => {
                      const other = eventBySlug(r.slug);
                      if (!other) return null;
                      const i = EVENTS.indexOf(other);
                      return (
                        <li key={r.slug} style={{ ['--accent' as string]: other.accent }}>
                          <button onClick={() => set({ dossier: r.slug })}>
                            <span className="flow-n">{pad2(i + 1)}</span> {other.title} <span aria-hidden>→</span>
                          </button>
                          <span>{r.note}</span>
                          <button className="dossier-visit" onClick={() => visitRoom(i)}>
                            Visit room {pad2(i + 1)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {ev.links.length > 0 && (
                <section className="dossier-section">
                  <h3>Links</h3>
                  <p className="links">
                    {ev.links.map((l) => (
                      <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                        {l.label} ↗
                      </a>
                    ))}
                  </p>
                </section>
              )}
              <p className="dossier-permalink">
                <a className="text-link" href={`/events/${ev.slug}`}>
                  Permanent page for {ev.title} →
                </a>
              </p>
            </aside>
          </div>
        </div>
      </aside>
    </div>
  );
}
