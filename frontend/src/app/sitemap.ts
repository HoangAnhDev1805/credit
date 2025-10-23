import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/api/config/public`, { cache: 'no-store' })
    const data = await res.json()
    const seo = data?.data?.seo || {}
    const canonical = (seo.canonical_url || '').replace(/\/$/, '')
    const siteBase = canonical || base || ''

    const routes = [
      { path: '/', priority: 1.0, changeFrequency: 'daily' as const },
      { path: '/auth/login', priority: 0.8, changeFrequency: 'weekly' as const },
      { path: '/auth/register', priority: 0.8, changeFrequency: 'weekly' as const },
      { path: '/dashboard', priority: 0.9, changeFrequency: 'daily' as const },
      { path: '/dashboard/checker', priority: 0.9, changeFrequency: 'always' as const },
      { path: '/dashboard/card-history', priority: 0.8, changeFrequency: 'daily' as const },
      { path: '/dashboard/generate', priority: 0.7, changeFrequency: 'weekly' as const },
      { path: '/dashboard/buy-credits', priority: 0.8, changeFrequency: 'weekly' as const },
      { path: '/dashboard/crypto-payment', priority: 0.7, changeFrequency: 'weekly' as const },
      { path: '/dashboard/api-docs', priority: 0.6, changeFrequency: 'monthly' as const },
      { path: '/dashboard/settings', priority: 0.5, changeFrequency: 'monthly' as const },
      { path: '/dashboard/faq', priority: 0.6, changeFrequency: 'monthly' as const },
      { path: '/dashboard/terms', priority: 0.5, changeFrequency: 'yearly' as const }
    ]

    const now = new Date().toISOString()
    const entries: MetadataRoute.Sitemap = routes.map((route) => ({
      url: `${siteBase}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }))

    return entries
  } catch {
    return []
  }
}

