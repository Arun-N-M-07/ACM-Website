/**
 * One server-rendered chapter publication, shared by the printed route, Text
 * Version and no-WebGL fallback. Content stays in the existing content modules.
 */
import Image from 'next/image';
import { ALUMNI } from '@/content/alumni';
import { CHAPTER } from '@/content/chapter';
import { EVENTS } from '@/content/events';
import { FAQ } from '@/content/faq';
import { GALLERY } from '@/content/gallery';
import { NEWSLETTER } from '@/content/newsletter';
import { PRODIGY_PROGRAMME } from '@/content/prodigy';
import { FACULTY } from '@/content/team';
import { CrewPeople } from '@/components/editorial/CrewPublication';
import type { MediaAsset } from '@/content/media';

const TOC = [
  ['about', 'Chapter'], ['programmes', 'Programmes'], ['gallery', 'Gallery'],
  ['team', 'Crew'], ['alumni', 'Alumni'], ['newsletter', 'Newsletter'],
  ['faq', 'FAQ'], ['contact', 'Contact'],
] as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const formatMonth = (iso: string) => {
  const [year, month] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
};

function SectionHeading({ id, number, title }: { id: string; number: string; title: string }) {
  return <header className="chapter-section-head">
    <p className="publication-label">{number}</p>
    <h2 id={id}>{title}</h2>
  </header>;
}

/** Title / photograph / copy: the same editorial measure throughout the chapter. */
function EditorialRow({ title, image, text }: { title: string; image: MediaAsset; text: string }) {
  return <section className="publication-row">
    <h3>{title}</h3>
    <figure>
      <Image src={image.src} alt={image.alt} width={1200} height={1200}
        sizes="(max-width: 640px) 94vw, (max-width: 1000px) 54vw, 33vw" quality={90} loading="lazy" />
    </figure>
    <p>{text}</p>
  </section>;
}

