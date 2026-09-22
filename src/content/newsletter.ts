/**
 * Newsletter issues. Source: https://auceg.acm.org/newsletter_index.html (clickbyte-archive.js).
 * Newest first. File links point at the PDFs hosted on the current site.
 */
export interface NewsletterIssue {
  name: string;
  /** ISO date as published in the archive. */
  date: string;
  href: string;
  latest?: boolean;
}

const pdf = (path: string) => `https://auceg.acm.org/clickbyte/${path}`;

export const NEWSLETTER = {
  title: "Stack'D",
  formerly: 'ClickByte',
  archiveUrl: 'https://auceg.acm.org/newsletter_index.html',
  issues: [
    { name: "Stack'D December 2025", date: '2025-12-25', href: pdf('january/newsletter.pdf'), latest: true },
    { name: "Stack'D November 2025", date: '2025-11-20', href: pdf('december/newsletter.pdf') },
    { name: "Stack'D September 2025", date: '2025-09-20', href: pdf('september/september_newsletter.pdf') },
    { name: 'ClickByte April 2025', date: '2025-04-10', href: pdf('april/april_newsletter.pdf') },
    { name: 'ClickByte March 2025', date: '2025-03-15', href: pdf('march/march_newsletter.pdf') },
  ] satisfies NewsletterIssue[],
};
