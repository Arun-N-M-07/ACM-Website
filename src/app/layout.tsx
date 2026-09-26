import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import type { ReactNode } from 'react';
import { KEYWORDS, SITE_DESCRIPTION, SITE_TITLE, SITE_URL, organizationJsonLd } from '@/lib/seo';
import './globals.css';
import '@/teams/ui/teams.css';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const sans = Archivo({ subsets: ['latin'], variable: '--font-sans', axes: ['wdth'], display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

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
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      </body>
    </html>
  );
}
