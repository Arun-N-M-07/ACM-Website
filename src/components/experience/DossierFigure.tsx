/**
 * A figure for a dossier, where the event's idea has a shape: the same idea
 * its room performs, drawn as a small diagram. Only the facts and wording of
 * the event's record appear in it.
 */
import type { EventRecord } from '@/content/events';

const fact = (ev: EventRecord, label: string) => ev.facts.find((f) => f.label === label)?.value ?? '';

function Stairs({ x, n, highlight }: { x: number; n: number; highlight?: boolean }) {
  const c = 19;
  const cells = [];
  for (let col = 0; col < n; col++)
    for (let r = 0; r <= col; r++) {
      const added = highlight && col === n - 1;
      cells.push(<rect key={`${col}-${r}`} x={x + col * c} y={118 - (r + 1) * c} width={c - 3} height={c - 3} className={added ? 'fig-accent' : 'fig-solid'} />);
    }
  return <g>{cells}</g>;
}

function PatternFigure({ ev }: { ev: EventRecord }) {
  const xs = [8, 58, 134, 236];
  return (
    <svg viewBox="0 0 560 160" role="img" aria-label="Three terms of a sequence, the fourth built from the third, leading on to CodeX">
      {xs.map((x, i) => (
        <g key={x}>
          <Stairs x={x} n={i + 1} highlight={i === 3} />
          <line x1={x - 6} x2={x + (i + 1) * 19 + 2} y1={124} y2={124} className="fig-rule" />
          <text x={x} y={144} className="fig-label">
            {String(i + 1).padStart(2, '0')} · {((i + 1) * (i + 2)) / 2}
          </text>
        </g>
      ))}
      <text x={236} y={14} className="fig-label fig-accent-text">
        the last one, with one more column
      </text>
      <line x1={338} x2={420} y1={96} y2={96} className="fig-line fig-accent-stroke" markerEnd="url(#px-arrow)" />
      <text x={434} y={104} className="fig-title fig-accent-text">
        {fact(ev, 'Leads into') || 'CodeX'}
      </text>
      <text x={434} y={124} className="fig-label">
        next
      </text>
      <defs>
        <marker id="px-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" className="fig-accent-stroke" fill="none" />
        </marker>
      </defs>
    </svg>
  );
}

function OpenSourceFigure({ ev }: { ev: EventRecord }) {
  const branches = [
    { a: 70, b: 190, y: 96, m: 120 },
    { a: 170, b: 310, y: 82, m: 250 },
    { a: 290, b: 440, y: 100, m: 250 },
  ];
  return (
    <svg viewBox="0 0 560 190" role="img" aria-label="Mentors on a bridge between ACM-CEG and GDG-AU guide contributions that branch from a project and merge back into it">
      <line x1={40} x2={500} y1={34} y2={34} className="fig-line" />
      <line x1={40} x2={40} y1={34} y2={170} className="fig-rule" />
      <line x1={500} x2={500} y1={34} y2={170} className="fig-rule" />
      <text x={46} y={24} className="fig-label">ACM-CEG</text>
      <text x={494} y={24} className="fig-label" textAnchor="end">
        {fact(ev, 'With') || 'GDG-AU'}
      </text>
      {[120, 250, 380].map((x) => (
        <circle key={x} cx={x} cy={46} r={7} className="fig-ring" />
      ))}
      <text x={270} y={24} className="fig-label" textAnchor="middle">
        mentors · {fact(ev, 'Mentors').toLowerCase()}
      </text>
      <line x1={20} x2={540} y1={150} y2={150} className="fig-line" />
      {branches.map((br) => (
        <g key={br.a}>
          <path d={`M${br.a},150 C${br.a + 30},150 ${br.a + 20},${br.y} ${br.a + 50},${br.y} L${br.b - 50},${br.y} C${br.b - 20},${br.y} ${br.b - 30},150 ${br.b},150`} className="fig-branch" />
          <line x1={br.m} x2={br.b - 50} y1={53} y2={br.y} className="fig-thread" />
          <circle cx={br.b} cy={150} r={3.5} className="fig-accent" />
        </g>
      ))}
      <line x1={440} x2={540} y1={150} y2={150} className="fig-line fig-accent-stroke fig-strong" />
      <text x={540} y={176} className="fig-label fig-accent-text" textAnchor="end">
        merged · one project
      </text>
      <text x={20} y={176} className="fig-label">
        the project
      </text>
    </svg>
  );
}

function VoicesFigure({ ev }: { ev: EventRecord }) {
  const speakers = fact(ev, 'Speakers')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  const wave = Array.from({ length: 140 }, (_, i) => {
    const x = 230 + i * 2.2;
    const e = Math.exp(-(((i - 50) / 26) ** 2)) + 0.6 * Math.exp(-(((i - 100) / 16) ** 2));
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${(84 - Math.sin(i * 0.55) * 26 * e).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 560 160" role="img" aria-label="Alumni, industry experts and researchers, one line of talks on varied topics in computer science">
      {speakers.map((s, i) => (
        <g key={s}>
          <circle cx={30} cy={40 + i * 44} r={5} className="fig-accent" />
          <text x={44} y={44 + i * 44} className="fig-title-sm">
            {s[0].toUpperCase() + s.slice(1)}
          </text>
          <path d={`M176,${40 + i * 44} C204,${40 + i * 44} 206,84 230,84`} className="fig-thread" />
        </g>
      ))}
      <path d={wave} className="fig-line fig-accent-stroke" />
      <text x={540} y={146} className="fig-label" textAnchor="end">
        {fact(ev, 'Topics').toLowerCase()}
      </text>
    </svg>
  );
}

export function DossierFigure({ event }: { event: EventRecord }) {
  const figure = event.artifact === 'sequence' ? <PatternFigure ev={event} /> : event.artifact === 'contribution-graph' ? <OpenSourceFigure ev={event} /> : event.artifact === 'voices' ? <VoicesFigure ev={event} /> : null;
  if (!figure) return null;
  return <figure className="dossier-figure">{figure}</figure>;
}
