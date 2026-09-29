/**
 * The music player: one track, faded in and out, with a low-pass that closes
 * as the journey goes underground and opens again inside — so the song feels
 * like it is playing in the room you are in. The film's sound effects
 * (./sfx.ts) share its audio context, and are heard only when it is.
 *
 * Entering with sound starts the score at a chosen point (`playFrom`) from
 * inside the click; from then on it plays on, whatever the scroll does.
 *
 * Everything is wrapped defensively: a missing file, a blocked AudioContext or
 * a codec the browser dislikes must never break the journey.
 */
import { MUSIC } from '@/config/music';

type State = 'idle' | 'playing' | 'missing' | 'blocked';

class MusicPlayer {
  private el: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private wanted = false;
  private level = 1;
  private holdTimer = 0;
  /** Suspends the audio graph a little after the sound is switched off (see disable). */
  private sleepTimer = 0;
  /** The muffle filter's last target (Hz), so an unchanged one isn't sent again every frame. */
  private muffleHz = -1;
  private holding = false;
  /** No Web Audio in this browser: fade with the element's own volume instead. */
  private fallback = false;
  /** Paused because the page was hidden (watchPage), to be resumed when it comes back. */
  private away = false;
  /** A resume waiting for the visitor's next touch or key (the system took the audio; see wake). */
  private retry: (() => void) | null = null;
  private watching = false;
  state: State = 'idle';
  /** Set when the browser refuses to play (autoplay policy, missing file…). */
  message = '';

  private build() {
    if (this.el) return;
    const el = new Audio(MUSIC.src);
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.volume = 1;
    el.addEventListener('error', () => {
      this.state = 'missing';
      this.message = `No audio file at ${MUSIC.src}`;
    });
    this.el = el;
  }

