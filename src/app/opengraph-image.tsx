import { ImageResponse } from 'next/og';

export const alt = 'ACM-CEG Student Chapter — College of Engineering Guindy, Anna University';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Typographic share card: the lockup over the CEG red. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#0b0b0c',
          color: '#efe9df',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 22, letterSpacing: 6, opacity: 0.6 }}>COLLEGE OF ENGINEERING GUINDY · ANNA UNIVERSITY · CHENNAI</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.85 }}>
          <div style={{ fontSize: 230, letterSpacing: -6 }}>ACM</div>
          <div style={{ fontSize: 230, letterSpacing: -6, color: '#a8412f' }}>CEG</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28 }}>
          <span style={{ fontStyle: 'italic' }}>Student Chapter — since 2004</span>
          <span style={{ opacity: 0.6 }}>auceg.acm.org</span>
        </div>
      </div>
    ),
    size,
  );
}
