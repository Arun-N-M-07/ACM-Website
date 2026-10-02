import type { Metadata } from 'next';
import { ArchiveDocument } from '@/components/archive/ArchiveDocument';

export const metadata: Metadata = {
  title: 'The chapter in print',
  description:
    'Everything about the ACM-CEG Student Chapter on one page: programmes and events, Prodigy and CodHer, the crew, alumni, the Stack’D newsletter, FAQ and contact.',
  alternates: { canonical: '/archive' },
};

export default function ArchivePage() {
  return (
    <main className="archive-page chapter-edition">
      <p className="archive-back">
        <a className="text-link" href="/">
          ← Enter the 3D journey
        </a>
      </p>
      <ArchiveDocument headingLevel={1} />
    </main>
  );
}
