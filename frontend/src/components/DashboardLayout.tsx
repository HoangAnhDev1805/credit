'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  CreditCard,
  Zap,
  FileText,
  ShoppingCart,
  MessageCircle,
  HelpCircle,
  FileCheck,
  LogOut,
  User,
  Coins,
  Settings,
  Menu,
  X,
  Shield,
  Bitcoin
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { useAuthStore } from '@/lib/auth'
import { useI18n } from '@/components/I18nProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, checkAuth } = useAuthStore()
  const { t, showLanguageSwitcher, language } = useI18n() as any
  const { toast } = useToast()
  const [credits, setCredits] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState('/logo.svg')
  const [paymentConfig, setPaymentConfig] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (user) {
      setCredits(user.balance || 0)
    }
  }, [user])

  // Refresh user data on mount to get latest balance
  useEffect(() => {
    checkAuth()
  }, [])

  // Fetch site config for logo
  useEffect(() => {
    const fetchSiteConfig = async () => {
      try {
        const response = await apiClient.getPublicConfig()
        // getPublicConfig() returns ApiResponse where .data is the configs object
        const data = (response as any)?.data
        const toAbs = (url?: string) => {
          if (!url) return '/logo.png';
          // Already absolute
          if (url.startsWith('http://') || url.startsWith('https://')) return url;
          // If file is from backend uploads, prefix backend base
          if (url.startsWith('/uploads')) {
            const base = apiClient.getBaseUrl?.() || '';
            const backendUrl = base.endsWith('/api') ? base.slice(0, -4) : base; // strip trailing /api
            return `${backendUrl}${url}`;
          }
          // Otherwise, keep as-is to let Next.js serve from /public
          return url;
        };
        if (data?.general?.site_logo) {
          setLogoUrl(toAbs(data.general.site_logo))
        }
        if (data?.payment) {
          setPaymentConfig(data.payment)
        }
      } catch (error) {
        console.error('Failed to fetch site config:', error)
      }
    }
    fetchSiteConfig()
  }, [])

  const navigation = [
    {
      name: t('dashboard.navigation.items.home'),
      href: '/dashboard',
      icon: Home,
      section: 'TOOLS'
    },
    {
      name: t('dashboard.navigation.items.checker'),
      href: '/dashboard/checker',
      icon: CreditCard,
      section: 'TOOLS'
    },
    {
      name: t('dashboard.navigation.items.cardGenerator'),
      href: '/dashboard/generate',
      icon: Zap,
      section: 'TOOLS'
    },
    {
      name: t('dashboard.navigation.items.apiDocs'),
      href: '/dashboard/api-docs',
      icon: FileText,
      section: 'TOOLS'
    },
    // Conditionally show buy credits menu
    ...(paymentConfig?.payment_show_buy_credits !== false ? [{
      name: t('dashboard.navigation.items.buyCredits'),
      href: '/dashboard/buy-credits',
      icon: ShoppingCart,
      section: 'SHOP'
    }] : []),
    // Conditionally show crypto payment menu
    ...(paymentConfig?.payment_show_crypto_payment !== false ? [{
      name: t('dashboard.navigation.items.paymentCreditsAuto'),
      href: '/dashboard/crypto-payment',
      icon: Bitcoin,
      section: 'SHOP',
      badge: t('common.beta')
    }] : []),
    {
      name: t('dashboard.navigation.items.telegramSupport'),
      href: '/dashboard/support',
      icon: MessageCircle,
      section: 'SUPPORT'
    },
    {
      name: t('dashboard.navigation.items.faq'),
      href: '/dashboard/faq',
      icon: HelpCircle,
      section: 'SUPPORT'
    },
    {
      name: t('dashboard.navigation.items.terms'),
      href: '/dashboard/terms',
      icon: FileCheck,
      section: 'LEGAL'
    }
  ]

  const allSections = [
    { key: 'TOOLS', label: t('dashboard.navigation.sections.tools') },
    { key: 'SHOP', label: t('dashboard.navigation.sections.shop') },
    { key: 'SUPPORT', label: t('dashboard.navigation.sections.support') },
    { key: 'LEGAL', label: t('dashboard.navigation.sections.legal') }
  ]
  const sections = allSections.filter(sec => navigation.some(item => item.section === sec.key))

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: t('common.success'),
        description: t('auth.logoutSuccess')
      })
      router.push('/')
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('auth.logoutError'),
        variant: "destructive"
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 lg:flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        {/* Header */}
        <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img
              src={logoUrl || '/logo.png'}
              alt="Logo"
              className="h-12 w-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png' }}
            />
            <span className="font-semibold">Checker Credit</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.key} className="mb-6">
              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {section.label}
                </h3>
              </div>
              <nav className="space-y-1">
                {navigation
                  .filter((item) => item.section === section.key)
                  .map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-100 dark:bg-blue-600 text-blue-700 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <item.icon className="mr-3 h-4 w-4" />
                        <span className="flex items-center gap-2">
                          {item.name}
                          {'badge' in item && (item as any).badge ? (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0.5">
                              {(item as any).badge}
                            </Badge>
                          ) : null}
                        </span>
                      </Link>
                    )
                  })}
              </nav>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Logout Button */}
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-500 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('common.logout')}
            </Button>
          </div>

          {/* Credits */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Coins className="mr-2 h-4 w-4" />
              <span>{credits} Credits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="relative z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {/* Hamburger Menu */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('dashboard.title')}
              </h2>
            </div>

            <div className="flex items-center space-x-2 lg:space-x-4">
              {/* Admin Panel Button - only for admins */}
              {user?.role === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="hidden sm:flex border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-500 hover:text-white"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {language === 'vi' ? 'Quản trị' : 'Admin Panel'}
                </Button>
              )}

              {/* User Avatar/Info */}
              <div className="hidden sm:flex items-center space-x-2">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="h-8 w-8 rounded-full border-2 border-gray-200 dark:border-gray-600"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                    {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="hidden sm:block text-sm text-gray-600 dark:text-gray-300">
                  {user?.username || 'User'}
                </span>
              </div>

              {/* Credits Display */}
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <Coins className="h-4 w-4" />
                <span className="hidden sm:block">{credits} Credits</span>
                <span className="sm:hidden">{credits} Cr</span>
              </div>

              {/* Settings Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/dashboard/settings')}
                className="hidden sm:inline-flex h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>

              {/* Theme Toggle */}
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              {/* Language Switcher */}
              <div className="hidden sm:block">
                {showLanguageSwitcher !== false && (
                  <LanguageSwitcher />
                )}
              </div>

              {/* Mobile actions dropdown */}
              <div className="sm:hidden relative">
                <button
                  onClick={() => setMobileMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user?.username || 'User'} className="h-6 w-6 rounded-full border" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                      {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{user?.username || 'User'}</span>
                </button>

                {mobileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-2">
                    {/* Header with avatar + username */}
                    <div className="px-3 pb-2 flex items-center gap-3">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user?.username || 'User'} className="h-9 w-9 rounded-full border" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                          {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.username || 'User'}</div>
                      </div>
                    </div>

                    {/* Admin Panel (if admin) */}
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => { setMobileMenuOpen(false); router.push('/admin') }}
                        className="w-full flex items-center px-3 py-2 text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                      >
                        <Shield className="h-4 w-4 mr-2" /> {language === 'vi' ? 'Quản trị' : 'Admin Panel'}
                      </button>
                    )}

                    {/* Credits display */}
                    <div className="px-3 py-2 flex items-center text-sm text-gray-700 dark:text-gray-300">
                      <Coins className="h-4 w-4 mr-2" />
                      <span>{credits} Credits</span>
                    </div>

                    <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

                    {/* Settings link */}
                    <button
                      onClick={() => { setMobileMenuOpen(false); router.push('/dashboard/settings') }}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Settings className="h-4 w-4 mr-2" /> {language === 'vi' ? 'Cài đặt' : 'Settings'}
                    </button>

                    {/* Theme Toggle */}
                    <div className="px-3 py-2">
                      <ThemeToggle />
                    </div>

                    {/* Language Switcher */}
                    {showLanguageSwitcher !== false && (
                      <div className="px-3 py-2">
                        <LanguageSwitcher />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
