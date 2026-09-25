/** An architectural cutaway of the journey, drawn from the actual room layout. */
import { CORRIDOR, TEAM_LAYOUT } from '@/config/world';
import { CHAPTER } from '@/content/chapter';

export function WorldMap() {
  return (
    <svg className="world-map" viewBox="0 0 600 530" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="map-plane" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#98bde9" stopOpacity=".09" />
          <stop offset="1" stopColor="#98bde9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="map-guides" stroke="currentColor" strokeOpacity=".12" strokeDasharray="2 7">
        <path d="M80 136V388M300 40V300M520 136V388M300 232V484" />
        <path d="M40 500H560M40 25H560" />
      </g>
      <g className="map-layer map-campus">
        <path className="map-plane" d="M80 136 300 40 520 136 300 232Z" />
        <g stroke="#b5c4d0" strokeWidth="1">
          <path d="M143 143 300 75 457 143 300 211Z" strokeOpacity=".2" />
          <path d="M240 155 300 130 360 155 300 181Z" strokeOpacity=".4" />
          <path d="M275 171 300 160 325 171 300 182Z M280 181 300 172 320 181 300 190Z" />
        </g>
        <g stroke="#d78569" strokeLinejoin="round">
          <path d="M174 128V104L282 57 426 120V144L282 81Z" fill="#a8412f" fillOpacity=".16" />
          <path d="M174 104 318 167 426 120M318 167V191L174 128M318 191 426 144M210 120V143M246 136V159M354 151V175M390 136V160" />
          <path d="M277 144V87L295 79 316 88V161M277 87 297 96 316 88M297 96V162M280 85V73L297 66 314 74V86M284 73Q297 46 310 74" fill="#241b1b" />
          <path d="M285 146V132Q290 119 295 136V150" />
          <ellipse cx="289" cy="108" rx="4" ry="6" />
        </g>
        <circle cx="300" cy="191" r="4" fill="#e8b184" />
      </g>
      <path className="map-signal" d="M300 191V238L266 253 306 270 274 284 311 300V352L262 374 300 401 338 384 300 367V438" />
      <g className="map-layer map-events">
        <path className="map-plane" d="M80 262 300 166 520 262 300 358Z" />
        <g transform="translate(300 238) matrix(1 .44 -1 .44 0 0)" stroke="#8eafda">
          <path d="M-5 0H5V100H-5Z" fill="#83b9ff" fillOpacity=".1" />
          {CORRIDOR.rooms.map((r, i) => (
            <rect key={r.event.slug} x={r.side < 0 ? -37 : 5} y={i * 8 + 4} width="32" height="12" stroke={r.event.accent} fill={r.event.accent} fillOpacity=".08" />
          ))}
        </g>
      </g>
      <g className="map-layer map-team">
        <path className="map-plane" d="M80 388 300 292 520 388 300 484Z" />
        <g transform="translate(300 342) matrix(1 .44 -1 .44 0 0)" stroke="#b6b3aa">
          <rect x="-57" y="0" width="114" height="103" />
          {TEAM_LAYOUT.bays.map((b) => <rect key={b.domain.id} x={b.x * 2.5 - 8} y={-b.z * 1.6 - 8} width="16" height="14" stroke={b.domain.accent} />)}
          <circle cx="0" cy="53" r="17" stroke="#ffb86b" />
          <circle cx="0" cy="53" r="10" stroke="#ffb86b" strokeOpacity=".4" />
        </g>
      </g>
      <g className="map-annotations" fill="currentColor">
        <text x="405" y="65">01 / THE CAMPUS</text>
        <text x="405" y="210">02 / THE PROGRAMMES</text>
        <text x="405" y="338">03 / THE PEOPLE</text>
        <text x="60" y="508">ONE CONNECTED WORLD</text>
        <text x="460" y="508">EST. {CHAPTER.established}</text>
      </g>
      <g stroke="currentColor" strokeOpacity=".3"><path d="M400 70H377L350 92M400 216H377L353 246M400 345H377L350 370" /></g>
      <circle className="map-core" cx="300" cy="388" r="6" fill="#ffb86b" />
    </svg>
  );
}
