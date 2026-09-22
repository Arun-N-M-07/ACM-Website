'use client';
/**
 * Interface for the team tour: who you're meeting (a card per domain), their
 * lines as subtitles, a scroll hint, and a tour bar to hop between domains —
 * the keyboard / touch / screen-reader path through the same walk.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SEGMENTS } from '@/config/timeline';
import { DOMAINS, domainById, type DomainId } from '@/content/domains';
import { meetingFor } from '@/content/meetings';
import { membersOf } from '@/content/team';
import { useExperience } from '@/store/experience';
import { anchorAt, onProjected } from '@/systems/anchors/anchors';
import { TOUR_STOPS, tourProgress, tourWalkProgress } from '@/systems/camera/tour';
import { goToDomain, skipToCore, stepDomain } from './navigation';
import { Plate, PlateFacts } from './Plate';
import { useProgressFrame } from './useProgressFrame';

/**
 * What's being said, as a subtitle — with a line up to the person saying it,
 * so it's always clear who is talking.
 */
function Subtitle() {
  const speech = useExperience((s) => s.speech);
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const update = () => {
      const b = box.current;
      const l = line.current;
      const d = dot.current;
      if (!b || !l || !d) return;
      const who = useExperience.getState().speech?.memberId;
      const at = anchorAt(who ? `npc:${who}` : undefined);
      const r = b.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top - 6;
      if (!at || !at.visible || at.y > y0 - 40) {
        l.style.opacity = '0';
        d.style.opacity = '0';
        return;
      }
      const hx = at.x;
      const hy = at.y + 10;
      l.setAttribute('d', `M ${x0.toFixed(1)} ${y0.toFixed(1)} C ${x0.toFixed(1)} ${((y0 + hy) / 2).toFixed(1)}, ${hx.toFixed(1)} ${((y0 + hy) / 2).toFixed(1)}, ${hx.toFixed(1)} ${hy.toFixed(1)}`);
      l.style.opacity = '0.55';
      d.setAttribute('cx', hx.toFixed(1));
      d.setAttribute('cy', hy.toFixed(1));
      d.style.opacity = '1';
    };
    return onProjected(update);
  }, []);
  return (
    <>
      <svg className="speaker-line" aria-hidden="true" data-visible={!!speech}>
        <path ref={line} />
        <circle ref={dot} r="3.5" />
      </svg>
      <div ref={box} className="subtitle" data-visible={!!speech} aria-live="polite">
        {speech && (
          <p>
            <span className="who">
              {speech.name} <em>{speech.role}</em>
            </span>
            <span className="line">“{speech.text}”</span>
          </p>
        )}
      </div>
    </>
  );
}

/** The domain's card lifts off its sign as you walk up; it folds away for the moment itself. */
function DomainPlate({ id, index }: { id: DomainId; index: number }) {
  const d = domainById(id);
  const members = membersOf(id);
  const meeting = meetingFor(id);
  const total = TOUR_STOPS.length - 2;
  const range = useMemo<[number, number]>(
    () => (index === 0 ? [tourProgress(0, 0.005), tourProgress(0, 0.22)] : [tourWalkProgress(index, 0.6), tourProgress(index, 0.13)]),
    [index],
  );
  return (
    <Plate id={`domain-${id}`} side={index === 0 ? 'right' : 'left'} anchor={index === 0 ? 'commons' : `bay:${id}`} accent={d.accent} pin={d.signage} range={range}>
      <p className="plate-kicker">{index === 0 ? 'The welcome · Office bearers' : `Domain ${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}${meeting ? ` · ${meeting.title}` : ''}`}</p>
      <h2 className="plate-title">{index === 0 ? 'Meet the chapter.' : d.name}</h2>
      <p className="plate-body">{d.tagline}</p>
      <PlateFacts facts={members.map((m) => ({ label: m.role.replace(/^Director, /, 'Director · '), value: m.name }))} />
    </Plate>
  );
}

/** Small persistent label: where you are on the tour. */
function TourLabel({ id, index }: { id: DomainId; index: number }) {
  const d = domainById(id);
  const total = TOUR_STOPS.length - 2;
  return (
    <p className="tour-label-pill" style={{ ['--accent' as string]: d.accent }}>
      <span>{index === 0 ? 'Welcome' : `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}</span> {d.name}
    </p>
  );
}

export function TeamHud() {
  const stop = useExperience((s) => s.tourStop);
  const domain = useExperience((s) => s.tourDomain);
  const phase = useExperience((s) => s.phase);
  const [tourOpen, setTourOpen] = useState(false);
  const [hint, setHint] = useState(true);

  // "Scroll to walk on" until the visitor has walked a stop or two.
  useProgressFrame((p) => {
    if (hint && p > SEGMENTS.team.start + (SEGMENTS.team.end - SEGMENTS.team.start) * 0.2) setHint(false);
  });
  useEffect(() => {
    if (stop < 0) setTourOpen(false);
  }, [stop]);

  if (stop < 0 || phase !== 'cinematic' || domain === 'core') return null;
  const next = TOUR_STOPS[stop + 1];
  const nextName = next ? (next.id === 'core' ? 'The core' : domainById(next.id).name) : null;

  return (
    <div className="team-hud">
      {domain && <DomainPlate key={domain} id={domain} index={stop} />}
      {domain && <TourLabel id={domain} index={stop} />}
      <div className="hud-hint" data-visible={hint}>
        <p>
          <span className="kbd">Scroll</span> to walk on and meet each domain
        </p>
      </div>
      <div className="tour">
        <div className="tour-bar">
          <button className="btn" onClick={() => stepDomain(-1)} aria-label="Previous domain" disabled={stop <= 0}>
            ‹
          </button>
          <button className="btn tour-label" onClick={() => setTourOpen((o) => !o)} aria-expanded={tourOpen}>
            {nextName ? `Next: ${nextName}` : 'All domains'}
          </button>
          <button className="btn" onClick={() => stepDomain(1)} aria-label="Next domain">
            ›
          </button>
        </div>
        {tourOpen && (
          <ul className="tour-list" data-lenis-prevent>
            <li>
              <button className={stop === 0 ? 'visited' : ''} onClick={() => goToDomain('office')}>
                <i style={{ background: domainById('office').accent }} aria-hidden="true" />
                The welcome — office bearers
              </button>
            </li>
            {DOMAINS.filter((d) => d.id !== 'office').map((d) => (
              <li key={d.id}>
                <button className={domain === d.id ? 'visited' : ''} onClick={() => goToDomain(d.id)}>
                  <i style={{ background: d.accent }} aria-hidden="true" />
                  {d.name}
                </button>
              </li>
            ))}
            <li>
              <button onClick={skipToCore}>
                <i style={{ background: '#ffb86b' }} aria-hidden="true" />
                The core
              </button>
            </li>
          </ul>
        )}
      </div>
      <Subtitle />
    </div>
  );
}
