'use client'

import { useEffect, useState } from 'react'
import Head from 'next/head'
import { apiClient } from '@/lib/api'

// Ảnh PNG trong suốt 1x1 để tránh 404 khi chưa cấu hình logo/favicon
const TRANSPARENT_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2J4LkAAAAASUVORK5CYII=';

interface SiteConfig {
  siteName: string
  siteDescription: string
  siteKeywords: string
  seoTitle: string
  seoDescription: string
  canonicalUrl?: string
  robotsIndex?: boolean
  robotsFollow?: boolean
  robotsAdvanced?: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogType?: string
  ogSiteName?: string
  twitterCard?: string
  twitterSite?: string
  twitterCreator?: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  favicon: string
  thumbnail: string
}

export default function DynamicHead() {
  const [config, setConfig] = useState<SiteConfig | null>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await apiClient.get('/config/public')
        const siteData = response.data?.data?.general || {}
        const seoData = response.data?.data?.seo || {}
        const toAbs = (url?: string) => {
          if (!url) return ''
          if (typeof window === 'undefined') return url
          if (url.startsWith('/uploads')) {
            const base = window.location?.origin?.replace(/\/$/, '') || (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '') || 'https://checkcc.live'
            return `${base}${url}`
          }
          return url
        }

        setConfig({
          siteName: seoData.site_title || 'Credit Card Checker',
          siteDescription: seoData.site_description || 'Professional Credit Card Checking Service',
          siteKeywords: seoData.site_keywords || 'credit card, checker, validation, security',
          seoTitle: seoData.site_title || 'Credit Card Checker',
          seoDescription: seoData.site_description || 'Professional Credit Card Checking Service',
          canonicalUrl: seoData.canonical_url || '',
          robotsIndex: seoData.robots_index !== false,
          robotsFollow: seoData.robots_follow !== false,
          robotsAdvanced: seoData.robots_advanced || '',
          ogTitle: seoData.og_title || seoData.site_title || 'Credit Card Checker',
          ogDescription: seoData.og_description || seoData.site_description || 'Professional Credit Card Checking Service',
          ogImage: toAbs(siteData.site_thumbnail) || TRANSPARENT_PNG,
          ogType: seoData.og_type || 'website',
          ogSiteName: seoData.og_site_name || seoData.site_title || 'Credit Card Checker',
          twitterCard: seoData.twitter_card || 'summary_large_image',
          twitterSite: seoData.twitter_site || '',
          twitterCreator: seoData.twitter_creator || '',
          twitterTitle: seoData.site_title || 'Credit Card Checker',
          twitterDescription: seoData.site_description || 'Professional Credit Card Checking Service',
          twitterImage: toAbs(siteData.site_thumbnail) || TRANSPARENT_PNG,
          favicon: toAbs(siteData.site_favicon) || TRANSPARENT_PNG,
          thumbnail: toAbs(siteData.site_thumbnail) || TRANSPARENT_PNG
        })
      } catch (error) {
        // Fallback to default values (dùng data URI để tránh 404)
        setConfig({
          siteName: 'Credit Card Checker',
          siteDescription: 'Professional Credit Card Checking Service',
          siteKeywords: 'credit card, checker, validation, security',
          seoTitle: 'Credit Card Checker',
          seoDescription: 'Professional Credit Card Checking Service',
          canonicalUrl: '',
          robotsIndex: true,
          robotsFollow: true,
          robotsAdvanced: '',
          ogTitle: 'Credit Card Checker',
          ogDescription: 'Professional Credit Card Checking Service',
          ogImage: TRANSPARENT_PNG,
          ogType: 'website',
          ogSiteName: 'Credit Card Checker',
          twitterCard: 'summary_large_image',
          twitterSite: '',
          twitterCreator: '',
          twitterTitle: 'Credit Card Checker',
          twitterDescription: 'Professional Credit Card Checking Service',
          twitterImage: TRANSPARENT_PNG,
          favicon: TRANSPARENT_PNG,
          thumbnail: TRANSPARENT_PNG
        })
      }
    }

    fetchConfig()
  }, [])

  useEffect(() => {
    if (config) {
      // Update document title
      document.title = config.seoTitle

      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', config.seoDescription)
      } else {
        const meta = document.createElement('meta')
        meta.name = 'description'
        meta.content = config.seoDescription
        document.head.appendChild(meta)
      }

      // Update meta keywords
      const metaKeywords = document.querySelector('meta[name="keywords"]')
      if (metaKeywords) {
        metaKeywords.setAttribute('content', config.siteKeywords)
      } else {
        const meta = document.createElement('meta')
        meta.name = 'keywords'
        meta.content = config.siteKeywords
        document.head.appendChild(meta)
      }

      // Update favicon
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (favicon) {
        favicon.href = config.favicon
      }

      // Update shortcut icon
      const shortcutIcon = document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement
      if (shortcutIcon) {
        shortcutIcon.href = config.favicon
      }

      // Update apple touch icon
      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement
      if (appleIcon) {
        appleIcon.href = config.favicon
      }

      // Update Open Graph tags
      const updateOrCreateMeta = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`)
        if (meta) {
          meta.setAttribute('content', content)
        } else {
          meta = document.createElement('meta')
          meta.setAttribute('property', property)
          meta.setAttribute('content', content)
          document.head.appendChild(meta)
        }
      }

      updateOrCreateMeta('og:title', config.ogTitle)
      updateOrCreateMeta('og:description', config.ogDescription)
      updateOrCreateMeta('og:image', config.ogImage)
      updateOrCreateMeta('og:site_name', config.ogSiteName || config.siteName)
      updateOrCreateMeta('og:type', config.ogType || 'website')

      // Canonical link
      const ensureLink = (rel: string, href: string) => {
        if (!href) return
        let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
        if (link) {
          link.href = href
        } else {
          link = document.createElement('link') as HTMLLinkElement
          link.rel = rel
          link.href = href
          document.head.appendChild(link)
        }
      }
      const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
      const base = config.canonicalUrl && config.canonicalUrl.trim().length > 0 ? config.canonicalUrl.replace(/\/$/, '') : ''
      const canonical = base ? `${base}${typeof window !== 'undefined' ? window.location.pathname : ''}` : currentUrl
      ensureLink('canonical', canonical)

      // Robots meta
      const robots = [config.robotsIndex !== false ? 'index' : 'noindex', config.robotsFollow !== false ? 'follow' : 'nofollow']
      if (config.robotsAdvanced && config.robotsAdvanced.trim().length > 0) robots.push(config.robotsAdvanced.trim())
      const robotsMeta = document.querySelector('meta[name="robots"]')
      if (robotsMeta) {
        robotsMeta.setAttribute('content', robots.join(', '))
      } else {
        const m = document.createElement('meta')
        m.name = 'robots'
        m.content = robots.join(', ')
        document.head.appendChild(m)
      }

      // Update Twitter Card tags
      const updateOrCreateTwitterMeta = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`)
        if (meta) {
          meta.setAttribute('content', content)
        } else {
          meta = document.createElement('meta')
          meta.setAttribute('name', name)
          meta.setAttribute('content', content)
          document.head.appendChild(meta)
        }
      }

      updateOrCreateTwitterMeta('twitter:card', config.twitterCard || 'summary_large_image')
      if (config.twitterSite) updateOrCreateTwitterMeta('twitter:site', config.twitterSite)
      if (config.twitterCreator) updateOrCreateTwitterMeta('twitter:creator', config.twitterCreator)
      updateOrCreateTwitterMeta('twitter:title', config.twitterTitle)
      updateOrCreateTwitterMeta('twitter:description', config.twitterDescription)
      updateOrCreateTwitterMeta('twitter:image', config.twitterImage)

      // Structured data (JSON-LD)
      const ldSelector = 'script[type="application/ld+json"][data-dynamic="1"]'
      let ld = document.querySelector(ldSelector)
      const org = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: config.siteName,
        url: base || currentUrl,
        logo: config.thumbnail,
        sameAs: [] as string[]
      } as any
      const website = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: config.siteName,
        url: base || currentUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${base || currentUrl}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      }
      const jsonLd = JSON.stringify([org, website])
      if (ld) {
        ld.textContent = jsonLd
      } else {
        const s = document.createElement('script')
        s.type = 'application/ld+json'
        s.setAttribute('data-dynamic', '1')
        s.textContent = jsonLd
        document.head.appendChild(s)
      }
    }
  }, [config])

  return null
}
