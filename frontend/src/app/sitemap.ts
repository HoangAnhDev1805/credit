import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/api/config/public`, { cache: 'no-store' })
    const data = await res.json()
    const seo = data?.data?.seo || {}
    const canonical = (seo.canonical_url || '').replace(/\/$/, '')
    const siteBase = canonical || base || ''

    const routes = ['/', '/login', '/register', '/pricing', '/buy-credits']

    const now = new Date().toISOString()
    const entries: MetadataRoute.Sitemap = routes.map((path) => ({
      url: `${siteBase}${path}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: path === '/' ? 1 : 0.7,
    }))

    return entries
  } catch {
    return []
  }
}

