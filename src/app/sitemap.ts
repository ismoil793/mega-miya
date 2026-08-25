import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXTAUTH_URL || 'https://mega-miya.vercel.app').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: siteUrl,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1,
  }];
}
