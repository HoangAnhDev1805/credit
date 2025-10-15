'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  Shield, 
  Zap, 
  Users, 
  BarChart3, 
  Lock,
  ArrowRight,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/components/I18nProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, checkAuth } = useAuthStore()
  const { t } = useI18n()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const features = [
    {
      icon: CreditCard,
      title: t('home.features.cardCheck.title'),
      description: t('home.features.cardCheck.description')
    },
    {
      icon: Shield,
      title: t('home.features.security.title'),
      description: t('home.features.security.description')
    },
    {
      icon: Zap,
      title: t('home.features.speed.title'),
      description: t('home.features.speed.description')
    },
    {
      icon: BarChart3,
      title: t('home.features.analytics.title'),
      description: t('home.features.analytics.description')
    },
    {
      icon: Users,
      title: t('home.features.userManagement.title'),
      description: t('home.features.userManagement.description')
    },
    {
      icon: Lock,
      title: t('home.features.compliance.title'),
      description: t('home.features.compliance.description')
    }
  ]

  const stats = [
    { label: t('home.stats.cardsChecked'), value: '1M+' },
    { label: t('home.stats.trustedUsers'), value: '10K+' },
    { label: t('home.stats.accuracy'), value: '99.9%' },
    { label: t('home.stats.uptime'), value: '99.9%' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">{t('home.title')}</span>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <LanguageSwitcher />
              <Link href="/auth/login">
                <Button variant="ghost">{t('common.login')}</Button>
              </Link>
              <Link href="/auth/register">
                <Button>{t('auth.registerNow')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4">
            {t('home.subtitle')}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('home.heroTitle')}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('home.heroDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="w-full sm:w-auto">
                {t('home.getStarted')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                {t('home.learnMore')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('home.featuresTitle')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('home.featuresSubtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="card-hover">
                <CardHeader>
                  <feature.icon className="h-12 w-12 text-primary mb-4" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('home.ctaTitle')}
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            {t('home.ctaSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('home.ctaButton')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <CreditCard className="h-6 w-6 text-primary" />
              <span className="font-semibold">Credit Card Checker</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {t('home.footer.copyright')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
