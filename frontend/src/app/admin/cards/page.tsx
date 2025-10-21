'use client'

import React, { useState, useEffect } from 'react'
import { SharedTable, TableColumn, TableAction } from '@/components/shared/Table'
import { SharedModal } from '@/components/shared/Modal'
import { SharedPagination, usePagination } from '@/components/shared/Pagination'
import { useToast } from '@/components/shared/Toast'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { Search, Filter, Download, Copy, CreditCard, Eye, CheckCircle2, XCircle, HelpCircle, Workflow } from 'lucide-react'

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
  originUserId?: {
    _id: string
    username: string
    email: string
  } | null
  checkedAt?: string | null
  createdAt: string
  bin?: string | null
  country?: string | null
  bank?: string | null
  level?: string | null
  typeCheck?: string | null
  sessionId?: string | null
  apiId?: string | null
  price?: number | null
  errorMessage?: string | null
}

export default function CardManagement() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCards, setTotalCards] = useState(0)
  const [totals, setTotals] = useState<{live:number;die:number;unknown:number;checking:number;all:number}>({live:0,die:0,unknown:0,checking:0,all:0})
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Card|null>(null)
  const [gateMap, setGateMap] = useState<Record<string | number, string>>({})
  
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

  // Load gates to map TypeCheck -> Gate name
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/gates')
        const list = res?.data?.data?.gates || []
        const map: Record<string | number, string> = {}
        list.forEach((g: any) => { map[g.typeCheck] = g.name })
        setGateMap(map)
      } catch {}
    })()
  }, [])

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
      if (response.data?.data?.totals) setTotals(response.data.data.totals)
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

  const filterCards = () => {
    return cards.filter(card => {
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
  }

  const handleExportCards = () => {
    const filteredCards = filterCards()

    const csvContent = [
      'Card,Status,Brand,BIN,Type,Level,Bank,Country,User,OriginUser,SessionId,ApiId,Price,ErrorMessage,Checked Date,Created Date',
      ...filteredCards.map(card => {
        const checked = card.checkedAt ? new Date(card.checkedAt).toLocaleString('vi-VN') : ''
        const created = card.createdAt ? new Date(card.createdAt).toLocaleString('vi-VN') : ''
        const originUser = card.originUserId ? card.originUserId.username : ''
        return `"${card.fullCard}","${card.status}","${card.brand||''}","${card.bin||''}","${card.typeCheck||''}","${card.level||''}","${card.bank||''}","${card.country||''}","${card.userId.username}","${originUser}","${card.sessionId||''}","${card.apiId||''}","${card.price??''}","${(card.errorMessage||'').replace(/"/g,'\"')}","${checked}","${created}"`
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cards_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    success('Xuất file thành công', `Đã xuất ${filteredCards.length} thẻ (CSV)`)
  }

  const handleExportTxt = () => {
    const filteredCards = filterCards()
    const txt = filteredCards.map(c => c.fullCard).join('\n')

    const blob = new Blob([txt], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cards_export_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
    success('Xuất file thành công', `Đã xuất ${filteredCards.length} thẻ (TXT)`)
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
      key: 'cardNumber',
      label: 'Số thẻ',
      width: '220px',
      render: (value, row: Card) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm">{row.fullCard || value}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyCard(value)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelected(row); setDetailOpen(true) }}
              className="h-6 w-6 p-0 md:hidden"
              title="Xem chi tiết"
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {getBrandIcon(row.brand)}
            <span>{row.brand || '—'}</span>
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
      render: (value: Card['status']) => (
        <Badge
          variant={getStatusColor(value)}
          className={value === 'live' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                     value === 'die' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' : ''}
        >
          {value === 'live' ? 'Live' : value === 'die' ? 'Die' : value === 'checking' ? 'Đang kiểm tra' : 'Chưa xác định'}
        </Badge>
      )
    },
    {
      key: 'typeCheck',
      label: 'GATE',
      align: 'center',
      render: (value?: string | number | null) => (
        <span className="text-xs font-medium">{gateMap[String(value ?? '')] || String(value ?? '—')}</span>
      )
    },
    {
      key: 'checkedAt',
      label: 'Kiểm tra',
      sortable: true,
      render: (value?: string | null) => (
        value ? (
          <div>
            <div>{new Date(value).toLocaleDateString('vi-VN')}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(value).toLocaleTimeString('vi-VN')}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      )
    },
    {
      key: 'createdAt',
      label: 'Ngày tạo',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString('vi-VN')
    },
    {
      key: 'userId',
      label: 'Người dùng',
      render: (value, row: Card) => {
        const u = (row as any).originUserId || (row as any).userId || value || {}
        const username = u?.username || '—'
        const email = u?.email || ''
        return (
          <div>
            <div className="font-medium">{username}</div>
            {email && <div className="text-xs text-muted-foreground">{email}</div>}
          </div>
        )
      }
    }
  ]

  const actions: TableAction[] = [
    {
      label: 'Xem',
      icon: <Eye className="h-4 w-4" />,
      onClick: (row: Card) => { setSelected(row); setDetailOpen(true); }
    }
  ]

  const brands = Array.from(new Set(cards.map(card => card.brand))).filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản lý thẻ</h1>
          <p className="text-muted-foreground">Danh sách thẻ trong hệ thống</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCards} disabled={cards.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Xuất file CSV
          </Button>
          <Button variant="secondary" onClick={handleExportTxt} disabled={cards.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Xuất file TXT
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
          <CheckCircle2 className="text-green-600" />
          <div>
            <div className="text-2xl font-bold text-green-600">{totals.live}</div>
            <div className="text-sm text-muted-foreground">Thẻ Live (toàn hệ thống)</div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
          <XCircle className="text-red-600" />
          <div>
            <div className="text-2xl font-bold text-red-600">{totals.die}</div>
            <div className="text-sm text-muted-foreground">Thẻ Die (toàn hệ thống)</div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
          <HelpCircle className="text-yellow-600" />
          <div>
            <div className="text-2xl font-bold text-yellow-600">{totals.unknown}</div>
            <div className="text-sm text-muted-foreground">Chưa xác định</div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
          <Workflow className="text-blue-600" />
          <div>
            <div className="text-2xl font-bold text-blue-600">{totals.checking}</div>
            <div className="text-sm text-muted-foreground">Đang kiểm tra</div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
          <CreditCard />
          <div>
            <div className="text-2xl font-bold">{totals.all.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Tổng số thẻ (toàn hệ thống)</div>
          </div>
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
        actions={actions}
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

      {/* Detail Modal */}
      <SharedModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết thẻ"
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="p-3 border rounded bg-muted/40">
              <div className="font-mono text-sm break-all">{selected.fullCard}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">GATE</div>
                <div className="font-medium">{gateMap[String(selected.typeCheck ?? '')] || String(selected.typeCheck ?? '—')}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Trạng thái</div>
                <div className="font-medium">{selected.status?.toUpperCase?.() || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">BIN</div>
                <div className="font-medium">{selected.bin || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Brand</div>
                <div className="font-medium">{selected.brand || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Bank</div>
                <div className="font-medium">{selected.bank || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Country</div>
                <div className="font-medium">{selected.country || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Level</div>
                <div className="font-medium">{selected.level || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Người dùng</div>
                <div className="font-medium">{selected.originUserId?.username || selected.userId?.username || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Ngày tạo</div>
                <div className="font-medium">{selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Ngày kiểm tra</div>
                <div className="font-medium">{selected.checkedAt ? new Date(selected.checkedAt).toLocaleString('vi-VN') : '—'}</div>
              </div>
              {selected.errorMessage && (
                <div className="md:col-span-2">
                  <div className="text-muted-foreground">Thông báo</div>
                  <div className="font-medium break-words">{selected.errorMessage}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </SharedModal>
    </div>
  )
}
