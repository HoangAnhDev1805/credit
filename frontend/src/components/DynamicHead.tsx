'use client'

import { useEffect, useState } from 'react'
import Head from 'next/head'
import { apiClient } from '@/lib/api'

interface SiteConfig {
  siteName: string
  siteDescription: string
  siteKeywords: string
  seoTitle: string
  seoDescription: string
  ogTitle: string
  ogDescription: string
  ogImage: string
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
        
        setConfig({
          siteName: seoData.site_title || 'Credit Card Checker',
          siteDescription: seoData.site_description || 'Professional Credit Card Checking Service',
          siteKeywords: seoData.site_keywords || 'credit card, checker, validation, security',
          seoTitle: seoData.site_title || 'Credit Card Checker',
          seoDescription: seoData.site_description || 'Professional Credit Card Checking Service',
          ogTitle: seoData.site_title || 'Credit Card Checker',
          ogDescription: seoData.site_description || 'Professional Credit Card Checking Service',
          ogImage: siteData.site_thumbnail || '/logo.png',
          twitterTitle: seoData.site_title || 'Credit Card Checker',
          twitterDescription: seoData.site_description || 'Professional Credit Card Checking Service',
          twitterImage: siteData.site_thumbnail || '/logo.png',
          favicon: siteData.site_favicon || '/favicon.ico',
          thumbnail: siteData.site_thumbnail || '/logo.png'
        })
      } catch (error) {
        console.error('Failed to fetch site config:', error)
        // Fallback to default values
        setConfig({
          siteName: 'Credit Card Checker',
          siteDescription: 'Professional Credit Card Checking Service',
          siteKeywords: 'credit card, checker, validation, security',
          seoTitle: 'Credit Card Checker',
          seoDescription: 'Professional Credit Card Checking Service',
          ogTitle: 'Credit Card Checker',
          ogDescription: 'Professional Credit Card Checking Service',
          ogImage: '/logo.png',
          twitterTitle: 'Credit Card Checker',
          twitterDescription: 'Professional Credit Card Checking Service',
          twitterImage: '/logo.png',
          favicon: '/favicon.ico',
          thumbnail: '/logo.png'
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
      updateOrCreateMeta('og:site_name', config.siteName)
      updateOrCreateMeta('og:type', 'website')

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

      updateOrCreateTwitterMeta('twitter:card', 'summary_large_image')
      updateOrCreateTwitterMeta('twitter:title', config.twitterTitle)
      updateOrCreateTwitterMeta('twitter:description', config.twitterDescription)
      updateOrCreateTwitterMeta('twitter:image', config.twitterImage)
    }
  }, [config])

  return null
}
