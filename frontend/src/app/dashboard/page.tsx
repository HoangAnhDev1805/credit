'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/components/I18nProvider'
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  Zap,
  Coins
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, checkAuth } = useAuthStore()
  const { toast } = useToast()
  const { t } = useI18n()

  const [stats, setStats] = useState({
    totalChecked: 0,
    successRate: 0,
    avgResponseTime: 0,
    activeUsers: 0,
    todayChecked: 0,
    thisWeekChecked: 0,
    thisMonthChecked: 0,
    totalRevenue: 0,
    // new fields from backend for cards
    totalCredit: 0,
    totalCardLive: 0,
    totalCardDie: 0,
    totalCardUnknown: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [systemStatus, setSystemStatus] = useState({
    api: 'online',
    database: 'online',
    payment: 'online'
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    loadDashboardData()
  }, [isAuthenticated, router])

  const loadDashboardData = async () => {
    try {
      // Load dashboard stats
      const statsResponse = await apiClient.get('/dashboard/stats')
      if (statsResponse.status === 200 && statsResponse.data?.data) {
        setStats(statsResponse.data.data)
      }

      // Load recent activity
      const activityResponse = await apiClient.get('/dashboard/activity')
      if (activityResponse.status === 200 && activityResponse.data?.data) {
        setRecentActivity(activityResponse.data.data)
      }

      // Load system status
      const statusResponse = await apiClient.get('/dashboard/status')
      if (statusResponse.status === 200 && statusResponse.data?.data) {
        setSystemStatus(statusResponse.data.data)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      toast({
        title: t('common.error'),
        description: 'Failed to load dashboard data',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {t('common.welcome')}, {user.username}!
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.title')} - {t('home.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stats.totalChecked')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChecked.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.todayChecked} {t('dashboard.stats.todayChecked').toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stats.successRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stats.avgResponseTime')}</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              -12ms from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
            <Coins className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{Number(stats.totalCredit || 0).toLocaleString()} Credits</div>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Total Cards - separate row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Card Checker</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChecked.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Card Live</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalCardLive?.toLocaleString?.() || 0}</div>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Card Die</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalCardDie?.toLocaleString?.() || 0}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Card Unknown</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.totalCardUnknown?.toLocaleString?.() || 0}</div>
            <p className="text-xs text-muted-foreground">Pending/Unknown</p>
          </CardContent>
        </Card>
      </div>


      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span>{t('dashboard.navigation.items.checker')}</span>
              </CardTitle>
              <CardDescription>
                {t('home.features.cardCheck.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/checker">
                <Button className="w-full">
                  {t('common.getStarted')}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <span>{t('dashboard.navigation.items.cardGenerator')}</span>
              </CardTitle>
              <CardDescription>
                Generate valid credit cards for testing purposes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/generate">
                <Button className="w-full" variant="outline">
                  Generate Cards
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>{t('dashboard.navigation.items.buyCredits')}</span>
              </CardTitle>
              <CardDescription>



                Add credits to your account for services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/buy-credits">
                <Button className="w-full" variant="secondary">
                  Buy Credits
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Status */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('dashboard.systemStatus')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">API Status</span>
              </div>
              <Badge variant={systemStatus.api === 'online' ? 'default' : 'destructive'}>
                {systemStatus.api === 'online' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {systemStatus.api}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm font-medium">Database</span>
              </div>
              <Badge variant={systemStatus.database === 'online' ? 'default' : 'destructive'}>
                {systemStatus.database === 'online' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {systemStatus.database}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Payment</span>
              </div>
              <Badge variant={systemStatus.payment === 'online' ? 'default' : 'destructive'}>
                {systemStatus.payment === 'online' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {systemStatus.payment}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('dashboard.recentActivity')}</h2>
        <Card>
          <CardContent className="p-6">
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((activity: any, index: number) => (
                  <div key={index} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{activity.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
