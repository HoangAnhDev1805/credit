'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  Settings,
  Home,
  Menu,
  X,
  LogOut,
  Bell,
  Search
} from 'lucide-react'

const navigation = [
  {
    name: 'Trang chủ',
    href: '/',
    icon: Home,
    external: true
  },
  {
    name: 'Thống kê',
    href: '/admin',
    icon: LayoutDashboard
  },
  {
    name: 'Quản lý User',
    href: '/admin/users',
    icon: Users
  },
  {
    name: 'List Bin Card',
    href: '/admin/cards',
    icon: CreditCard
  },
  {
    name: 'Quản lý Thanh toán',
    href: '/admin/payments',
    icon: Wallet
  },
  {
    name: 'Cấu hình Website',
    href: '/admin/settings',
    icon: Settings
  },
  {
    name: 'API Tester',
    href: '/admin/api-tester',
    icon: CreditCard // Reuse icon, or can import Search/Zap
  }
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [showNotif, setShowNotif] = useState(false)
  const [logoUrl, setLogoUrl] = useState('/logo.png')
  const [siteName, setSiteName] = useState('Admin Panel')

  // Fetch site config for logo and site name
  useEffect(() => {
    const fetchSiteConfig = async () => {
      try {
        const response = await apiClient.getPublicConfig()
        const data = (response as any)?.data || {}
        const general = data.general || {}
        const seo = data.seo || {}

        const toAbs = (url?: string) => {
          if (!url) return '/logo.png'
          // Absolute URL already
          if (url.startsWith('http://') || url.startsWith('https://')) return url
          // If backend uploads path, prefix backend base URL
          if (url.startsWith('/uploads')) {
            const base = apiClient.getBaseUrl?.() || ''
            const backendUrl = base.endsWith('/api') ? base.slice(0, -4) : base
            return `${backendUrl}${url}`
          }
          // Otherwise keep as-is (served by Next /public)
          return url
        }

        if (general.site_logo) {
          setLogoUrl(toAbs(general.site_logo))
        }
        if (seo.site_title) {
          setSiteName(seo.site_title)
        }
      } catch (error) {
        console.error('Failed to fetch site config:', error)
      }
    }
    fetchSiteConfig()
  }, [])

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b">
            <div className="flex items-center space-x-2">
              <img src={logoUrl} alt="Logo" className="h-12 w-auto" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png' }} />
              <span className="font-semibold text-lg">{siteName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = item.external ? false : pathname === item.href
              const Icon = item.icon

              if (item.external) {
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                )
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback>
                  {user?.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.username}
                </p>
                <div className="flex items-center space-x-1">
                  <Badge variant="secondary" className="text-xs">
                    Admin
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-8 w-8 p-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="hidden md:block">
                <h1 className="text-xl font-semibold">
                  {navigation.find(item => item.href === pathname)?.name || 'Admin Panel'}
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden md:flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-10 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:ring-2 focus:ring-primary focus:outline-none w-64"
                    onKeyDown={(e) => {
                      const target = e.target as HTMLInputElement
                      if (e.key === 'Enter' && target.value.trim()) {
                        router.push(`/admin/users?search=${encodeURIComponent(target.value.trim())}`)
                      }
                    }}
                  />
                </div>
              </div>

              {/* Notifications */}
              <div className="relative">
                <Button variant="ghost" size="sm" className="relative" onClick={() => setShowNotif((v) => !v)}>
                  <Bell className="h-5 w-5" />
                </Button>
                {showNotif && (
                  <div className="absolute right-0 mt-2 w-64 bg-popover border rounded-md shadow-lg z-50 p-3 text-sm">
                    <p className="text-muted-foreground">Chưa có thông báo</p>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>
                    {user?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-medium">{user?.username}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
