'use client';
/** Full event dossier (accessible dialog) opened from a room caption or the index. */
import { useEffect, useRef } from 'react';
import { eventBySlug } from '@/content/events';
import { isAvailable } from '@/content/media';
import { useExperience } from '@/store/experience';
import { useModalFocus } from './useModalFocus';

export function Dossier() {
  const slug = useExperience((s) => s.dossier);
  const set = useExperience((s) => s.set);
  const ev = slug ? eventBySlug(slug) : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  useModalFocus(!!ev, root);

  useEffect(() => {
    if (!ev) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set({ dossier: null });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [ev, set]);

  if (!ev) return null;
  return (
    <div className="dossier-backdrop" onClick={() => set({ dossier: null })}>
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
        <button ref={closeRef} className="dossier-close" onClick={() => set({ dossier: null })} aria-label="Close dossier">
          Close ✕
        </button>
        <p className="kicker">
          {ev.kind} · {ev.cadence}
          {ev.flagship ? ' · Flagship' : ''}
        </p>
        <h2 id="dossier-title" className="dossier-title">
          {ev.title}
        </h2>
        {ev.image && isAvailable(ev.image.src) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="dossier-img" src={ev.image.src} alt={ev.image.alt} />
        )}
        <p className="lede">{ev.summary}</p>
        <p>{ev.description}</p>
        <dl className="facts">
          {ev.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        {ev.programme && (
          <>
            <h3>Programme</h3>
            <ol className="programme">
              {ev.programme.map((p) => (
                <li key={p.title}>
                  <strong>{p.title}</strong>
                  <span>{p.text}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        {ev.links.length > 0 && (
          <p className="links">
            {ev.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ))}
          </p>
        )}
        <p>
          <a className="text-link" href={`/events/${ev.slug}`}>
            Permanent page for {ev.title} →
          </a>
        </p>
      </aside>
    </div>
  );
}
