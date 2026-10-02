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

const g = (photo: number, path: string, category: GalleryCategory, caption?: string): GalleryItem => ({
  media: {
    ...siteMedia(`gallery.${path}`, path, caption ?? `ACM-CEG ${category} photograph`, caption),
    src: `/media/explore/gallery/${photo}.jpg`,
  },
  category,
});

// Only the supplied photographs, in numeric asset order. There is no 9.jpg;
// 10.jpg follows 8.jpg without reserving a blank entry. Retain each photo's metadata.
export const GALLERY: GalleryItem[] = [
  g(1, 'venue-gallery/1.jpg', 'events', 'CodHer Hackathon'),
  g(2, 'venue-gallery/2.jpg', 'workshops'),
  g(3, 'venue-gallery/3.jpg', 'competitions'),
  g(4, 'venue-gallery/4.jpg', 'social'),
  g(5, 'venue-gallery/5.jpg', 'events'),
  g(6, 'venue-gallery/6.jpg', 'workshops'),
  g(7, 'venue-gallery/7.jpg', 'competitions'),
  g(8, 'venue-gallery/8.jpg', 'social'),
  g(10, 'venue-gallery/10.jpeg', 'workshops'),
  g(11, 'venue-gallery/11.png', 'competitions'),
  g(12, 'venue-gallery/12.png', 'social'),
  g(13, 'gallery/10.jpg', 'events'),
  g(14, 'gallery/11.jpg', 'workshops'),
  g(15, 'gallery/12.jpg', 'competitions', 'Prodigy Event'),
  g(16, 'gallery/13.jpg', 'social'),
];