  /** The Web Audio graph needs a user gesture to run; build it on the first one. */
  private graph() {
    if (this.ctx || !this.el) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(this.el);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // (Open: as high as this context can go — some outputs run at 16 kHz, where 20 kHz is out of range.)
      filter.frequency.value = Math.min(20000, ctx.sampleRate * 0.45);
      filter.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      ctx.addEventListener('statechange', this.onContextState);
      this.ctx = ctx;
      this.filter = filter;
      this.gain = gain;
      // From here the gain node does all the fading: the element itself plays at full volume
      // into the graph (its volume scales what reaches the graph — left at 0, the music is silent).
      this.el.volume = 1;
      this.el.muted = false;
    } catch {
      // No Web Audio: fall back to plain element volume.
      this.ctx = null;
      this.fallback = true;
      this.el.volume = 0;
    }
  }

  /** Start fetching the file while the world loads (no sound, no gesture needed). */
  preload() {
    this.build();
    this.el?.load();
  }

  /** Enough of the file is buffered to start without a stall. */
  get ready() {
    return !!this.el && this.el.readyState >= 3;
  }

  /**
   * The browser is holding the file until a gesture — not enough of it buffered to play, and nothing
   * more being fetched (iOS loads no media data before one; a data saver may stop at the metadata).
   * It plays, from within the Enter, all the same.
   */
  get held() {
    const el = this.el;
    return !!el && el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && el.networkState !== HTMLMediaElement.NETWORK_LOADING;
  }

  /** The file can't be played (missing, or refused). */
  get failed() {
    return this.state === 'missing' || this.state === 'blocked';
  }

  /** The Web Audio context (built in the gesture that enabled sound), for the sound effects. */
  get context() {
    return this.ctx;
  }

  /** The visitor wants sound. */
  get wantsSound() {
    return this.wanted;
  }

  /** Playback position (s). */
  get time() {
    return this.el?.currentTime ?? 0;
  }

  /** Audibly playing (not paused, not stalled waiting for data, not breathing out). */
  get running() {
    const el = this.el;
    return !!el && !el.paused && !el.ended && el.readyState >= 3 && this.state === 'playing' && !this.holding;
  }

  /** Called from a user gesture (the loader's buttons, the top bar). */
  async enable() {
    this.wanted = true;
    window.clearTimeout(this.sleepTimer);
    this.build();
    this.graph();
    const el = this.el;
    if (!el) return;
    window.clearTimeout(this.holdTimer);
    this.holding = false;
    try {
      // play() first, synchronously inside the gesture (Safari needs that), then the context.
      const playing = el.play();
      await this.ctx?.resume();
      await playing;
      this.state = 'playing';
      this.message = '';
      this.fadeTo(MUSIC.volume * this.level, MUSIC.fade);
    } catch (err) {
      this.state = el.error ? 'missing' : 'blocked';
      this.message = el.error ? `No audio file at ${MUSIC.src}` : String((err as Error)?.message ?? err);
    }
  }

  /**
   * Play from `at` seconds, fading in over `fade`. Safe to call before the
   * metadata has loaded (the seek is applied once it has).
   */
  async playFrom(at: number, fade = 0.6) {
    this.wanted = true;
    window.clearTimeout(this.sleepTimer);
    this.build();
    this.graph();
    const el = this.el;
    if (!el) return;
    window.clearTimeout(this.holdTimer);
    this.holding = false;
    const seek = () => {
      try {
        el.currentTime = at;
      } catch {
        // Not seekable yet; the loadedmetadata handler below will retry.
      }
    };
    if (el.readyState >= 1) seek();
    else el.addEventListener('loadedmetadata', seek, { once: true });
    this.silence();
    try {
      const playing = el.play();
      await this.ctx?.resume();
      await playing;
      this.state = 'playing';
      this.message = '';
      this.fadeTo(MUSIC.volume * this.level, fade);
    } catch (err) {
      this.state = el.error ? 'missing' : 'blocked';
      this.message = el.error ? `No audio file at ${MUSIC.src}` : String((err as Error)?.message ?? err);
    }
  }

  /** Breathe out and pause (the film has come to rest); `playFrom` resumes. Idempotent. */
  hold(fade = 1.2) {
    const el = this.el;
    if (!el || el.paused || this.holding) return;
    this.holding = true;
    this.fadeTo(0, fade);
    window.clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      if (this.holding) el.pause();
      this.holding = false;
    }, fade * 1000 + 120);
  }

  /** Scale the volume (0..1) — e.g. with the film's speed as it comes to rest. Per-frame safe. */
  setLevel(level: number) {
    const l = Math.min(1, Math.max(0, level));
    if (Math.abs(l - this.level) < 0.01) return;
    this.level = l;
    if (this.el && !this.el.paused && !this.holding) this.fadeTo(MUSIC.volume * l, 0.25);
  }

  disable() {
    this.wanted = false;
    this.fadeTo(0, 0.8);
    const el = this.el;
    if (!el) return;
    window.clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      if (!this.wanted) el.pause();
    }, 900);
    // With the sound off, the audio graph stops too (it kept rendering silence for the rest of the
    // visit); enable() and playFrom() resume it, and the effects only play into a running context.
    window.clearTimeout(this.sleepTimer);
    this.sleepTimer = window.setTimeout(() => {
      if (!this.wanted && this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined);
    }, 4000);
    if (this.state === 'playing') this.state = 'idle';
  }

  private silence() {
    const g = this.gain;
    const ctx = this.ctx;
    if (g && ctx) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(0, ctx.currentTime);
    } else if (this.el && this.fallback) this.el.volume = 0;
  }

  private fadeTo(v: number, seconds: number) {
    const g = this.gain;
    const ctx = this.ctx;
    if (g && ctx) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(v, ctx.currentTime, Math.max(0.05, seconds / 3));
    } else if (this.el && this.fallback) this.el.volume = v;
    // (Before the graph exists nothing is playing, so there is nothing to fade — and touching the
    // element's volume then would silence it once the graph takes over.)
  }

  /**
   * How muffled the track sounds: 0 = in the open, 1 = heard through concrete.
   * Smoothed, so it can be called every frame.
   */
  setMuffle(amount: number) {
    const f = this.filter;
    const ctx = this.ctx;
    if (!f || !ctx) return;
    const open = Math.min(20000, ctx.sampleRate * 0.45);
    const hz = open * Math.pow(1200 / open, Math.min(1, Math.max(0, amount)));
    // (Sent only when it moves: re-sending the same target changes nothing.)
    if (Math.abs(hz - this.muffleHz) < 0.1) return;
    this.muffleHz = hz;
    f.frequency.setTargetAtTime(hz, ctx.currentTime, 0.35);
  }

  /** Brief dip, for the push through the door. */
  duck(depth = 0.45, seconds = 1.2) {
    if (!this.wanted) return;
    this.fadeTo(MUSIC.volume * this.level * (1 - depth), 0.25);
    window.setTimeout(() => {
      if (this.wanted) this.fadeTo(MUSIC.volume * this.level, seconds);
    }, seconds * 400);
  }

  /**
   * The page's own comings and goings. On a phone (`quietWhenHidden`) the sound pauses while the page
   * is hidden — another app, the screen locked — as an app's would (a desktop tab plays on behind the
   * others); coming back, it picks up where it was. And wherever the system itself took the audio
   * away (iOS: a call, Siri, another app's sound — the context left 'interrupted' or suspended), it
   * is resumed as the page comes back, or else on the visitor's next touch or key: never without one
   * where the browser asks for one. Returns the cleanup.
   */
  watchPage(quietWhenHidden: boolean) {
    const onVisibility = () => {
      if (!document.hidden) return this.wake();
      const el = this.el;
      if (!quietWhenHidden || !this.wanted || !el) return;
      // The score, if it is playing (not resting: the film's own pause keeps its place)…
      if (!el.paused && !this.holding) {
        this.away = true;
        this.silence();
        el.pause();
      }
      // …and the effects' beds with it: the whole graph stops.
      if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined);
    };
    const onShow = () => this.wake();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onShow);
    this.watching = true;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onShow);
      this.watching = false;
      this.disarm();
    };
  }

  /** The context changed state on its own (listened to from when it is built, in the first gesture). */
  private onContextState = () => {
    if (this.watching && !document.hidden) this.wake();
  };

  /** Back on the page: whatever was playing plays again (if the visitor still wants sound). */
  private wake() {
    const el = this.el;
    const ctx = this.ctx;
    if (!this.wanted || !el) {
      this.away = false;
      return;
    }
    const resumeEl = this.away && el.paused;
    const resumeCtx = !!ctx && ctx.state !== 'running' && ctx.state !== 'closed';
    if (!resumeEl && !resumeCtx) return;
    const go = async () => {
      try {
        const playing = resumeEl ? el.play() : null;
        await ctx?.resume();
        await playing;
        if (ctx && ctx.state !== 'running') throw new Error('audio context not running');
        this.away = false;
        this.disarm();
        // (A score resting — the film's own pause — stays at rest: playFrom brings it back.)
        if (resumeEl || (this.state === 'playing' && !this.holding && !el.paused)) {
          this.state = 'playing';
          this.fadeTo(MUSIC.volume * this.level, 0.8);
        }
      } catch {
        this.arm(go);
      }
    };
    void go();
  }

  private arm(go: () => void) {
    if (this.retry) return;
    const once = () => {
      this.disarm();
      go();
    };
    this.retry = once;
    for (const t of ['touchend', 'click', 'keydown'] as const) window.addEventListener(t, once, { capture: true, passive: true });
  }

  private disarm() {
    const once = this.retry;
    if (!once) return;
    this.retry = null;
    for (const t of ['touchend', 'click', 'keydown'] as const) window.removeEventListener(t, once, { capture: true });
  }

  destroy() {
    this.wanted = false;
    this.disarm();
    window.clearTimeout(this.holdTimer);
    window.clearTimeout(this.sleepTimer);
    this.el?.pause();
    this.el = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const music = new MusicPlayer();
