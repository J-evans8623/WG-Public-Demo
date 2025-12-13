import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wisegraph.app';

  return [
    // 1. Home Page (Root) seo
    // Served from app/(welcome)/page.tsx
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },

    // 2. Features Page
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },

    // 3. Pricing / Offer Page
    // Your code links "Pricing" and "Start Today" to this URL
    {
      url: `${baseUrl}/billing/offer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },

    // 4. Blog Page
    // You are building this today.
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly', // Blogs change often
      priority: 0.7,
    },
  ];
}