'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import { AdminLayout } from '@/components/AdminLayout'
import { ToastProvider } from '@/components/shared/Toast'

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login')
        return
      }
      
      if (user?.role !== 'admin') {
        router.push('/dashboard')
        return
      }
    }
  }, [isAuthenticated, user, isLoading, router])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Don't render anything if not authenticated or not admin
  if (!isAuthenticated || user?.role !== 'admin') {
    return null
  }

  return (
    <ToastProvider>
      <AdminLayout>
        {children}
      </AdminLayout>
    </ToastProvider>
  )
}
