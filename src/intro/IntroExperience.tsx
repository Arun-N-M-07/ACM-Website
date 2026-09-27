'use client';
/**
 * The opening's layer of the page — the very little interface it allows
 * itself. It takes no input: the page's own scroll (Lenis, as everywhere in
 * the journey) moves the opening, and nothing here intercepts it.
 *
 *   – "Skip" — quiet, bottom right, always reachable by keyboard; and
 *     opposite it, the sound (the top bar, with its own toggle, waits for the
 *     Events)
 *   – a cue that appears only if the visitor hasn't scrolled for a while
 *     ("Scroll" / "Swipe"), and never while anything moves
 *   – the story's words (and the chapter's name) for assistive technology,
 *     announced as each becomes legible
 *
 * No navigation, no titles, no panels: the world is the interface.
 */
import { MUSIC } from '@/config/music';
import { isAvailable } from '@/content/media';
import { useExperience } from '@/store/experience';
import { skipIntro } from './controller';
import { useIntro } from './state';
import { STORY_LINES } from './story/fragments';

export function IntroExperience() {
  const isTouch = useExperience((s) => s.isTouch);
  const musicOn = useExperience((s) => s.musicOn);
  const set = useExperience((s) => s.set);
  const active = useIntro((s) => s.active);
  const hint = useIntro((s) => s.hint);
  const line = useIntro((s) => s.line);
  const hasTrack = isAvailable(MUSIC.src);

  return (
    <div className="intro-layer" data-running={active}>
      {active && hasTrack && (
        <button
          className="intro-sound"
          aria-pressed={musicOn}
          onClick={(e) => {
            // The music director starts or fades the score.
            set({ musicOn: !musicOn });
            e.currentTarget.blur();
          }}
        >
          {musicOn ? 'Sound on' : 'Sound off'}
        </button>
      )}
      {active && (
        <button
          className="intro-skip"
          onClick={(e) => {
            skipIntro();
            e.currentTarget.blur();
          }}
        >
          Skip intro
        </button>
      )}
      <div className="intro-cue" data-on={active && hint} aria-hidden="true">
        <span className="intro-cue-line" />
        <span className="intro-cue-word">{isTouch ? 'Swipe' : 'Scroll'}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {active && line >= 0 ? STORY_LINES[line].text : ''}
      </p>
    </div>
  );
}
