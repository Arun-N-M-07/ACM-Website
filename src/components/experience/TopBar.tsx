'use client';
/**
 * Minimal persistent chrome: wordmark (opens the index), current chapter,
 * and the sound / motion / text-version controls. Stays out of the way —
 * it recedes during camera moves and returns on pointer activity.
 */
import { CHAPTERS } from '@/config/timeline';
import { useExperience } from '@/store/experience';
import { MUSIC } from '@/config/music';
import { isAvailable } from '@/content/media';
import { music } from '@/systems/audio/music';

export function TopBar() {
  const chapter = useExperience((s) => s.chapter);
  const phase = useExperience((s) => s.phase);
  const musicOn = useExperience((s) => s.musicOn);
  const hasTrack = isAvailable(MUSIC.src);
  const reduced = useExperience((s) => s.reducedMotion);
  const set = useExperience((s) => s.set);
  const current = CHAPTERS.find((c) => c.id === (phase === 'impact' ? 'team' : chapter));

  if (phase === 'loading') return null;

  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => set({ menuOpen: true })} aria-label="ACM-CEG — open the index">
        <span>ACM</span>
        <i aria-hidden="true" />
        <span>CEG</span>
      </button>
      <p className="chapter-indicator" aria-live="polite">
        <span className="num">{current?.number}</span>
        <span className="label">{current?.label}</span>
      </p>
      <nav className="controls" aria-label="Experience controls">
        <button
          className={`ctl ctl-music ${musicOn ? 'on' : ''}`}
          aria-pressed={musicOn}
          disabled={!hasTrack}
          title={hasTrack ? `${MUSIC.title} — ${MUSIC.artist}` : `Add the soundtrack at public${MUSIC.src} to enable music`}
          onClick={(e) => {
            const next = !musicOn;
            set({ musicOn: next });
            if (next) void music.enable();
            else music.disable();
            e.currentTarget.blur();
          }}
        >
          <span className="dot" aria-hidden="true" />
          {musicOn ? (
            <>
              <span className="note" aria-hidden="true">
                ♪
              </span>{' '}
              {MUSIC.title}
            </>
          ) : hasTrack ? (
            'Music off'
          ) : (
            'Silent'
          )}
        </button>
        <button className={`ctl ${reduced ? 'on' : ''}`} aria-pressed={reduced} onClick={() => set({ reducedMotion: !reduced })}>
          <span className="dot" aria-hidden="true" />
          {reduced ? 'Reduced motion' : 'Full motion'}
        </button>
        <button className="ctl" onClick={() => set({ textVersionOpen: true })}>
          Text version
        </button>
        <button className="ctl ctl-index" onClick={() => set({ menuOpen: true })} aria-haspopup="dialog">
          Index
        </button>
      </nav>
    </header>
  );
}
