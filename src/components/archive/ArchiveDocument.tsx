/**
 * The printed edition: every piece of chapter content as a semantic, editorial
 * HTML document. Rendered on the server (crawlable), used as the /archive page,
 * the in-experience "text version", and the fallback when WebGL is unavailable.
 */
import Image from 'next/image';
import { ALUMNI } from '@/content/alumni';
import { CHAPTER } from '@/content/chapter';
import { EVENTS } from '@/content/events';
import { FAQ } from '@/content/faq';
import { GALLERY } from '@/content/gallery';
import { isAvailable, type MediaAsset } from '@/content/media';
import { NEWSLETTER } from '@/content/newsletter';
import { PRODIGY_PROGRAMME } from '@/content/prodigy';
import { FACULTY } from '@/content/team';
import { TEAM_DOMAINS } from '@/content/teams';

function Photo({ media, className, label, size = [1200, 900] }: { media?: MediaAsset; className?: string; label?: string; size?: readonly [number, number] }) {
  if (media && isAvailable(media.src)) {
    const portrait = className === 'portrait';
    return <Image className={className} src={media.src} alt={media.alt}
      width={size[0]} height={size[1]}
      style={{ height: 'auto', aspectRatio: portrait ? `${size[0]} / ${size[1]}` : undefined }}
      sizes={portrait ? '(max-width: 760px) 128px, 180px' : '(max-width: 900px) 50vw, 25vw'}
      quality={90} loading="lazy" decoding="async" />;
  }
  return (
    <div className={`${className ?? ''} photo-slot`} role="img" aria-label={media?.alt ?? label ?? 'Photograph'}>
      <span>{label ?? media?.caption ?? media?.alt}</span>
    </div>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Locale-independent so server and client render identically. */
const formatMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

const TOC = [
  ['about', 'About'],
  ['programmes', 'Programmes'],
  ['gallery', 'Gallery'],
  ['team', 'Crew'],
  ['alumni', 'Alumni'],
  ['newsletter', 'Newsletter'],
  ['faq', 'FAQ'],
  ['contact', 'Contact'],
] as const;

export function ArchiveDocument({ headingLevel = 1 }: { headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <article className="archive">
      <header className="archive-mast">
        <p className="kicker">
          {CHAPTER.institution} · {CHAPTER.university} · {CHAPTER.city}
        </p>
        <H className="archive-title">
          ACM <span>·</span> CEG
        </H>
        <p className="archive-sub">
          <em>Student Chapter of the {CHAPTER.acmFullForm}.</em> Since {CHAPTER.established}.
        </p>
        <nav aria-label="Sections" className="archive-toc">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
      </header>

      <section id="about" className="archive-section" aria-labelledby="about-h">
        <p className="section-no">01</p>
        <h2 id="about-h">About the chapter</h2>
        <div className="cols">
          <div>
            <p className="lede">{CHAPTER.about}</p>
            <p>{CHAPTER.whatIsAcm}</p>
            <p>{CHAPTER.whatWeDo}</p>
          </div>
          <aside>
            <h3>Mission</h3>
            <p className="quote">{CHAPTER.mission}</p>
            <dl className="facts">
              <div>
                <dt>Open to</dt>
                <dd>{CHAPTER.membership.openTo}</dd>
              </div>
              <div>
                <dt>Membership fee</dt>
                <dd>{CHAPTER.membership.fee}</dd>
              </div>
              <div>
                <dt>Joining</dt>
                <dd>{CHAPTER.membership.howToJoin}</dd>
              </div>
            </dl>
          </aside>
        </div>
        <ul className="stats" aria-label="Legacy">
          {CHAPTER.legacy.stats.map((s) => (
            <li key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
        <p className="muted">{CHAPTER.legacy.text}</p>
      </section>

      <section id="programmes" className="archive-section" aria-labelledby="programmes-h">
        <p className="section-no">02</p>
        <h2 id="programmes-h">Programmes &amp; events</h2>
        <div className="events">
          {EVENTS.map((e, i) => (
            <article key={e.slug} id={e.slug} className={`event ${e.flagship ? 'flagship' : ''}`} style={{ ['--accent' as string]: e.accent }}>
              <p className="kicker">
                {String(i + 1).padStart(2, '0')} · {e.kind} · {e.cadence}
                {e.flagship ? ' · Flagship' : ''}
              </p>
              <h3>
                <a href={`/events/${e.slug}`}>{e.title}</a>
              </h3>
              <p className="lede">{e.summary}</p>
              <p>{e.description}</p>
              <dl className="facts">
                {e.facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              {e.links.length > 0 && (
                <p className="links">
                  {e.links.map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label} ↗
                    </a>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
        <h3 id="prodigy-events">At Prodigy</h3>
        <ol className="programme">
          {PRODIGY_PROGRAMME.map((p) => (
            <li key={p.title}>
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="gallery" className="archive-section" aria-labelledby="gallery-h">
        <p className="section-no">03</p>
        <h2 id="gallery-h">Gallery</h2>
        <div className="gallery">
          {GALLERY.map((g, i) => (
            <figure key={g.media.id}>
              <Photo media={g.media} className="gallery-img" label={`${String(i + 1).padStart(2, '0')} · ${g.category}`} />
              <figcaption>
                {g.media.caption ?? g.category} <span>{g.category}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="team" className="archive-section" aria-labelledby="team-h">
        <p className="section-no">04</p>
        <h2 id="team-h">The crew</h2>
        <h3>Founder &amp; faculty</h3>
        <ul className="people faculty">
          {FACULTY.map((f) => (
            <li key={f.id}>
              <Photo media={f.photo} className="portrait" label={f.name} size={f.photoSize} />
              <div>
                <strong>{f.name}</strong>
                <span className="role">{f.role}</span>
                {f.bio && <p>{f.bio}</p>}
              </div>
            </li>
          ))}
        </ul>
        <h3>The domains · {TEAM_DOMAINS.length}</h3>
        {TEAM_DOMAINS.map((d) => (
          <div key={d.slug} className="domain" id={d.slug} style={{ ['--accent' as string]: d.tone }}>
            <h4>
              <span className="domain-no">{String(d.number).padStart(2, '0')}</span> {d.name}
            </h4>
            <ul className="people names">
              {d.members.map((m) => (
                <li key={m}>
                  <strong>{m}</strong>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section id="alumni" className="archive-section" aria-labelledby="alumni-h">
        <p className="section-no">05</p>
        <h2 id="alumni-h">Alumni · office bearers</h2>
        <div className="alumni">
          {ALUMNI.map((y) => (
            <div key={y.year}>
              <h3>{y.year}</h3>
              <ul className="plain">
                {y.bearers.map((b) => (
                  <li key={b.name + b.position}>
                    {b.linkedin ? (
                      <a href={b.linkedin} target="_blank" rel="noopener noreferrer">
                        {b.name}
                      </a>
                    ) : (
                      b.name
                    )}{' '}
                    <span className="role">{b.position}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="newsletter" className="archive-section" aria-labelledby="newsletter-h">
        <p className="section-no">06</p>
        <h2 id="newsletter-h">{NEWSLETTER.title} — the newsletter</h2>
        <p className="muted">Formerly {NEWSLETTER.formerly}.</p>
        <ul className="issues">
          {NEWSLETTER.issues.map((n) => (
            <li key={n.href}>
              <a href={n.href} target="_blank" rel="noopener noreferrer">
                {n.name}
              </a>
              <time dateTime={n.date}>{formatMonth(n.date)}</time>
              {n.latest && <span className="badge">Latest</span>}
            </li>
          ))}
        </ul>
        <p>
          <a href={NEWSLETTER.archiveUrl} target="_blank" rel="noopener noreferrer">
            Full archive ↗
          </a>
        </p>
      </section>

      <section id="faq" className="archive-section" aria-labelledby="faq-h">
        <p className="section-no">07</p>
        <h2 id="faq-h">Frequently asked</h2>
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <section id="contact" className="archive-section" aria-labelledby="contact-h">
        <p className="section-no">08</p>
        <h2 id="contact-h">Get in touch</h2>
        <div className="cols">
          <address>
            {CHAPTER.contact.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
            <span className="muted">{CHAPTER.contact.officeNote}</span>
          </address>
          <ul className="plain">
            <li>
              <a href={`mailto:${CHAPTER.contact.email}`}>{CHAPTER.contact.email}</a>
            </li>
            {CHAPTER.contact.phones.map((p) => (
              <li key={p.number}>
                {p.name} — <a href={`tel:${p.number.replace(/\s/g, '')}`}>{p.number}</a>
              </li>
            ))}
            {CHAPTER.socials.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <footer className="archive-foot">
        <p>
          © ACM-CEG Student Chapter · {CHAPTER.institution}, {CHAPTER.university}
        </p>
        <p>
          Campus map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap contributors
          </a>{' '}
          (ODbL).
        </p>
      </footer>
    </article>
  );
}
