'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SharedModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  className?: string
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
  footer?: React.ReactNode
  loading?: boolean
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]'
}

export function SharedModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  footer,
  loading = false
}: SharedModalProps) {
  
  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={handleOverlayClick}
      />
      
      {/* Modal */}
      <div className={cn(
        "relative bg-background border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 duration-200",
        "w-full mx-4 max-h-[90vh] overflow-hidden",
        sizeClasses[size],
        className
      )}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={cn(
            "flex items-center justify-between p-6 border-b",
            headerClassName
          )}>
            <div className="flex-1">
              {title && (
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onClose}
                disabled={loading}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={cn(
          "p-6 overflow-y-auto",
          size === 'full' ? 'max-h-[calc(95vh-8rem)]' : 'max-h-[60vh]',
          bodyClassName
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className={cn(
            "flex items-center justify-end gap-2 p-6 border-t bg-muted/50",
            footerClassName
          )}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Predefined modal variants for common use cases
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  description = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  loading?: boolean
}) {
  return (
    <SharedModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      loading={loading}
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            )}
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="py-4">
        <p className="text-sm text-muted-foreground">
          This action cannot be undone.
        </p>
      </div>
    </SharedModal>
  )
}

export function InfoModal({
  isOpen,
  onClose,
  title,
  children,
  size = "md"
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}) {
  return (
    <SharedModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <Button onClick={onClose}>
          Close
        </Button>
      }
    >
      {children}
    </SharedModal>
  )
}

export function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  children,
  submitText = "Save",
  cancelText = "Cancel",
  loading = false,
  size = "md"
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
  title: string
  children: React.ReactNode
  submitText?: string
  cancelText?: string
  loading?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}) {
  return (
    <SharedModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      loading={loading}
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={loading}
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            )}
            {submitText}
          </Button>
        </>
      }
    >
      {children}
    </SharedModal>
  )
}
