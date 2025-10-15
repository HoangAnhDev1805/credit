'use client'

import React, { useState, useEffect } from 'react'
import { SharedTable, TableColumn } from '@/components/shared/Table'
import { SharedPagination, usePagination } from '@/components/shared/Pagination'
import { useToast } from '@/components/shared/Toast'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { Search, Filter, Download, Copy, CreditCard } from 'lucide-react'

interface Card {
  _id: string
  fullCard: string
  cardNumber: string
  status: 'live' | 'die' | 'unknown' | 'checking'
  brand: string
  userId: {
    _id: string
    username: string
    email: string
  }
  checkedAt: string
  createdAt: string
  bin: string
  country: string
  bank: string
}

export default function CardManagement() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCards, setTotalCards] = useState(0)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [searchPosition, setSearchPosition] = useState('all') // all, start, middle, end
  
  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages
  } = usePagination(totalCards, 20)
  
  const { success, error: showError } = useToast()

  useEffect(() => {
    fetchCards()
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, brandFilter])

  const fetchCards = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(brandFilter !== 'all' && { brand: brandFilter })
      })

      const response = await apiClient.get(`/admin/cards?${params}`)
      setCards(response.data.data.cards)
      setTotalCards(response.data.data.pagination.totalItems)
    } catch (error: any) {
      console.error('Failed to fetch cards:', error)
      showError('Lỗi tải dữ liệu', 'Không thể tải danh sách thẻ')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCard = (card: string) => {
    navigator.clipboard.writeText(card)
    success('Đã sao chép', 'Thông tin thẻ đã được sao chép vào clipboard')
  }

  const handleExportCards = () => {
    const filteredCards = cards.filter(card => {
      if (statusFilter !== 'all' && card.status !== statusFilter) return false
      if (brandFilter !== 'all' && card.brand !== brandFilter) return false
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const cardLower = card.fullCard.toLowerCase()
        
        switch (searchPosition) {
          case 'start':
            return cardLower.startsWith(searchLower)
          case 'end':
            return cardLower.endsWith(searchLower)
          case 'middle':
            return cardLower.includes(searchLower) && 
                   !cardLower.startsWith(searchLower) && 
                   !cardLower.endsWith(searchLower)
          default:
            return cardLower.includes(searchLower)
        }
      }
      return true
    })

    const csvContent = [
      'Card,Status,Brand,User,Checked Date',
      ...filteredCards.map(card => 
        `"${card.fullCard}","${card.status}","${card.brand}","${card.userId.username}","${new Date(card.checkedAt).toLocaleString()}"`
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cards_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    success('Xuất file thành công', `Đã xuất ${filteredCards.length} thẻ`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'default'
      case 'die':
        return 'destructive'
      case 'checking':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getBrandIcon = (brand: string) => {
    // You can add specific brand icons here
    return <CreditCard className="h-4 w-4" />
  }

  const columns: TableColumn[] = [
    {
      key: 'fullCard',
      label: 'Thông tin thẻ',
      width: '300px',
      render: (value, row) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm">{value}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyCard(value)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {getBrandIcon(row.brand)}
            <span>{row.brand}</span>
            {row.bin && <span>BIN: {row.bin}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Trạng thái',
      align: 'center',
      filterable: true,
      render: (value) => (
        <Badge 
          variant={getStatusColor(value)}
          className={value === 'live' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 
                     value === 'die' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' : ''}
        >
          {value.toUpperCase()}
        </Badge>
      )
    },
    {
      key: 'userId',
      label: 'Người dùng',
      render: (value) => (
        <div>
          <div className="font-medium">{value.username}</div>
          <div className="text-xs text-muted-foreground">{value.email}</div>
        </div>
      )
    },
    {
      key: 'checkedAt',
      label: 'Ngày kiểm tra',
      sortable: true,
      render: (value) => (
        <div>
          <div>{new Date(value).toLocaleDateString('vi-VN')}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(value).toLocaleTimeString('vi-VN')}
          </div>
        </div>
      )
    },
    {
      key: 'country',
      label: 'Quốc gia',
      align: 'center',
      render: (value) => value || 'N/A'
    },
    {
      key: 'bank',
      label: 'Ngân hàng',
      render: (value) => value || 'N/A'
    }
  ]

  const brands = Array.from(new Set(cards.map(card => card.brand))).filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">List Bin Card</h1>
          <p className="text-muted-foreground">Danh sách tất cả thẻ đã được kiểm tra</p>
        </div>
        <Button onClick={handleExportCards} disabled={cards.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Xuất file CSV
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">
            {cards.filter(c => c.status === 'live').length}
          </div>
          <div className="text-sm text-muted-foreground">Thẻ Live</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-red-600">
            {cards.filter(c => c.status === 'die').length}
          </div>
          <div className="text-sm text-muted-foreground">Thẻ Die</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {cards.filter(c => c.status === 'unknown').length}
          </div>
          <div className="text-sm text-muted-foreground">Chưa xác định</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {totalCards.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Tổng số thẻ</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm số thẻ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={searchPosition} onValueChange={setSearchPosition}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tìm kiếm toàn bộ</SelectItem>
              <SelectItem value="start">Tìm ở đầu</SelectItem>
              <SelectItem value="middle">Tìm ở giữa</SelectItem>
              <SelectItem value="end">Tìm ở cuối</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="die">Die</SelectItem>
              <SelectItem value="unknown">Chưa xác định</SelectItem>
              <SelectItem value="checking">Đang kiểm tra</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Thương hiệu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <SharedTable
        data={cards}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="Không có thẻ nào"
      />

      {/* Pagination */}
      <SharedPagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalCards / itemsPerPage)}
        totalItems={totalCards}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        itemsPerPageOptions={[10, 20, 50, 100]}
      />
    </div>
  )
}
