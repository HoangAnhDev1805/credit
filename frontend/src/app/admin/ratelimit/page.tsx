'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { useSocket } from '@/hooks/use-socket'
import { Shield, Activity, Clock, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

export default function RateLimitPage() {
  const { toast } = useToast()
  const { on } = useSocket({ enabled: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<any>({})
  const [stats, setStats] = useState<any>({ total: 0, recent: [], topEndpoints: [], topIPs: [] })
  
  // Load config
  useEffect(() => {
    loadConfig()
    loadStats()
    
    // Realtime updates
    const cleanup1 = on('ratelimit:config:updated', () => {
      loadConfig()
    })
    
    const cleanup2 = on('admin:request:stats', (data: any) => {
      setStats(data)
    })
    
    // Refresh stats every 5s
    const interval = setInterval(loadStats, 5000)
    
    return () => {
      cleanup1()
      cleanup2()
      clearInterval(interval)
    }
  }, [on])
  
  const loadConfig = async () => {
    try {
      const res = await apiClient.get('/admin/ratelimit-config')
      if (res.data.success) {
        setConfig(res.data.data.configs)
      }
    } catch (err: any) {
      console.error('Load config error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const loadStats = async () => {
    try {
      const res = await apiClient.get('/admin/request-stats')
      if (res.data.success) {
        setStats(res.data.data)
      }
    } catch (err) {
      console.error('Load stats error:', err)
    }
  }
  
  const handleSave = async () => {
    setSaving(true)
    try {
      const updates: any = {}
      Object.keys(config).forEach(key => {
        updates[key] = config[key].value
      })
      
      await apiClient.put('/admin/ratelimit-config', updates)
      toast({
        title: 'Thành công',
        description: 'Cấu hình Rate Limit đã được cập nhật'
      })
    } catch (err: any) {
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể cập nhật cấu hình',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }
  
  const updateConfigValue = (key: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value
      }
    }))
  }
  
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num)
  }
  
  const formatDuration = (ms: number) => {
    if (ms >= 60000) return `${ms / 60000} phút`
    return `${ms / 1000} giây`
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8 text-purple-600" />
          Quản lý Rate Limiting
        </h1>
        <p className="text-muted-foreground mt-2">
          Cấu hình giới hạn số lượng requests để bảo vệ hệ thống khỏi spam và DDoS
        </p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Tổng Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.total)}</div>
            <p className="text-xs text-muted-foreground">Kể từ lúc khởi động</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Requests Gần Đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentCount || 0}</div>
            <p className="text-xs text-muted-foreground">100 requests cuối</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-purple-600" />
              Endpoints Hoạt Động
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topEndpoints?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Đang được sử dụng</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              IPs Hoạt Động
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topIPs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Unique IPs</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Auth Endpoints
            </CardTitle>
            <CardDescription>
              Giới hạn cho các endpoint đăng nhập/đăng ký (/api/auth/*)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Thời gian cửa sổ (milliseconds)</Label>
              <Input
                type="number"
                value={config.ratelimit_auth_window_ms?.value || 900000}
                onChange={(e) => updateConfigValue('ratelimit_auth_window_ms', Number(e.target.value))}
                placeholder="900000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hiện tại: {formatDuration(config.ratelimit_auth_window_ms?.value || 900000)}
              </p>
            </div>
            
            <div>
              <Label>Số requests tối đa</Label>
              <Input
                type="number"
                value={config.ratelimit_auth_max?.value || 1000000}
                onChange={(e) => updateConfigValue('ratelimit_auth_max', Number(e.target.value))}
                placeholder="1000000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(config.ratelimit_auth_max?.value || 1000000)} requests / cửa sổ
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* API Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              API Endpoints
            </CardTitle>
            <CardDescription>
              Giới hạn cho các API thông thường (/api/*)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Thời gian cửa sổ (milliseconds)</Label>
              <Input
                type="number"
                value={config.ratelimit_api_window_ms?.value || 60000}
                onChange={(e) => updateConfigValue('ratelimit_api_window_ms', Number(e.target.value))}
                placeholder="60000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hiện tại: {formatDuration(config.ratelimit_api_window_ms?.value || 60000)}
              </p>
            </div>
            
            <div>
              <Label>Số requests tối đa</Label>
              <Input
                type="number"
                value={config.ratelimit_api_max?.value || 1000000}
                onChange={(e) => updateConfigValue('ratelimit_api_max', Number(e.target.value))}
                placeholder="1000000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(config.ratelimit_api_max?.value || 1000000)} requests / cửa sổ
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Card Check Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Card Check Endpoints
            </CardTitle>
            <CardDescription>
              Giới hạn cho các endpoint check thẻ (/api/checker/*, /api/checkcc)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Thời gian cửa sổ (milliseconds)</Label>
              <Input
                type="number"
                value={config.ratelimit_cardcheck_window_ms?.value || 300000}
                onChange={(e) => updateConfigValue('ratelimit_cardcheck_window_ms', Number(e.target.value))}
                placeholder="300000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hiện tại: {formatDuration(config.ratelimit_cardcheck_window_ms?.value || 300000)}
              </p>
            </div>
            
            <div>
              <Label>Số requests tối đa</Label>
              <Input
                type="number"
                value={config.ratelimit_cardcheck_max?.value || 999999999}
                onChange={(e) => updateConfigValue('ratelimit_cardcheck_max', Number(e.target.value))}
                placeholder="999999999"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(config.ratelimit_cardcheck_max?.value || 999999999)} requests / cửa sổ
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600" />
              Cài Đặt Hệ Thống
            </CardTitle>
            <CardDescription>
              Bật/tắt rate limiting cho toàn bộ hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Bật Rate Limiting</Label>
                <p className="text-xs text-muted-foreground">
                  Tắt để cho phép unlimited requests (không khuyến nghị)
                </p>
              </div>
              <Switch
                checked={config.ratelimit_enabled?.value !== false}
                onCheckedChange={(checked) => updateConfigValue('ratelimit_enabled', checked)}
              />
            </div>
            
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900 dark:text-yellow-200">Lưu ý quan trọng</p>
                  <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                    Thay đổi cấu hình sẽ có hiệu lực sau tối đa 30 giây. Hệ thống tự động reload config.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Top Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Endpoints Được Truy Cập Nhiều Nhất</CardTitle>
          <CardDescription>Real-time tracking các endpoint được sử dụng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.topEndpoints?.slice(0, 10).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{idx + 1}</Badge>
                  <span className="font-mono text-sm">{item.endpoint}</span>
                </div>
                <Badge>{formatNumber(item.count)} requests</Badge>
              </div>
            ))}
            
            {(!stats.topEndpoints || stats.topEndpoints.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có dữ liệu
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </Button>
      </div>
    </div>
  )
}
