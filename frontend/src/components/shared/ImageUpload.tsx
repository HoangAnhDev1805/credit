'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  onRemove?: () => void
  label?: string
  description?: string
  accept?: string
  maxSize?: number // in MB
  className?: string
  preview?: boolean
  variant?: 'default' | 'og'
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  label = 'Upload Image',
  description = 'Drag and drop an image here, or click to select',
  accept = 'image/*',
  maxSize = 5,
  className = '',
  preview = true,
  variant = 'default'
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const validateFile = (file: File): boolean => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Lỗi',
        description: 'Chỉ chấp nhận file hình ảnh (JPG, PNG, GIF, WebP)',
        variant: 'destructive'
      })
      return false
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxSize) {
      toast({
        title: 'Lỗi',
        description: `File quá lớn. Vui lòng chọn file nhỏ hơn ${maxSize}MB`,
        variant: 'destructive'
      })
      return false
    }

    return true
  }

  const getApiHost = (): string => {
    // Prefer explicit env; otherwise derive from apiClient base (/api trimmed)
    let envBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
    if (envBase) {
      // If env mistakenly includes /api, strip it
      if (/\/api\/?$/i.test(envBase)) envBase = envBase.replace(/\/api\/?$/i, '')
      return envBase
    }
    try {
      let base = apiClient.getBaseUrl() || '' // e.g. https://api.domain.com/api
      if (/\/api\/?$/.test(base)) base = base.replace(/\/api\/?$/, '')
      return base.replace(/\/+$/, '')
    } catch {
      return ''
    }
  }

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('image', file)

    const base = getApiHost()
    const endpoint = variant === 'og' ? '/api/upload/image/og' : '/api/upload/image'
    const response = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    const data = await response.json()
    return data.url
  }

  const handleFileSelect = useCallback(async (file: File) => {
    if (!validateFile(file)) return

    setIsUploading(true)
    try {
      const url = await uploadFile(file)
      onChange(url)
      toast({
        title: 'Thành công',
        description: 'Tải lên hình ảnh thành công'
      })
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải lên hình ảnh. Vui lòng thử lại.',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
    }
  }, [onChange, toast, maxSize])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemove = () => {
    if (onRemove) {
      onRemove()
    } else {
      onChange('')
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {value && preview ? (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <img
                src={value}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2 truncate">
              {value}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <CardContent className="p-8 text-center">
            {isUploading ? (
              <div className="space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Đang tải lên...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-center">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <ImageIcon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tối đa {maxSize}MB • JPG, PNG, GIF, WebP
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {value && !preview && (
        <div className="flex items-center justify-between p-2 bg-muted rounded">
          <span className="text-sm truncate flex-1">{value}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default ImageUpload
