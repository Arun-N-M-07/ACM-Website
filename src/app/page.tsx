import { ArchiveDocument } from '@/components/archive/ArchiveDocument';
import { ArchiveLayerControls } from '@/components/archive/ArchiveLayerControls';
import { Experience } from '@/components/experience/Experience';

/**
 * Home: the immersive journey, plus the complete chapter as server-rendered
 * HTML in the #archive layer (the text version / no-WebGL edition), so every
 * fact on the page is crawlable and reachable without the 3D.
 */
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#archive">
        Skip the 3D journey — read ACM-CEG as a page
      </a>
      <main id="journey">
        <Experience />
      </main>
      <div id="archive" className="archive-layer" data-lenis-prevent inert>
        <ArchiveLayerControls />
        <ArchiveDocument headingLevel={2} />
      </div>
    </>
  );
}
