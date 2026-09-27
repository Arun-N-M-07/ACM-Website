'use client';
/**
 * Every content plate along the journey, in order: one per event room. (The
 * opening cinematic says what it has to say in the world itself — src/intro —
 * the portal speaks for itself — its sign, THE TEAMS — and the Teams world has
 * its own interface: src/teams/ui.)
 */
import { useMemo } from 'react';
import { CORRIDOR } from '@/config/world';
import { useExperience } from '@/store/experience';
import { roomDwellRange } from '@/systems/camera/shots';
import { dossierOrigin } from './dossierOrigin';
import { Plate, PlateFacts } from './Plate';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function Plates() {
  const set = useExperience((s) => s.set);
  const phase = useExperience((s) => s.phase);
  const ranges = useMemo(
    () => ({
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

    </div>
  );
}
