'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { useSocket } from '@/hooks/use-socket'
import {
  Users, CreditCard, TrendingUp, DollarSign, Activity, CheckCircle,
  Clock, Zap, Server, Cpu, HardDrive, Wifi, Play, Bug, BarChart3,
  Shield, Settings, ArrowUpRight
} from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { on, isConnected } = useSocket({ enabled: true })
  const [devices, setDevices] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardStats()
    fetchDeviceStats()
    fetchUsers()
    
    // Realtime updates
    const cleanup1 = on('card:updated', () => {
      fetchDashboardStats()
    })
    
    const cleanup2 = on('admin:device-stats:update', (msg: any) => {
      const dev = String(msg?.device || 'unknown')
      const inc = Number(msg?.inc || 1)
      setDevices(prev => {
        const copy = [...prev]
        const idx = copy.findIndex((r: any) => r.device === dev)
        if (idx === -1) copy.push({ device: dev, today: inc, total: inc })
        else {
          copy[idx] = { 
            ...copy[idx], 
            today: (copy[idx].today||0)+inc, 
            total: (copy[idx].total||0)+inc 
          }
        }
        return copy.sort((a,b) => b.today - a.today)
      })
    })
    
    return () => {
      cleanup1()
      cleanup2()
    }
  }, [on])

  const fetchDashboardStats = async () => {
    try {
      const response = await apiClient.get('/admin/dashboard?range=all')
      setStats(response.data.data)
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error)
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thống kê dashboard',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchDeviceStats = async () => {
    try {
      const response = await apiClient.get('/admin/devices')
      const data = response.data.data?.devices || response.data.data || response.data
      setDevices(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch device stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get('/admin/users')
      const data = response.data.data?.users || response.data.data || response.data
      setUsers(Array.isArray(data) ? data.slice(0, 10) : [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Tổng quan hệ thống quản trị</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected() ? "default" : "destructive"} className="gap-1">
            <Wifi className="w-3 h-3" />
            {isConnected() ? 'Kết nối' : 'Mất kết nối'}
          </Badge>
        </div>
      </div>

      {/* API Test Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/api-tester">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">Test API</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Kiểm tra LoaiDV 1 & 2</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/api-tester">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-600 rounded-lg">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-orange-900 dark:text-orange-100">Test API LoaiDV 2</h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">Gửi kết quả (Receiver)</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Grid - Redesigned with Charts Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Tổng số tài khoản
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(stats?.users?.total || 0)}</div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span>{stats?.users?.active || 0} hoạt động</span>
              </div>
              <div className="text-green-600">
                +{(stats?.users?.active / stats?.users?.total * 100 || 0).toFixed(1)}% tỉ lệ
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Tài khoản hoạt động
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(stats?.users?.active || 0)}</div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${(stats?.users?.active / stats?.users?.total * 100 || 0)}%` }}
                ></div>
              </div>
              <span className="text-muted-foreground">
                {(stats?.users?.active / stats?.users?.total * 100 || 0).toFixed(0)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-600" />
              Tài khoản bị khóa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(stats?.users?.banned || 0)}</div>
            <p className="text-xs text-muted-foreground mt-2">Cần xem xét</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-600" />
              Tổng số dư
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${formatNumber(stats?.users?.totalBalance || 0)}</div>
            <p className="text-xs text-muted-foreground mt-2">Số dư của các user</p>
          </CardContent>
        </Card>
      </div>

      {/* Card Stats with Chart Style */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Thống kê thẻ tin dụng
              </CardTitle>
              <CardDescription>Biểu đồ trạng thái các thẻ trong hệ thống</CardDescription>
            </div>
            <Link href="/admin/cards">
              <Button variant="outline" size="sm">
                Xem chi tiết
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{formatNumber(stats?.cards?.total || 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Tổng thẻ</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{formatNumber(stats?.cards?.live || 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Thẻ Live</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-lg">
              <div className="text-3xl font-bold text-red-600">{formatNumber(stats?.cards?.dead || 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Thẻ Die</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">{formatNumber(stats?.cards?.pending || 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Đang kiểm tra</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 rounded-lg">
              <div className="text-3xl font-bold text-gray-600">{formatNumber(stats?.cards?.error || 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Lỗi</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Devices - Redesigned as Machine Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                Thiết bị (Realtime)
              </CardTitle>
              <CardDescription>Các thiết bị ZennoPoster đang hoạt động</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device: any, idx: number) => (
              <Card key={idx} className="border-2 hover:border-purple-400 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Cpu className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{device.device}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Hôm nay</div>
                          <div className="font-bold text-green-600">{formatNumber(device.today || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Tổng</div>
                          <div className="font-bold text-blue-600">{formatNumber(device.total || 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-purple-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(((device.today || 0) / (device.total || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {device.total > 0 ? ((device.today / device.total) * 100).toFixed(0) : '0'}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {devices.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Chưa có thiết bị nào hoạt động
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users - Redesigned Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                Người dùng
              </CardTitle>
              <CardDescription>Danh sách người dùng gần đây</CardDescription>
            </div>
            <Link href="/admin/users">
              <Button variant="outline" size="sm">
                Quản lý Users
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((user: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">{user.username}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                    {user.status === 'active' ? 'Kích hoạt' : user.status === 'blocked' ? 'Bị khóa' : 'Từ chối'}
                  </Badge>
                  {user.checker === 1 && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Checker
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            
            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có người dùng
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/settings">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Settings className="w-8 h-8 text-purple-600" />
                <div>
                  <div className="font-semibold">Cài đặt hệ thống</div>
                  <div className="text-sm text-muted-foreground">Cấu hình website</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/ratelimit">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="font-semibold">Rate Limiting</div>
                  <div className="text-sm text-muted-foreground">Quản lý giới hạn requests</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/server-info">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-green-600" />
                <div>
                  <div className="font-semibold">Thông tin Server</div>
                  <div className="text-sm text-muted-foreground">CPU, RAM, Disk usage</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
