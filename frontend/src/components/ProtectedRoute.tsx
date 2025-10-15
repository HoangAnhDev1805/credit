'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
  requireAuth?: boolean
}

export function ProtectedRoute({ 
  children, 
  redirectTo = '/auth/login',
  requireAuth = true 
}: ProtectedRouteProps) {
  const router = useRouter()
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const verifyAuth = async () => {
      if (!isAuthenticated && requireAuth) {
        await checkAuth()
      }
      setIsChecking(false)
    }

    verifyAuth()
  }, [isAuthenticated, requireAuth, checkAuth])

  useEffect(() => {
    if (!isChecking && requireAuth && !isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isChecking, requireAuth, isAuthenticated, router, redirectTo])

  // Show loading while checking authentication
  if (isChecking || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If auth is required but user is not authenticated, don't render children
  if (requireAuth && !isAuthenticated) {
    return null
  }

  // If auth is required and user is authenticated, or auth is not required, render children
  return <>{children}</>
}

// Hook for easier usage
export function useRequireAuth(redirectTo = '/auth/login') {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const verifyAuth = async () => {
      if (!isAuthenticated) {
        await checkAuth()
      }
      setIsChecking(false)
    }

    verifyAuth()
  }, [isAuthenticated, checkAuth])

  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isChecking, isAuthenticated, router, redirectTo])

  return {
    isAuthenticated,
    isLoading: isChecking || isLoading,
    isReady: !isChecking && isAuthenticated
  }
}
