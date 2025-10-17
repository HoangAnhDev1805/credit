import type { MetadataRoute } from 'next'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  try {
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
    const res = await fetch(`${base}/api/config/public`, { cache: 'no-store' })
    const data = await res.json()
    const general = data?.data?.general || {}
    const seo = data?.data?.seo || {}

    const name = seo.site_title || 'Credit Card Checker'
    const short_name = (seo.site_title || 'CCC').slice(0, 12)
    const icon = general.site_favicon || '/favicon.ico'

    return {
      name,
      short_name,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#111827',
      icons: [
        {
          src: icon,
          sizes: '48x48 72x72 96x96 128x128 256x256',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    }
  } catch {
    return {
      name: 'Credit Card Checker',
      short_name: 'CCC',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#111827',
      icons: [
        { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' }
      ]
    }
  }
}

