'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

// Stat Card Component
export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
  loading?: boolean
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = 'default',
  className = '',
  loading = false
}: StatCardProps) {
  const colorClasses = {
    default: 'border-border',
    primary: 'border-primary/20 bg-primary/5',
    success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    danger: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
  }

  const iconColorClasses = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  }

  if (loading) {
    return (
      <Card className={cn(colorClasses[color], className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
          <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2"></div>
          <div className="h-3 w-32 bg-muted animate-pulse rounded"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(colorClasses[color], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className={cn("h-4 w-4", iconColorClasses[color])} />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <div className="flex items-center justify-between mt-2">
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}% {trend.label}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Info Card Component
export interface InfoCardProps {
  title: string
  description?: string
  children: React.ReactNode
  icon?: LucideIcon
  actions?: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  variant?: 'default' | 'outline' | 'ghost'
}

export function InfoCard({
  title,
  description,
  children,
  icon: Icon,
  actions,
  className = '',
  headerClassName = '',
  contentClassName = '',
  variant = 'default'
}: InfoCardProps) {
  const variantClasses = {
    default: '',
    outline: 'border-2',
    ghost: 'border-0 shadow-none bg-transparent'
  }

  return (
    <Card className={cn(variantClasses[variant], className)}>
      <CardHeader className={cn("pb-3", headerClassName)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="mt-1">{description}</CardDescription>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center space-x-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

// Feature Card Component
export interface FeatureCardProps {
  title: string
  description: string
  icon?: LucideIcon
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'ghost'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'destructive' | 'ghost'
  }
  className?: string
  disabled?: boolean
  loading?: boolean
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  badge,
  action,
  secondaryAction,
  className = '',
  disabled = false,
  loading = false
}: FeatureCardProps) {
  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      disabled && "opacity-50 cursor-not-allowed",
      !disabled && "hover:shadow-lg cursor-pointer",
      className
    )}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {Icon && (
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {badge && (
                <Badge variant={badge.variant} className="mt-1">
                  {badge.text}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      {(action || secondaryAction) && (
        <CardContent className="pt-0">
          <div className="flex gap-2">
            {action && (
              <Button
                variant={action.variant || 'default'}
                onClick={action.onClick}
                disabled={disabled || loading}
                className="w-full"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                )}
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant || 'outline'}
                onClick={secondaryAction.onClick}
                disabled={disabled || loading}
                className="w-full"
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Grid Container for Cards
export interface CardGridProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4 | 5 | 6
  gap?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CardGrid({
  children,
  columns = 3,
  gap = 'md',
  className = ''
}: CardGridProps) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  }

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6'
  }

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

// Loading Card Skeleton
export function CardSkeleton({ 
  className = '',
  showHeader = true,
  showContent = true,
  showFooter = false
}: {
  className?: string
  showHeader?: boolean
  showContent?: boolean
  showFooter?: boolean
}) {
  return (
    <Card className={cn("animate-pulse", className)}>
      {showHeader && (
        <CardHeader>
          <div className="h-5 w-3/4 bg-muted rounded"></div>
          <div className="h-3 w-1/2 bg-muted rounded mt-2"></div>
        </CardHeader>
      )}
      {showContent && (
        <CardContent className={showHeader ? "pt-0" : ""}>
          <div className="space-y-3">
            <div className="h-4 w-full bg-muted rounded"></div>
            <div className="h-4 w-5/6 bg-muted rounded"></div>
            <div className="h-4 w-4/6 bg-muted rounded"></div>
          </div>
        </CardContent>
      )}
      {showFooter && (
        <CardContent className="pt-0">
          <div className="h-8 w-24 bg-muted rounded"></div>
        </CardContent>
      )}
    </Card>
  )
}

// Empty State Card
export function EmptyCard({
  title = "No data available",
  description = "There's nothing to show here yet.",
  icon: Icon,
  action,
  className = ''
}: {
  title?: string
  description?: string
  icon?: LucideIcon
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}) {
  return (
    <Card className={cn("text-center py-12", className)}>
      <CardContent>
        {Icon && (
          <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        )}
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {description}
        </p>
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
