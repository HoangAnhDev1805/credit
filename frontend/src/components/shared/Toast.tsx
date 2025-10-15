'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (title: string, description?: string, duration?: number) => void
  error: (title: string, description?: string, duration?: number) => void
  warning: (title: string, description?: string, duration?: number) => void
  info: (title: string, description?: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    
    setToasts(current => [...current, newToast])

    // Auto remove after duration
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((title: string, description?: string, duration?: number) => {
    addToast({ type: 'success', title, description, duration })
  }, [addToast])

  const error = useCallback((title: string, description?: string, duration?: number) => {
    addToast({ type: 'error', title, description, duration })
  }, [addToast])

  const warning = useCallback((title: string, description?: string, duration?: number) => {
    addToast({ type: 'warning', title, description, duration })
  }, [addToast])

  const info = useCallback((title: string, description?: string, duration?: number) => {
    addToast({ type: 'info', title, description, duration })
  }, [addToast])

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      success,
      error,
      warning,
      info
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  toasts: Toast[]
  onRemove: (id: string) => void 
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

function ToastItem({ 
  toast, 
  onRemove 
}: { 
  toast: Toast
  onRemove: (id: string) => void 
}) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
      case 'info':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
    }
  }

  return (
    <div className={cn(
      "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-full",
      getStyles()
    )}>
      {getIcon()}
      
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-medium leading-none">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-sm text-muted-foreground">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <Button
            variant="outline"
            size="sm"
            onClick={toast.action.onClick}
            className="mt-2 h-8"
          >
            {toast.action.label}
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-transparent"
        onClick={() => onRemove(toast.id)}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </Button>
    </div>
  )
}

// Utility functions for common toast patterns
export const toastUtils = {
  success: (title: string, description?: string) => ({
    type: 'success' as const,
    title,
    description,
    duration: 4000
  }),

  error: (title: string, description?: string) => ({
    type: 'error' as const,
    title,
    description,
    duration: 6000
  }),

  warning: (title: string, description?: string) => ({
    type: 'warning' as const,
    title,
    description,
    duration: 5000
  }),

  info: (title: string, description?: string) => ({
    type: 'info' as const,
    title,
    description,
    duration: 4000
  }),

  loading: (title: string, description?: string) => ({
    type: 'info' as const,
    title,
    description,
    duration: 0 // Don't auto-dismiss loading toasts
  }),

  apiError: (error: any) => ({
    type: 'error' as const,
    title: 'API Error',
    description: error?.message || 'An unexpected error occurred',
    duration: 6000
  }),

  networkError: () => ({
    type: 'error' as const,
    title: 'Network Error',
    description: 'Please check your internet connection and try again',
    duration: 6000
  }),

  validationError: (message: string) => ({
    type: 'warning' as const,
    title: 'Validation Error',
    description: message,
    duration: 5000
  }),

  saveSuccess: (itemName: string = 'Item') => ({
    type: 'success' as const,
    title: 'Saved Successfully',
    description: `${itemName} has been saved successfully`,
    duration: 3000
  }),

  deleteSuccess: (itemName: string = 'Item') => ({
    type: 'success' as const,
    title: 'Deleted Successfully',
    description: `${itemName} has been deleted successfully`,
    duration: 3000
  }),

  updateSuccess: (itemName: string = 'Item') => ({
    type: 'success' as const,
    title: 'Updated Successfully',
    description: `${itemName} has been updated successfully`,
    duration: 3000
  })
}

// Hook for common toast patterns
export function useCommonToasts() {
  const { addToast } = useToast()

  return {
    success: (title: string, description?: string) => 
      addToast(toastUtils.success(title, description)),
    
    error: (title: string, description?: string) => 
      addToast(toastUtils.error(title, description)),
    
    warning: (title: string, description?: string) => 
      addToast(toastUtils.warning(title, description)),
    
    info: (title: string, description?: string) => 
      addToast(toastUtils.info(title, description)),
    
    apiError: (error: any) => 
      addToast(toastUtils.apiError(error)),
    
    networkError: () => 
      addToast(toastUtils.networkError()),
    
    validationError: (message: string) => 
      addToast(toastUtils.validationError(message)),
    
    saveSuccess: (itemName?: string) => 
      addToast(toastUtils.saveSuccess(itemName)),
    
    deleteSuccess: (itemName?: string) => 
      addToast(toastUtils.deleteSuccess(itemName)),
    
    updateSuccess: (itemName?: string) => 
      addToast(toastUtils.updateSuccess(itemName))
  }
}
