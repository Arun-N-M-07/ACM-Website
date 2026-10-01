import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { KEYWORDS, SITE_DESCRIPTION, SITE_TITLE, SITE_URL, organizationJsonLd } from '@/lib/seo';
import './globals.css';
import '@/teams/ui/teams.css';
import '@/intro/ui/intro.css';
import '@/scenes/events/events.css';

/**
 * The site's shared typeface: Geist, a variable font (weight 100–900).
 * Every role — display, titles, body, navigation, labels,
 * numerals — uses Geist at its own weight and tracking: the hierarchy is
 * defined once, as tokens, in globals.css (--w-* and --t-*). The in-world
 * canvases read the same family (systems/textures/typeset). Authored sculptural
 * entrance geometry and ACM-CEG's imported 3D identity retain their letterforms.
 */
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s · ACM-CEG' },
  description: SITE_DESCRIPTION,
  keywords: KEYWORDS,
  authors: [{ name: 'ACM-CEG Student Chapter' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'ACM-CEG Student Chapter',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <head>
        {/* The journey owns its scroll position: the browser must never restore a previous one. */}
        <script dangerouslySetInnerHTML={{ __html: "if('scrollRestoration' in history)history.scrollRestoration='manual';" }} />
      </head>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      </body>
    </html>
  );
}
