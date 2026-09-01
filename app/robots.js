// Robots.txt configuration for BURNBOARD - Allow all search crawlers

export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://burnboard.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