export function ArchiveDocument({ headingLevel = 1 }: { headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  return <article className="publication chapter-publication">
    <header className="chapter-mast">
      <p className="publication-kicker">{CHAPTER.institution} · {CHAPTER.university} · {CHAPTER.city}</p>
      <H className="chapter-title">ACM-CEG</H>
      <div className="chapter-deck">
        <p className="publication-label">Since {CHAPTER.established}</p>
        <p>Student Chapter of the {CHAPTER.acmFullForm}.</p>
      </div>
      <nav className="editorial-index" aria-label="Sections">
        {TOC.map(([id, label], i) => <a key={id} href={`#${id}`}><span>{String(i + 1).padStart(2, '0')}</span>{label}</a>)}
      </nav>
    </header>

    <div className="chapter-body">
      <section id="about" className="chapter-section" aria-labelledby="about-h">
        <div className="publication-intro">
          <h2 id="about-h" className="publication-title">About the chapter</h2>
          <p>{CHAPTER.whatIsAcm}</p>
          <div className="chapter-membership">
            <p>{CHAPTER.membership.openTo}</p>
            <p>{CHAPTER.membership.fee}</p>
            <p className="publication-copy">{CHAPTER.membership.howToJoin}</p>
          </div>
        </div>
        <p className="publication-label publication-section-label">Purpose &amp; perspective</p>
        <EditorialRow title={`Since ${CHAPTER.established}`} image={GALLERY[4].media} text={CHAPTER.about} />
        <EditorialRow title="Our mission" image={GALLERY[1].media} text={CHAPTER.mission} />
        <EditorialRow title="What we do" image={GALLERY[0].media} text={CHAPTER.whatWeDo} />
        <div className="chapter-legacy">
          <ul aria-label="Legacy">{CHAPTER.legacy.stats.map(s => <li key={s.label}><strong>{s.value}</strong><span>{s.label}</span></li>)}</ul>
          <p className="publication-copy">{CHAPTER.legacy.text}</p>
        </div>
      </section>

      <section id="programmes" className="chapter-section" aria-labelledby="programmes-h">
        <SectionHeading id="programmes-h" number="02 · Programmes" title="Programmes & events" />
        <div className="chapter-events">
          {EVENTS.map((event, i) => <article key={event.slug} id={event.slug} className="chapter-event">
            <header>
              <p className="publication-kicker">{String(i + 1).padStart(2, '0')} · {event.kind} · {event.cadence}{event.flagship ? ' · Flagship' : ''}</p>
              <h3><a href={`/events/${event.slug}`}>{event.title}</a></h3>
            </header>
            <div className="chapter-event-story">
              <p className="chapter-event-lede">{event.summary}</p>
              <p className="publication-copy">{event.description}</p>
            </div>
            <div>
              <dl className="publication-facts">{event.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
              {event.links.length > 0 && <p className="publication-links">{event.links.map(link =>
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>
              )}</p>}
            </div>
          </article>)}
        </div>
        <div className="chapter-subhead"><h3 id="prodigy-events">At Prodigy</h3></div>
        <ol className="chapter-programme">{PRODIGY_PROGRAMME.map((item, i) => <li key={item.title}>
          <span className="publication-label">{String(i + 1).padStart(2, '0')}</span>
          <h4>{item.title}</h4><p className="publication-copy">{item.text}</p>
        </li>)}</ol>
      </section>

      <section id="gallery" className="chapter-section" aria-labelledby="gallery-h">
        <SectionHeading id="gallery-h" number="03 · In photographs" title="Gallery" />
        <div className="chapter-gallery">{GALLERY.map((item, i) => <figure key={item.media.id}>
          <Image src={item.media.src} alt={item.media.alt} width={1200} height={900}
            sizes="(max-width: 640px) 94vw, (max-width: 1000px) 47vw, 33vw" quality={90} loading="lazy" />
          <figcaption><span>{String(i + 1).padStart(2, '0')} · {item.media.caption ?? item.category}</span><span>{item.category}</span></figcaption>
        </figure>)}</div>
      </section>

      <section id="team" className="chapter-section" aria-labelledby="team-h">
        <SectionHeading id="team-h" number="04 · The chapter's people" title="Founder & faculty" />
        <div className="chapter-faculty">{FACULTY.map(faculty => <article key={faculty.id} className="publication-row faculty-row">
          <header><h3>{faculty.name}</h3><p className="publication-label">{faculty.role}</p></header>
          <figure><Image src={faculty.photo.src} alt={faculty.name} width={faculty.photoSize[0]} height={faculty.photoSize[1]}
            sizes="(max-width: 640px) 80vw, 30vw" quality={90} loading="lazy" /></figure>
          {faculty.bio && <p>{faculty.bio}</p>}
        </article>)}</div>
        <CrewPeople prefix="archive-crew" />
      </section>

      <section id="alumni" className="chapter-section" aria-labelledby="alumni-h">
        <SectionHeading id="alumni-h" number="05 · The network" title="Alumni & office bearers" />
        <div className="chapter-alumni">{ALUMNI.map(year => <section key={year.year}>
          <h3>{year.year}</h3><ul>{year.bearers.map(bearer => <li key={bearer.name + bearer.position}>
            {bearer.linkedin ? <a href={bearer.linkedin} target="_blank" rel="noopener noreferrer">{bearer.name} ↗</a> : <span>{bearer.name}</span>}
            <span className="publication-label">{bearer.position}</span>
          </li>)}</ul>
        </section>)}</div>
      </section>

      <section id="newsletter" className="chapter-section" aria-labelledby="newsletter-h">
        <SectionHeading id="newsletter-h" number="06 · The newsletter" title={NEWSLETTER.title} />
        <div className="chapter-reading">
          <p className="publication-label">Formerly {NEWSLETTER.formerly}.</p>
          <div><ul className="chapter-issues">{NEWSLETTER.issues.map(issue => <li key={issue.href}>
            <a href={issue.href} target="_blank" rel="noopener noreferrer">{issue.name} ↗</a>
            <time dateTime={issue.date}>{formatMonth(issue.date)}</time>
            {issue.latest && <span className="publication-label">Latest</span>}
          </li>)}</ul>
          <p className="publication-links"><a href={NEWSLETTER.archiveUrl} target="_blank" rel="noopener noreferrer">Full archive ↗</a></p></div>
        </div>
      </section>

      <section id="faq" className="chapter-section" aria-labelledby="faq-h">
        <SectionHeading id="faq-h" number="07 · Questions" title="Frequently asked" />
        <div className="chapter-reading"><span className="publication-label">FAQ</span><div>
          {FAQ.map(item => <details key={item.q}><summary>{item.q}</summary><p className="publication-copy">{item.a}</p></details>)}
        </div></div>
      </section>

      <section id="contact" className="chapter-section" aria-labelledby="contact-h">
        <SectionHeading id="contact-h" number="08 · Contact" title="Get in touch" />
        <div className="chapter-reading">
          <address>{CHAPTER.contact.address.map(line => <span key={line}>{line}</span>)}<p className="publication-copy">{CHAPTER.contact.officeNote}</p></address>
          <ul className="chapter-contact">
            <li><a href={`mailto:${CHAPTER.contact.email}`}>{CHAPTER.contact.email}</a></li>
            {CHAPTER.contact.phones.map(phone => <li key={phone.number}><span>{phone.name}</span><a href={`tel:${phone.number.replace(/\s/g, '')}`}>{phone.number}</a></li>)}
            {CHAPTER.socials.map(social => <li key={social.href}><a href={social.href} target="_blank" rel="noopener noreferrer">{social.label} ↗</a></li>)}
          </ul>
        </div>
      </section>

      <footer className="chapter-foot">
        <p>© ACM-CEG Student Chapter · {CHAPTER.institution}, {CHAPTER.university}</p>
        <p>Campus map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL).</p>
      </footer>
    </div>
  </article>;
}
