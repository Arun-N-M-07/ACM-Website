'use client';
/**
 * Every content plate along the journey, in order: one per event room, and the
 * portal. (The opening cinematic says what it has to say in the world itself —
 * src/intro — and the Teams world has its own interface: src/teams/ui.)
 */
import { useMemo } from 'react';
import { PORTAL_DWELL, SEGMENTS, type SegmentId } from '@/config/timeline';
import { CORRIDOR } from '@/config/world';
import { useExperience } from '@/store/experience';
import { roomDwellRange } from '@/systems/camera/shots';
import { dossierOrigin } from './dossierOrigin';
import { Plate, PlateFacts } from './Plate';

const at = (seg: SegmentId, t: number) => SEGMENTS[seg].start + (SEGMENTS[seg].end - SEGMENTS[seg].start) * t;
const pad2 = (n: number) => String(n).padStart(2, '0');

export function Plates() {
  const set = useExperience((s) => s.set);
  const phase = useExperience((s) => s.phase);
  const ranges = useMemo(
    () => ({
      portal: [at('portal', 0.2), at('portal', PORTAL_DWELL * 0.94)] as [number, number],
      rooms: CORRIDOR.rooms.map((r) => {
        const [a, b] = roomDwellRange(r.index);
        const len = b - a;
        return [a + len * 0.05, b - len * 0.12] as [number, number];
      }),
    }),
    [],
  );

  return (
    <div className="plates" data-phase={phase}>
      {CORRIDOR.rooms.map((r, i) => {
        const e = r.event;
        return (
          <Plate
            key={e.slug}
            id={`room-${e.slug}`}
            side={r.side === -1 ? 'right' : 'left'}
            anchor={`room:${e.slug}`}
            accent={e.accent}
            pin={`ROOM ${pad2(r.index + 1)}`}
            range={ranges.rooms[i]}
          >
            <p className="plate-kicker">
              Room {pad2(r.index + 1)} / {pad2(CORRIDOR.rooms.length)} · {e.kind} · {e.cadence}
              {e.flagship ? ' · Flagship' : ''}
            </p>
            <h2 className="plate-title">{e.title}</h2>
            <p className="plate-body">{e.summary}</p>
            {e.facts.length > 0 && <PlateFacts facts={e.facts.slice(0, 3).map((f) => ({ label: f.label, value: f.value }))} />}
            <div className="plate-actions">
              <button
                className="plate-btn"
                onClick={(ev) => {
                  dossierOrigin.rect = ev.currentTarget.closest('.plate-card')?.getBoundingClientRect() ?? null;
                  set({ dossier: e.slug });
                }}
              >
                Full dossier →
              </button>
              {e.links.slice(0, 1).map((l) => (
                <a key={l.href} className="plate-btn ghost" href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </Plate>
        );
      })}

      <Plate id="portal" side="left" anchor="portalTop" pin="THE PORTAL" range={ranges.portal}>
        <p className="plate-kicker">07 · End of the corridor</p>
        <h2 className="plate-title">Beyond the events: the people.</h2>
        <p className="plate-body">The corridor ends at a portal. Touch and hold it to cross into the Teams — six domains, and the people in them.</p>
      </Plate>
    </div>
  );
}
