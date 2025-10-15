'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/lib/auth'
import { useI18n } from '@/components/I18nProvider'
import { Upload, User, Mail, Lock, Save, Camera } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { user, updateUser } = useAuthStore()
  const { t } = useI18n()
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    bio: '',
    avatar: ''
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        bio: user.bio || '',
        avatar: user.avatar || ''
      })
      setAvatarPreview(user.avatar || '')
    }
  }, [user])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validate passwords if changing
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          toast({
            title: t('common.error'),
            description: t('auth.validation.passwordMismatch'),
            variant: "destructive"
          })
          return
        }
        if (formData.newPassword.length < 8) {
          toast({
            title: t('common.error'),
            description: t('auth.validation.passwordTooShort'),
            variant: "destructive"
          })
          return
        }
      }

      // Upload avatar if changed
      let avatarUrl = formData.avatar
      if (avatarFile) {
        const formDataUpload = new FormData()
        formDataUpload.append('avatar', avatarFile)
        
        const uploadResponse = await fetch('/api/upload/avatar', {
          method: 'POST',
          body: formDataUpload,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json()
          avatarUrl = uploadResult.url
        }
      }

      // Update user profile
      const updateData = {
        username: formData.username,
        email: formData.email,
        bio: formData.bio,
        avatar: avatarUrl,
        ...(formData.newPassword && {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const result = await response.json()
        await updateUser(result.user)
        
        toast({
          title: t('common.success'),
          description: t('settings.messages.profileUpdated'),
        })
        
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
      } else {
        const error = await response.json()
        toast({
          title: t('common.error'),
          description: error.message || t('settings.messages.profileUpdateError'),
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Network error occurred',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('settings.description')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('settings.profile.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.profile.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex items-center space-x-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview} alt="Avatar" />
                <AvatarFallback>
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <Label htmlFor="avatar" className="text-sm font-medium">
                  {t('settings.profile.avatar')}
                </Label>
                <div
                  className="mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <Camera className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.profile.uploadAvatar')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, GIF up to 5MB
                  </p>
                </div>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Username */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('settings.profile.username')}</Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder={t('settings.profile.username')}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t('settings.profile.email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={t('settings.profile.email')}
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">{t('settings.profile.bio')}</Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder={t('settings.profile.bioPlaceholder')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t('settings.security.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.security.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('settings.security.currentPassword')}</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleInputChange}
                placeholder={t('settings.security.currentPassword')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('settings.security.newPassword')}</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  placeholder={t('settings.security.newPassword')}
                />
                <p className="text-xs text-gray-500">{t('settings.security.passwordRequirements')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('settings.security.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder={t('settings.security.confirmPassword')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading} className="min-w-32">
            {isLoading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                {t('settings.actions.saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t('settings.actions.save')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
