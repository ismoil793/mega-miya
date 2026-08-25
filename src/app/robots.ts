import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXTAUTH_URL || 'https://mega-miya.vercel.app').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/?success=', '/?error='],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
