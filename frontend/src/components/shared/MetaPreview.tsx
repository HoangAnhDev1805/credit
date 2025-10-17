"use client"

import React from 'react'

interface Props {
  title?: string
  description?: string
  image?: string
  siteName?: string
  url?: string
}

export default function MetaPreview({ title, description, image, siteName, url }: Props) {
  const img = image || '/logo.png'
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Facebook/LinkedIn (OG) */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-3 font-medium">Preview Open Graph (Facebook/LinkedIn)</div>
        <div className="p-3">
          <div className="border rounded-lg overflow-hidden">
            <div className="aspect-video bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="og" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="p-3">
              <div className="text-xs text-muted-foreground mb-1">{url || 'https://example.com'}</div>
              <div className="font-semibold line-clamp-1">{title || 'Tiêu đề bài viết/Trang'}</div>
              <div className="text-sm text-muted-foreground line-clamp-2">{description || 'Mô tả ngắn nội dung được hiển thị khi chia sẻ lên mạng xã hội.'}</div>
              <div className="text-xs mt-1">{siteName || 'Site name'}</div>
            </div>
          </div>
        </div>
      </div>
      {/* Twitter */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-3 font-medium">Preview Twitter Card</div>
        <div className="p-3">
          <div className="border rounded-lg overflow-hidden">
            <div className="aspect-video bg-muted">
              <img src={img} alt="twitter" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="p-3">
              <div className="font-semibold line-clamp-1">{title || 'Tiêu đề hiển thị trên Twitter'}</div>
              <div className="text-sm text-muted-foreground line-clamp-2">{description || 'Mô tả ngắn hiển thị khi chia sẻ.'}</div>
              <div className="text-xs mt-1">{siteName || 'Site name'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

