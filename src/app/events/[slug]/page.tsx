import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EVENTS, eventBySlug } from '@/content/events';
import { isAvailable } from '@/content/media';

export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ev = eventBySlug(slug);
  if (!ev) return {};
  return {
    title: ev.title,
    description: ev.summary,
    alternates: { canonical: `/events/${ev.slug}` },
    openGraph: { title: `${ev.title} · ACM-CEG`, description: ev.summary, type: 'article' },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = eventBySlug(slug);
  if (!ev) notFound();
  const i = EVENTS.indexOf(ev);
  const prev = EVENTS[(i - 1 + EVENTS.length) % EVENTS.length];
  const next = EVENTS[(i + 1) % EVENTS.length];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EventSeries',
    name: ev.title,
    description: ev.description,
    organizer: { '@type': 'Organization', name: 'ACM-CEG Student Chapter' },
    location: { '@type': 'Place', name: 'College of Engineering Guindy, Anna University, Chennai' },
  };

  return (
    <main className="archive-page event-page" style={{ ['--accent' as string]: ev.accent }}>
      <p className="archive-back">
        <a className="text-link" href="/archive#programmes">
          ← All programmes
        </a>
        <a className="text-link" href={`/#${ev.slug}`}>
          See the room in the 3D journey →
        </a>
      </p>
      <article className="archive">
        <header className="archive-mast">
          <p className="kicker">
            ACM-CEG · {String(i + 1).padStart(2, '0')} · {ev.kind} · {ev.cadence}
            {ev.flagship ? ' · Flagship' : ''}
          </p>
          <h1 className="archive-title event-title">{ev.title}</h1>
          <p className="archive-sub">
            <em>{ev.summary}</em>
          </p>
        </header>
        {ev.image && isAvailable(ev.image.src) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="event-hero" src={ev.image.src} alt={ev.image.alt} />
        )}
        <section className="archive-section">
          <p className="lede">{ev.description}</p>
          <dl className="facts">
            {ev.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          {ev.programme && (
            <>
              <h2>Programme</h2>
              <ol className="programme">
                {ev.programme.map((p) => (
                  <li key={p.title}>
                    <strong>{p.title}</strong>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {ev.links.length > 0 && (
            <p className="links">
              {ev.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </p>
          )}
        </section>
        <nav className="event-pager" aria-label="Other programmes">
          <a href={`/events/${prev.slug}`}>← {prev.title}</a>
          <a href={`/events/${next.slug}`}>{next.title} →</a>
        </nav>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
