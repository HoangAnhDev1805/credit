'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { StatCard, CardGrid } from '@/components/shared/Cards'
import { useToast } from '@/components/shared/Toast'
import { apiClient } from '@/lib/api'
import {
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react'

interface DashboardStats {
  users: {
    total: number
    active: number
    inactive: number
    banned: number
    totalBalance: number
  }
  cards: {
    total: number
    live: number
    dead: number
    pending: number
    error: number
  }
  payments: {
    total: number
    pending: number
    approved: number
    rejected: number
    totalAmount: number
    totalApproved: number
  }
  transactions: {
    [key: string]: {
      count: number
      amount: number
    }
  }
  recentActivities: {
    users: Array<any>
    payments: Array<any>
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { error: showError } = useToast()

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/admin/dashboard')
      setStats(response.data.data)
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error)
      showError('Lỗi tải dữ liệu', 'Không thể tải thống kê dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Tổng quan hệ thống</p>
        </div>
        
        <CardGrid columns={4}>
          {[...Array(8)].map((_, i) => (
            <StatCard
              key={i}
              title=""
              value=""
              loading={true}
            />
          ))}
        </CardGrid>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            Không thể tải dữ liệu
          </h3>
          <button
            onClick={fetchDashboardStats}
            className="text-primary hover:underline"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  const userSuccessRate = stats.users.total > 0
    ? ((stats.users.active / stats.users.total) * 100).toFixed(1)
    : '0'

  const cardSuccessRate = stats.cards.total > 0
    ? ((stats.cards.live / stats.cards.total) * 100).toFixed(1)
    : '0'

  const paymentApprovalRate = stats.payments.total > 0
    ? ((stats.payments.approved / stats.payments.total) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Tổng quan hệ thống quản trị</p>
      </div>

      {/* Admin Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/api-tester" className="p-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center space-x-4">
            <Zap className="h-10 w-10 text-white" />
            <div>
              <h3 className="text-lg font-semibold text-white">Test API</h3>
              <p className="text-sm text-cyan-100">Kiểm tra LoaiDV 1 & 2</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/api-tester?tab=receiver" className="p-6 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center space-x-4">
            <CreditCard className="h-10 w-10 text-white" />
            <div>
              <h3 className="text-lg font-semibold text-white">Test API LoaiDV 2</h3>
              <p className="text-sm text-orange-100">Gửi kết quả (Receiver)</p>
            </div>
          </div>
        </Link>
      </div>

      {/* User Statistics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Thống kê người dùng</h2>
        <CardGrid columns={4}>
          <StatCard
            title="Tổng số tài khoản"
            value={(stats.users.total || 0).toLocaleString()}
            icon={Users}
            color="primary"
            description="Tất cả người dùng"
          />
          <StatCard
            title="Tài khoản hoạt động"
            value={(stats.users.active || 0).toLocaleString()}
            icon={CheckCircle}
            color="success"
            description={`${userSuccessRate}% tổng số`}
            trend={{
              value: parseFloat(userSuccessRate),
              label: "hoạt động",
              isPositive: true
            }}
          />
          <StatCard
            title="Tài khoản bị khóa"
            value={(stats.users.banned || 0).toLocaleString()}
            icon={AlertCircle}
            color="danger"
            description="Cần xem xét"
          />
          <StatCard
            title="Tổng số dư"
            value={`$${(stats.users.totalBalance || 0).toLocaleString()}`}
            icon={DollarSign}
            color="warning"
            description="Số dư tất cả user"
          />
        </CardGrid>
      </div>

      {/* Card Statistics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Thống kê thẻ tín dụng</h2>
        <CardGrid columns={4}>
          <StatCard
            title="Tổng thẻ đã kiểm tra"
            value={(stats.cards.total || 0).toLocaleString()}
            icon={CreditCard}
            color="primary"
            description="Tất cả thẻ"
          />
          <StatCard
            title="Thẻ Live"
            value={(stats.cards.live || 0).toLocaleString()}
            icon={CheckCircle}
            color="success"
            description={`${cardSuccessRate}% tổng số`}
            trend={{
              value: parseFloat(cardSuccessRate),
              label: "thành công",
              isPositive: true
            }}
          />
          <StatCard
            title="Thẻ Dead"
            value={(stats.cards.dead || 0).toLocaleString()}
            icon={AlertCircle}
            color="danger"
            description="Không hoạt động"
          />
          <StatCard
            title="Thẻ lỗi"
            value={(stats.cards.error || 0).toLocaleString()}
            icon={Clock}
            color="warning"
            description="Lỗi kiểm tra"
          />
        </CardGrid>
      </div>

      {/* Payment Statistics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Thống kê thanh toán</h2>
        <CardGrid columns={4}>
          <StatCard
            title="Tổng yêu cầu"
            value={(stats.payments.total || 0).toLocaleString()}
            icon={DollarSign}
            color="primary"
            description="Tất cả yêu cầu"
          />
          <StatCard
            title="Chờ duyệt"
            value={(stats.payments.pending || 0).toLocaleString()}
            icon={Clock}
            color="warning"
            description="Cần xử lý"
          />
          <StatCard
            title="Đã duyệt"
            value={(stats.payments.approved || 0).toLocaleString()}
            icon={CheckCircle}
            color="success"
            description={`${paymentApprovalRate}% tổng số`}
            trend={{
              value: parseFloat(paymentApprovalRate),
              label: "được duyệt",
              isPositive: true
            }}
          />
          <StatCard
            title="Tổng số tiền"
            value={`$${(stats.payments.totalAmount || 0).toLocaleString()}`}
            icon={TrendingUp}
            color="primary"
            description="Đã xử lý"
          />
        </CardGrid>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Hoạt động gần đây</h2>
        <div className="bg-card rounded-lg border p-6">
          {(stats.recentActivities?.users && stats.recentActivities.users.length > 0) ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="font-medium">Người dùng mới gần đây</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.recentActivities.users.slice(0, 6).map((user: any, index) => (
                  <div key={index} className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                    <div className="text-lg font-semibold">
                      {user.username}
                    </div>
                    <div className="text-sm text-blue-600">
                      {user.role} - {user.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Chưa có hoạt động nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
