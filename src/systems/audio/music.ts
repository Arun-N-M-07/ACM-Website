/**
 * The music player: one looping track, faded in and out, with a low-pass that
 * closes as the journey goes underground and opens again inside — so the song
 * feels like it is playing in the room you are in. No other sound is made.
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
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(el);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 20000;
      filter.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      this.ctx = ctx;
      this.filter = filter;
      this.gain = gain;
    } catch {
      // No Web Audio: fall back to plain element volume.
      this.ctx = null;
      el.volume = 0;
    }
  }

  /** Called from a user gesture (the loader's buttons, the top bar). */
  async enable() {
    this.wanted = true;
    this.build();
    const el = this.el;
    if (!el) return;
    try {
      await this.ctx?.resume();
      await el.play();
      this.state = 'playing';
      this.message = '';
      this.fadeTo(MUSIC.volume, MUSIC.fade);
    } catch (err) {
      this.state = el.error ? 'missing' : 'blocked';
      this.message = el.error ? `No audio file at ${MUSIC.src}` : String((err as Error)?.message ?? err);
    }
  }

  disable() {
    this.wanted = false;
    this.fadeTo(0, 0.8);
    const el = this.el;
    if (!el) return;
    window.setTimeout(() => {
      if (!this.wanted) el.pause();
    }, 900);
    if (this.state === 'playing') this.state = 'idle';
  }

  private fadeTo(v: number, seconds: number) {
    const g = this.gain;
    const ctx = this.ctx;
    if (g && ctx) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(v, ctx.currentTime, Math.max(0.05, seconds / 3));
    } else if (this.el) this.el.volume = v;
  }

  /**
   * How muffled the track sounds: 0 = in the open, 1 = heard through concrete.
   * Smoothed, so it can be called every frame.
   */
  setMuffle(amount: number) {
    const f = this.filter;
    const ctx = this.ctx;
    if (!f || !ctx) return;
    const hz = 20000 * Math.pow(1200 / 20000, Math.min(1, Math.max(0, amount)));
    f.frequency.setTargetAtTime(hz, ctx.currentTime, 0.35);
  }

  /** Brief dip, for the push through the door. */
  duck(depth = 0.45, seconds = 1.2) {
    if (!this.wanted) return;
    this.fadeTo(MUSIC.volume * (1 - depth), 0.25);
    window.setTimeout(() => {
      if (this.wanted) this.fadeTo(MUSIC.volume, seconds);
    }, seconds * 400);
  }

  destroy() {
    this.wanted = false;
    this.el?.pause();
    this.el = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const music = new MusicPlayer();
