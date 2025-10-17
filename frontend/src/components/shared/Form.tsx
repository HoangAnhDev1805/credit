'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { ImageUpload } from '@/components/shared/ImageUpload'
import { Eye, EyeOff, Upload, X } from 'lucide-react'

// Form Field Types
export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'switch'
  | 'file'
  | 'image'
  | 'hidden'

export interface FormField {
  name: string
  label?: string
  type: FieldType
  placeholder?: string
  required?: boolean
  disabled?: boolean
  options?: { value: string; label: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    custom?: (value: any) => string | null
  }
  description?: string
  className?: string
  accept?: string // for file inputs
  multiple?: boolean // for file inputs
  uploadVariant?: 'default' | 'og' // for image uploads
}

export interface FormData {
  [key: string]: any
}

export interface FormErrors {
  [key: string]: string
}

export interface SharedFormProps {
  fields: FormField[]
  initialData?: FormData
  onSubmit: (data: FormData) => void | Promise<void>
  onCancel?: () => void
  submitText?: string
  cancelText?: string
  loading?: boolean
  className?: string
  layout?: 'vertical' | 'horizontal'
  columns?: 1 | 2 | 3
  showRequiredIndicator?: boolean
}

export function SharedForm({
  fields,
  initialData = {},
  onSubmit,
  onCancel,
  submitText = 'Submit',
  cancelText = 'Cancel',
  loading = false,
  className = '',
  layout = 'vertical',
  columns = 1,
  showRequiredIndicator = true
}: SharedFormProps) {
  const [formData, setFormData] = useState<FormData>(initialData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${field.label || field.name} is required`
    }

    if (field.validation) {
      const { min, max, pattern, custom } = field.validation

      if (min !== undefined && value && value.length < min) {
        return `${field.label || field.name} must be at least ${min} characters`
      }

      if (max !== undefined && value && value.length > max) {
        return `${field.label || field.name} must be no more than ${max} characters`
      }

      if (pattern && value && !pattern.test(value)) {
        return `${field.label || field.name} format is invalid`
      }

      if (custom) {
        return custom(value)
      }
    }

    return null
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    let isValid = true

    fields.forEach(field => {
      if (field.type === 'hidden') return
      
      const error = validateField(field, formData[field.name])
      if (error) {
        newErrors[field.name] = error
        isValid = false
      }
    })

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleFileChange = (name: string, files: FileList | null) => {
    if (files) {
      const field = fields.find(f => f.name === name)
      if (field?.multiple) {
        handleFieldChange(name, Array.from(files))
      } else {
        handleFieldChange(name, files[0])
      }
    }
  }

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }

  const renderField = (field: FormField) => {
    const value = formData[field.name] || ''
    const error = errors[field.name]
    const isPassword = field.type === 'password'
    const showPassword = showPasswords[field.name]

    if (field.type === 'hidden') {
      return (
        <input
          key={field.name}
          type="hidden"
          name={field.name}
          value={value}
        />
      )
    }

    const fieldId = `field-${field.name}`

    return (
      <div key={field.name} className={cn("space-y-2", field.className)}>
        {field.label && (
          <Label htmlFor={fieldId} className="text-sm font-medium">
            {field.label}
            {field.required && showRequiredIndicator && (
              <span className="text-destructive ml-1">*</span>
            )}
          </Label>
        )}

        {field.type === 'textarea' && (
          <Textarea
            id={fieldId}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            disabled={field.disabled || loading}
            className={error ? 'border-destructive' : ''}
          />
        )}

        {(field.type === 'text' || field.type === 'email' || field.type === 'password' || field.type === 'number') && (
          <div className="relative">
            <Input
              id={fieldId}
              type={isPassword && !showPassword ? 'password' : field.type === 'password' ? 'text' : field.type}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={field.disabled || loading}
              className={error ? 'border-destructive' : ''}
            />
            {isPassword && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => togglePasswordVisibility(field.name)}
                disabled={field.disabled || loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}

        {field.type === 'select' && (
          <Select
            value={value}
            onValueChange={(val) => handleFieldChange(field.name, val)}
            disabled={field.disabled || loading}
          >
            <SelectTrigger className={error ? 'border-destructive' : ''}>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {field.type === 'checkbox' && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={fieldId}
              checked={value}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
              disabled={field.disabled || loading}
            />
            {field.label && (
              <Label htmlFor={fieldId} className="text-sm font-normal cursor-pointer">
                {field.label}
              </Label>
            )}
          </div>
        )}

        {field.type === 'switch' && (
          <div className="flex items-center space-x-2">
            <Switch
              id={fieldId}
              checked={value}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
              disabled={field.disabled || loading}
            />
            {field.label && (
              <Label htmlFor={fieldId} className="text-sm font-normal">
                {field.label}
              </Label>
            )}
          </div>
        )}

        {field.type === 'file' && (
          <div className="space-y-2">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor={fieldId}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80 transition-colors",
                  error ? 'border-destructive' : 'border-muted-foreground/25',
                  (field.disabled || loading) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {field.accept || 'All files'}
                  </p>
                </div>
                <input
                  id={fieldId}
                  type="file"
                  className="hidden"
                  accept={field.accept}
                  multiple={field.multiple}
                  onChange={(e) => handleFileChange(field.name, e.target.files)}
                  disabled={field.disabled || loading}
                />
              </label>
            </div>
            {value && (
              <div className="text-sm text-muted-foreground">
                {Array.isArray(value) 
                  ? `${value.length} file(s) selected`
                  : value.name || 'File selected'
                }
              </div>
            )}
          </div>
        )}

        {field.type === 'image' && (
          <ImageUpload
            value={value}
            onChange={(url) => handleFieldChange(field.name, url)}
            label={field.label}
            description={field.placeholder}
            className={error ? 'border-destructive' : ''}
            variant={field.uploadVariant || 'default'}
          />
        )}

        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    )
  }

  const getGridClasses = () => {
    switch (columns) {
      case 2:
        return 'grid grid-cols-1 md:grid-cols-2 gap-4'
      case 3:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
      default:
        return 'space-y-4'
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      <div className={getGridClasses()}>
        {fields.map(renderField)}
      </div>

      <div className="flex items-center justify-end space-x-2 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
          )}
          {submitText}
        </Button>
      </div>
    </form>
  )
}
