'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { CreditCard, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useI18n } from '@/components/I18nProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, isLoading } = useAuthStore()
  const { toast } = useToast()
  const { t, showLanguageSwitcher } = useI18n() as any
  
  const [formData, setFormData] = useState({
    login: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.login || !formData.password) {
      toast({
        title: t('common.error'),
        description: t('auth.validation.emailRequired'),
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      await login(formData.login, formData.password)
      toast({
        title: t('common.success'),
        description: t('success.loginSuccess')
      })
      router.push('/dashboard')
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed'
      
      // Map backend messages to display messages (backend already sends in English)
      let displayMessage = errorMessage
      
      // If backend message is one of our known messages, use it directly
      if (errorMessage.includes('Username or email does not exist') ||
          errorMessage.includes('Username or password is incorrect') ||
          errorMessage.includes('Your account has been blocked') ||
          errorMessage.includes('Too many')) {
        displayMessage = errorMessage
      } else {
        // Fallback mapping for other messages
        if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('does not exist')) {
          displayMessage = 'Username or email does not exist'
        } else if (errorMessage.toLowerCase().includes('incorrect') || errorMessage.toLowerCase().includes('password')) {
          displayMessage = 'Username or password is incorrect'
        } else if (errorMessage.toLowerCase().includes('too many') || errorMessage.toLowerCase().includes('attempts')) {
          displayMessage = 'Too many login attempts. Please try again later'
        } else if (errorMessage.toLowerCase().includes('blocked') || errorMessage.toLowerCase().includes('suspended')) {
          displayMessage = 'Your account has been blocked. Please contact support'
        }
      }
      
      toast({
        title: 'Login Error',
        description: displayMessage,
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header with Language Switcher and Theme Toggle */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        <ThemeToggle />
        {showLanguageSwitcher !== false && <LanguageSwitcher />}
      </div>

      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CreditCard className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('auth.loginTitle')}</CardTitle>
            <CardDescription>
              {t('auth.loginSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="login" className="text-sm font-medium">
                  {t('auth.usernameOrEmail')}
                </label>
                <Input
                  id="login"
                  name="login"
                  type="text"
                  placeholder={t('auth.usernameOrEmail')}
                  value={formData.login}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('auth.password')}
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('auth.loginButton')
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('auth.noAccount')}{' '}
                <Link href="/auth/register" className="text-primary hover:underline">
                  {t('auth.registerNow')}
                </Link>
              </p>
              <Link 
                href="/" 
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                {t('auth.backToHome')}
              </Link>
            </div>


          </CardContent>
        </Card>
      </div>
    </div>
  )
}
