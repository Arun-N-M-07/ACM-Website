/**
 * Event gallery. Source: https://auceg.acm.org/gallery.html (+ captions from the home page).
 * Categories match the filters used on the source gallery.
 */
import { siteMedia, type MediaAsset } from './media';

export type GalleryCategory = 'events' | 'workshops' | 'competitions' | 'social';

export interface GalleryItem {
  media: MediaAsset;
  category: GalleryCategory;
}

const g = (path: string, category: GalleryCategory, caption?: string): GalleryItem => ({
  media: siteMedia(`gallery.${path}`, path, caption ?? `ACM-CEG ${category} photograph`, caption),
  category,
});

export const GALLERY: GalleryItem[] = [
  g('venue-gallery/1.jpg', 'events', 'CodHer Hackathon'),
  g('venue-gallery/2.jpg', 'workshops'),
  g('venue-gallery/3.jpg', 'competitions'),
  g('venue-gallery/4.jpg', 'social'),
  g('venue-gallery/5.jpg', 'events'),
  g('venue-gallery/6.jpg', 'workshops'),
  g('venue-gallery/7.jpg', 'competitions'),
  g('venue-gallery/8.jpg', 'social'),
  g('venue-gallery/9.jpeg', 'events'),
  g('venue-gallery/10.jpeg', 'workshops'),
  g('venue-gallery/11.png', 'competitions'),
  g('venue-gallery/12.png', 'social'),
  g('gallery/10.jpg', 'events'),
  g('gallery/11.jpg', 'workshops'),
  g('gallery/12.jpg', 'competitions', 'Prodigy Event'),
  g('gallery/13.jpg', 'social'),
  g('gallery/14.jpg', 'events'),
  g('gallery/15.jpg', 'workshops', 'Team Building'),
  g('gallery/16.jpg', 'competitions'),
  g('about/about1.jpg', 'social'),
  g('gallery/8.jpg', 'workshops', 'Tech Workshop'),
];
