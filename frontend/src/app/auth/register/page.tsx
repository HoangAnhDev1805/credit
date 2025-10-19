'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { validateEmail, validatePassword } from '@/lib/utils'
import { CreditCard, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useI18n } from '@/components/I18nProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function RegisterPage() {
  const router = useRouter()
  const { register, isAuthenticated, isLoading } = useAuthStore()
  const { toast } = useToast()
  const { t, language, showLanguageSwitcher } = useI18n() as any
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string; confirmPassword?: string }>({})
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    score: 0,
    feedback: [] as string[]
  })

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    if (formData.password) {
      // Choose feedback language based on current UI language
      const lang = (language === 'en' ? 'en' : 'vi') as 'en' | 'vi'
      setPasswordValidation(validatePassword(formData.password, lang))
    }
  }, [formData.password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Client-side validation (set field-level errors)
    const newErrors: { username?: string; email?: string; password?: string; confirmPassword?: string } = {}
    if (!formData.username) newErrors.username = 'Username is required'
    if (!formData.email) newErrors.email = 'Email is required'
    if (formData.email && !validateEmail(formData.email)) newErrors.email = 'Please provide a valid email'
    if (!formData.password) newErrors.password = 'Password is required'
    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password'
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Password confirmation does not match'
    }
    if (formData.password && !passwordValidation.isValid) {
      newErrors.password = 'Password must be at least 6 characters and include uppercase, lowercase, and a number'
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      toast({ title: t('common.error'), description: 'Please fix the highlighted fields.', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    
    try {
      await register(formData.username, formData.email, formData.password, formData.confirmPassword)
      toast({
        title: t('common.success'),
        description: t('auth.registerSuccess')
      })
      router.push('/dashboard')
    } catch (error: any) {
      const backend = error?.response?.data
      const fieldErrors: { username?: string; email?: string; password?: string; confirmPassword?: string } = {}

      // Map backend field errors (already English from validator)
      if (Array.isArray(backend?.errors)) {
        backend.errors.forEach((e: any) => {
          const field = e.field || e.path
          if (!field) return
          if (['username','email','password','confirmPassword'].includes(field)) {
            (fieldErrors as any)[field] = e.message || e.msg || 'Invalid value'
          }
        })
      }

      // Map known Vietnamese messages to English for better UX
      const msg = (backend?.message || '').toString()
      if (!fieldErrors.email && /Email\s*đã\s*được\s*sử\s*dụng/i.test(msg)) {
        fieldErrors.email = 'Email is already in use'
      }
      if (!fieldErrors.username && /(Tên\s*đăng\s*nhập|Username)\s*đã\s*được\s*sử\s*dụng/i.test(msg)) {
        fieldErrors.username = 'Username is already in use'
      }

      // If we captured any field error, highlight and guide the user
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
        toast({ title: t('auth.registerError'), description: 'Please fix the highlighted fields.', variant: 'destructive' })
      } else {
        // Fallback generic error in English-only
        const detail = (msg && /[a-z]/i.test(msg) ? msg : 'Registration failed')
        toast({ title: t('auth.registerError'), description: detail, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear field error on change
    setErrors(prev => ({ ...prev, [name]: undefined }))
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
      {/* Header */}
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
          <CardTitle className="text-2xl">{t('auth.registerTitle')}</CardTitle>
          <CardDescription>
            {t('auth.registerSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                {t('auth.username')}
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder={t('auth.username')}
                value={formData.username}
                onChange={handleChange}
                disabled={isSubmitting}
                className={errors.username ? 'border-red-500 focus-visible:ring-red-500' : ''}
                required
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t('auth.email')}
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t('auth.email')}
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
                className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                required
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
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
                  className={errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
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
              
              {/* Password strength indicator */}
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          passwordValidation.score <= 2 ? 'bg-red-500' :
                          passwordValidation.score <= 3 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${(passwordValidation.score / 5) * 100}%` }}
                      />
                    </div>
                    {passwordValidation.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                  {passwordValidation.feedback.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {passwordValidation.feedback.map((feedback, index) => (
                        <li key={index}>• {feedback}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                {t('auth.confirmPassword')}
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t('auth.confirmPassword')}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={errors.confirmPassword ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !passwordValidation.isValid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}...
                </>
              ) : (
                t('auth.registerButton')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                {t('auth.loginNow')}
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
