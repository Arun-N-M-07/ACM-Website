'use client';
/**
 * The Teams world's interface. Kept to type at the edges, the way the
 * reference keeps its own — the world is the interface:
 *
 *   nav       bottom-left: THE SIX DOMAINS, one "->" line each (the one in
 *             view is lit). A line travels the ring to its domain; the line
 *             for the domain already in view opens it. Real buttons — the
 *             keyboard / screen-reader path to every card. Types itself in
 *             when it appears, and steps away while a domain is open.
 *   cursor    over a card, the ordinary hand (the card's own glint does the rest)
 *   pull      scrolling back at the start of the world: how far until the
 *             portal takes you back
 *
 * Past the last card there is no closing plate: the camera pulls back over
 * the whole ring and runs on down the spine into the dark, and the journey
 * begins again (components/experience/JourneyLoop) — the loop is the ending.
 *
 * Per-frame values (hover cursor, pull) are written straight to
 * the DOM from the progress channel; React renders only when the state or the
 * card in view changes.
 */
import { useEffect, useRef, useState } from 'react';
import { DOMAIN_COUNT, TEAM_DOMAINS } from '@/content/teams';
import { useExperience } from '@/store/experience';
import { scrollToProgress } from '@/systems/scroll/ScrollTimeline';
import { smooth, useProgressFrame } from '@/components/experience/useProgressFrame';
import { PULL_EXIT } from '../controller';
import { hopTo, selectDomain } from '../focus';
import { C_MIST, progressForDomain } from '../layout';
import { teams, teamsFrame, useTeams } from '../state';
import { TypeIn } from './TypeIn';

function navTo(i: number) {
  const s = teams().state;
  if (s === 'teamsActive') {
    // Already in view: open it. Otherwise travel the ring to it.
    if (teams().current === i && Math.abs(teamsFrame.c - i) < 0.25) return selectDomain(i);
    const reduced = useExperience.getState().reducedMotion;
    scrollToProgress(progressForDomain(i), reduced ? 0.01 : Math.min(2.8, 1 + Math.abs(teamsFrame.c - i) * 0.4));
  } else if (s === 'domainDetail') hopTo(i);
}

export function TeamsHud() {
  const state = useTeams((s) => s.state);
  const current = useTeams((s) => s.current);
  const pull = useRef<HTMLDivElement>(null);
  const pullBar = useRef<HTMLSpanElement>(null);
  const nav = useRef<HTMLElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const live = state === 'teamsActive' || state === 'cardFocused' || state === 'domainDetail';
  const orbiting = state === 'teamsActive';
  // Re-type the nav each time it comes back (after a domain closes).
  const [typeKey, setTypeKey] = useState(0);
  useEffect(() => {
    if (orbiting) setTypeKey((k) => k + 1);
  }, [orbiting]);

  // Let global chrome know (the chapter rail and plates step aside inside).
  useEffect(() => {
    document.documentElement.dataset.teams = live || state === 'teamsEntering' ? 'inside' : 'outside';
  }, [live, state]);

  // A domain closed while focus was in it (a keyboard / screen-reader user):
  // bring focus back to that domain's line instead of the page body.
  useEffect(
    () =>
      useTeams.subscribe((s, prev) => {
        if (s.state !== 'teamsActive' || prev.state !== 'cardFocused') return;
        const a = document.activeElement;
        if (a && a !== document.body && (!a.isConnected || a.closest('.domain-detail'))) {
          const i = prev.selected ?? s.current;
          requestAnimationFrame(() => items.current[i]?.focus({ preventScroll: true }));
        }
      }),
    [],
  );

  useProgressFrame(() => {
    const f = teamsFrame;
    const root = document.documentElement;
    const hovering = orbiting && f.hover >= 0 && f.pointer.active;
    if ((root.dataset.teamsHover === 'true') !== hovering) root.dataset.teamsHover = hovering ? 'true' : 'false';
    const pl = pull.current;
    if (pl) {
      const k = Math.min(1, f.pull / PULL_EXIT);
      pl.style.opacity = String(orbiting ? smooth(0.04, 0.16, k) : 0);
      if (pullBar.current) pullBar.current.style.transform = `scaleX(${k.toFixed(3)})`;
    }
    // The nav steps away as the camera pulls back past the last card.
    if (nav.current) {
      const visible = orbiting ? smooth(0.75, 1, f.reveal) * (1 - smooth(C_MIST, C_MIST + 0.3, f.c)) : 0;
      nav.current.style.opacity = String(visible);
      nav.current.style.visibility = visible < 0.01 ? 'hidden' : 'visible';
    }
  });

  useEffect(
    () => () => {
      document.documentElement.dataset.teamsHover = 'false';
    },
    [],
  );

  if (!live) return null;

  return (
    <div className="teams-hud" data-state={state} data-ui>
      <nav ref={nav} className="teams-nav" aria-label="Core and domains" inert={!orbiting}>
        <p className="teams-nav-title" key={`t${typeKey}`}>
          <TypeIn text="Core / The six domains" delay={0} />
        </p>
        <ol>
          {TEAM_DOMAINS.map((dm, i) => (
            <li key={dm.slug} data-current={i === current}>
              <button
                ref={(el) => {
                  items.current[i] = el;
                }}
                onClick={() => navTo(i)}
                aria-current={i === current ? 'true' : undefined}
                aria-label={i === current ? `${dm.name} — open` : `${dm.name} — go to`}
              >
                <span className="arrow" aria-hidden="true">
                  -&gt;
                </span>
                <span className="num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="name" key={`n${typeKey}`}>
                  <TypeIn text={dm.name} delay={0.08 + i * 0.07} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div ref={pull} className="teams-pull" aria-hidden="true">
        <p>Keep scrolling up to go back through the portal</p>
        <span className="teams-pull-bar">
          <span ref={pullBar} />
        </span>
      </div>

    </div>
  );
}
