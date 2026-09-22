import type { MetadataRoute } from 'next';
import { EVENTS } from '@/content/events';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/archive`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    ...EVENTS.map((e) => ({
      url: `${SITE_URL}/events/${e.slug}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: e.flagship ? 0.8 : 0.6,
    })),
  ];
}
