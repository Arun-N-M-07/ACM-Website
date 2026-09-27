import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda } from 'next/font/google';
import type { ReactNode } from 'react';
import { KEYWORDS, SITE_DESCRIPTION, SITE_TITLE, SITE_URL, organizationJsonLd } from '@/lib/seo';
import './globals.css';
import '@/teams/ui/teams.css';
import '@/intro/ui/intro.css';

/**
 * The site's one typeface: Bodoni Moda, a variable font (weight 400–900 and
 * optical size 6–96, so small labels get sturdier hairlines and large titles
 * finer ones, automatically), in roman and italic. Every role — titles, body,
 * labels, numbers — is Bodoni Moda at its own weight, size and tracking
 * (globals.css: --serif / --sans / --mono are those roles, not other families).
 */
const bodoni = Bodoni_Moda({ subsets: ['latin'], style: ['normal', 'italic'], axes: ['opsz'], variable: '--font-bodoni', display: 'swap' });

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
    <html lang="en" className={bodoni.variable}>
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
