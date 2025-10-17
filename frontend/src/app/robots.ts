import type { MetadataRoute } from 'next'

export default async function robots(): Promise<MetadataRoute.Robots> {
  try {
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
    const res = await fetch(`${base}/api/config/public`, { cache: 'no-store' })
    const data = await res.json()
    const seo = data?.data?.seo || {}

    const allowIndex = seo.robots_index !== false
    const allowFollow = seo.robots_follow !== false
    const advanced = (seo.robots_advanced || '').toString()
    const sitemapBase = (seo.canonical_url || base || '').replace(/\/$/, '')

    return {
      rules: [
        {
          userAgent: '*',
          allow: allowIndex ? '/' : '',
          disallow: allowIndex ? '' : '/',
        },
      ],
      sitemap: sitemapBase ? [`${sitemapBase}/sitemap.xml`] : undefined,
      host: sitemapBase || undefined,
    }
  } catch {
    return {
      rules: [
        { userAgent: '*', allow: '/' },
      ],
    }
  }
}

