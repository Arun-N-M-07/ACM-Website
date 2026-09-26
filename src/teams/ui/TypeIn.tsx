'use client';
/**
 * Text that types itself in, a character at a time, behind a small caret —
 * the way the reference's interface text arrives. The untyped remainder is
 * laid out invisibly, so lines never reflow while typing; assistive tech gets
 * the whole text at once. Reduced motion shows it immediately.
 */
import { useEffect, useState } from 'react';
import { useExperience } from '@/store/experience';

export function TypeIn({ text, delay = 0, cps = 64 }: { text: string; delay?: number; cps?: number }) {
  const reduced = useExperience((s) => s.reducedMotion);
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) {
      setN(text.length);
      return;
    }
    setN(0);
    let raf = 0;
    const t0 = performance.now() + delay * 1000;
    const tick = () => {
      const k = Math.max(0, Math.floor(((performance.now() - t0) / 1000) * cps));
      setN(Math.min(text.length, k));
      if (k < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, cps, reduced]);
  const typing = n < text.length;
  return (
    <>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {typing && n > 0 && <span className="type-caret" />}
        <span className="type-rest">{text.slice(n)}</span>
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
