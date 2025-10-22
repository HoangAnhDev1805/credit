'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { SharedTable, TableColumn, TableAction } from '@/components/shared/Table'
import { SharedModal } from '@/components/shared/Modal'
import { SharedPagination, usePagination } from '@/components/shared/Pagination'
import { useToast } from '@/components/shared/Toast'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useSocket } from '@/hooks/use-socket'
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
  const [stats, setStats] = useState<{foundTotal:number;duplicateCount:number;liveCount:number;dieCount:number;unknownCount:number;pendingCount:number}>({foundTotal:0,duplicateCount:0,liveCount:0,dieCount:0,unknownCount:0,pendingCount:0})
  const [globalStats, setGlobalStats] = useState<{total:number;live:number;die:number;unknown:number;checking:number}>({total:0,live:0,die:0,unknown:0,checking:0})
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Card|null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [gateMap, setGateMap] = useState<Record<string | number, string>>({})
  const { on: socketOn } = useSocket({ enabled: true })
  
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
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, brandFilter, searchPosition])

  // Realtime refresh when card updated
  useEffect(() => {
    const unsub = socketOn('card:updated', () => {
      fetchCards()
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

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
        ...(searchTerm && { q: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(brandFilter !== 'all' && { brand: brandFilter }),
        mode: (searchPosition === 'start' ? 'startsWith' : (searchPosition === 'end' ? 'endsWith' : 'contains'))
      })

      const response = await apiClient.get(`/admin/cards?${params}`)
      let list: Card[] = response.data.data.cards || []
      const g = response.data?.data?.globalStats
      if (g) setGlobalStats({
        total: Number(g.total||0),
        live: Number(g.live||0),
        die: Number(g.die||0),
        unknown: Number(g.unknown||0),
        checking: Number(g.checking||0)
      })
      // If user picked 'middle', apply strict middle filtering client-side
      if (searchTerm && searchPosition === 'middle') {
        const q = searchTerm.toLowerCase()
        list = list.filter((c) => {
          const text = (c.fullCard || c.cardNumber || '').toLowerCase()
          return text.includes(q) && !text.startsWith(q) && !text.endsWith(q)
        })
      }
      setCards(list)
      // reset selections if page changed
      setSelectedIds(new Set())
      // total items should reflect filtered list (client-side middle)
      setTotalCards(list.length)
      // Compute stats on the client for the currently displayed list
      const s = { foundTotal: 0, duplicateCount: 0, liveCount: 0, dieCount: 0, unknownCount: 0, pendingCount: 0 }
      const seen = new Map<string, number>()
      for (const c of list) {
        s.foundTotal += 1
        const key = c.cardNumber || c.fullCard || ''
        if (key) seen.set(key, (seen.get(key) || 0) + 1)
        const st = String(c.status)
        if (st === 'live') s.liveCount += 1
        else if (st === 'die') s.dieCount += 1
        else if (st === 'checking' || st === 'pending' || (st === 'unknown' && !c.checkedAt)) s.pendingCount += 1
        else s.unknownCount += 1
      }
      for (const count of Array.from(seen.values())) { if (count > 1) s.duplicateCount += (count - 1) }
      setStats(s)
    } catch (error: any) {
      console.error('Failed to fetch cards:', error)
      showError('Lỗi tải dữ liệu', 'Không thể tải danh sách thẻ')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelectAll = (rows: Card[], checked: boolean) => {
    if (checked) setSelectedIds(new Set(rows.map(r => r._id)))
    else setSelectedIds(new Set())
  }

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectedList = useMemo(() => cards.filter(c => selectedIds.has(c._id)), [cards, selectedIds])

  const toCsvRow = (card: Card) => {
    const checked = card.checkedAt ? new Date(card.checkedAt).toLocaleString('vi-VN') : ''
    const created = card.createdAt ? new Date(card.createdAt).toLocaleString('vi-VN') : ''
    const originUser = card.originUserId ? (card.originUserId as any).username : ''
    const userName = (card.userId as any)?.username
    const q = (s?: string | number | null) => `"${String(s ?? '').replace(/"/g,'\"')}"`
    return [
      q(card.fullCard), q(card.status), q(card.brand), q(card.bin), q(card.typeCheck), q(card.level), q(card.bank), q(card.country),
      q(userName), q(originUser), q(card.sessionId), q(card.apiId), q(card.price ?? ''), q(card.errorMessage || ''), q(checked), q(created)
    ].join(',')
  }

  const toTxtRow = (card: Card) => {
    const checked = card.checkedAt ? new Date(card.checkedAt).toISOString() : ''
    const created = card.createdAt ? new Date(card.createdAt).toISOString() : ''
    const originUser = card.originUserId ? (card.originUserId as any).username : ''
    const userName = (card.userId as any)?.username
    // Đầy đủ thông tin, phân tách bằng |
    return [
      card.fullCard, card.status, card.brand||'', card.bin||'', String(card.typeCheck||''), card.level||'', card.bank||'', card.country||'',
      userName||'', originUser||'', card.sessionId||'', card.apiId||'', String(card.price ?? ''), (card.errorMessage||'').replace(/\n/g,' '), checked, created
    ].join('|')
  }

  // Export CSV cho danh sách đã chọn (hoặc theo filter nếu chưa chọn)
  const exportSelectedCsv = () => {
    const items = selectedList.length ? selectedList : filterCards()
    const header = 'Card,Status,Brand,BIN,Type,Level,Bank,Country,User,OriginUser,SessionId,ApiId,Price,ErrorMessage,Checked Date,Created Date'
    const csvContent = [header, ...items.map(toCsvRow)].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cards_selected_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    success('Xuất file thành công', `Đã xuất ${items.length} thẻ (CSV)`)  
  }

  // Export TXT đầy đủ cột cho danh sách đã chọn
  const exportSelectedTxt = () => {
    const items = selectedList.length ? selectedList : filterCards()
    const header = ['Card','Status','Brand','BIN','Type','Level','Bank','Country','User','OriginUser','SessionId','ApiId','Price','ErrorMessage','CheckedAt','CreatedAt'].join('|')
    const txt = [header, ...items.map(toTxtRow)].join('\n')
    const blob = new Blob([txt], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cards_selected_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
    success('Xuất file thành công', `Đã xuất ${items.length} thẻ (TXT)`)  
  }

  // Xóa danh sách đã chọn
  const deleteSelected = async () => {
    const ids = selectedList.map(c => c._id)
    if (ids.length === 0) return
    try {
      await apiClient.delete('/admin/cards', { data: { ids } })
      success('Đã xóa', `Đã xóa ${ids.length} thẻ`)
      fetchCards()
    } catch (e:any) {
      showError('Lỗi xóa', e?.response?.data?.message || 'Không thể xóa thẻ đã chọn')
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
    const filteredCards = selectedList.length > 0 ? selectedList : filterCards()
    const header = 'Card,Status,Brand,BIN,Type,Level,Bank,Country,User,OriginUser,SessionId,ApiId,Price,ErrorMessage,Checked Date,Created Date'
    const csvContent = [header, ...filteredCards.map(toCsvRow)].join('\n')

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
    // TXT đầy đủ thông tin (| tách cột)
    const header = ['Card','Status','Brand','BIN','Type','Level','Bank','Country','User','OriginUser','SessionId','ApiId','Price','ErrorMessage','CheckedAt','CreatedAt'].join('|')
    const txt = [header, ...filteredCards.map(toTxtRow)].join('\n')

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
      key: '_select',
      label: (
        <input
          type="checkbox"
          onChange={(e) => toggleSelectAll(cards, e.currentTarget.checked)}
          checked={cards.length>0 && selectedIds.size===cards.length}
          aria-label="Chọn tất cả"
        />
      ) as any,
      width: '40px',
      render: (_v, row: Card) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row._id)}
          onChange={(e) => toggleSelectOne(row._id, e.currentTarget.checked)}
          aria-label={`Chọn ${row.fullCard}`}
        />
      )
    },
    {
      key: 'cardNumber',
      label: 'Số thẻ',
      width: '220px',
      render: (value, row: Card) => {
        const text = row.fullCard || String(value || '')

        const highlightMatch = (txt: string) => {
          const q = searchTerm.trim()
          if (!q) return <span className="font-mono text-sm break-all">{txt}</span>
          const lower = txt.toLowerCase()
          const ql = q.toLowerCase()

          // Helper to split and wrap
          const wrapAllOccurrences = () => {
            const parts: React.ReactNode[] = []
            let idx = 0
            let pos = lower.indexOf(ql, idx)
            while (pos !== -1) {
              if (pos > idx) parts.push(<span key={idx}>{txt.slice(idx, pos)}</span>)
              parts.push(<mark key={`m-${pos}`} className="bg-yellow-300/60 dark:bg-yellow-600/40 px-0.5 rounded">{txt.slice(pos, pos + q.length)}</mark>)
              idx = pos + q.length
              pos = lower.indexOf(ql, idx)
            }
            if (idx < txt.length) parts.push(<span key={idx}>{txt.slice(idx)}</span>)
            return parts
          }

          const starts = lower.startsWith(ql)
          const ends = lower.endsWith(ql)

          if (searchPosition === 'start') {
            if (!starts) return <span className="font-mono text-sm break-all">{txt}</span>
            return (
              <span className="font-mono text-sm break-all">
                <mark className="bg-yellow-300/60 dark:bg-yellow-600/40 px-0.5 rounded">{txt.slice(0, q.length)}</mark>
                {txt.slice(q.length)}
              </span>
            )
          }
          if (searchPosition === 'end') {
            if (!ends) return <span className="font-mono text-sm break-all">{txt}</span>
            const start = txt.length - q.length
            return (
              <span className="font-mono text-sm break-all">
                {txt.slice(0, start)}
                <mark className="bg-yellow-300/60 dark:bg-yellow-600/40 px-0.5 rounded">{txt.slice(start)}</mark>
              </span>
            )
          }
          if (searchPosition === 'middle') {
            // highlight occurrences not at head or tail
            if (!lower.includes(ql)) return <span className="font-mono text-sm break-all">{txt}</span>
            if (starts) {
              // remove head first occurrence
              const head = txt.slice(0, q.length)
              const rest = txt.slice(q.length)
              const restLower = lower.slice(q.length)
              const parts: React.ReactNode[] = [<span key="h" className="opacity-70">{head}</span>]
              let idx = 0
              let pos = restLower.indexOf(ql, idx)
              while (pos !== -1) {
                if (pos > idx) parts.push(<span key={`r-${idx}`}>{rest.slice(idx, pos)}</span>)
                parts.push(<mark key={`rm-${pos}`} className="bg-yellow-300/60 dark:bg-yellow-600/40 px-0.5 rounded">{rest.slice(pos, pos + q.length)}</mark>)
                idx = pos + q.length
                pos = restLower.indexOf(ql, idx)
              }
              if (idx < rest.length) parts.push(<span key={`r-end`}>{rest.slice(idx)}</span>)
              return <span className="font-mono text-sm break-all">{parts}</span>
            }
            if (ends) {
              const tail = txt.slice(txt.length - q.length)
              const body = txt.slice(0, txt.length - q.length)
              const bodyLower = lower.slice(0, lower.length - q.length)
              const parts: React.ReactNode[] = []
              let idx = 0
              let pos = bodyLower.indexOf(ql, idx)
              while (pos !== -1) {
                if (pos > idx) parts.push(<span key={`b-${idx}`}>{body.slice(idx, pos)}</span>)
                parts.push(<mark key={`bm-${pos}`} className="bg-yellow-300/60 dark:bg-yellow-600/40 px-0.5 rounded">{body.slice(pos, pos + q.length)}</mark>)
                idx = pos + q.length
                pos = bodyLower.indexOf(ql, idx)
              }
              if (idx < body.length) parts.push(<span key={`b-end`}>{body.slice(idx)}</span>)
              parts.push(<span key="t" className="opacity-70">{tail}</span>)
              return <span className="font-mono text-sm break-all">{parts}</span>
            }
            // normal middle occurrences
            return <span className="font-mono text-sm break-all">{wrapAllOccurrences()}</span>
          }

          // default contains: highlight all occurrences
          return <span className="font-mono text-sm break-all">{wrapAllOccurrences()}</span>
        }

        return (
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {highlightMatch(text)}
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
      }
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
  const totals = useMemo(() => ({
    live: stats.liveCount,
    die: stats.dieCount,
    unknown: stats.unknownCount,
    checking: stats.pendingCount,
    all: stats.foundTotal
  }), [stats])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản lý thẻ</h1>
          <p className="text-muted-foreground">Danh sách thẻ trong hệ thống</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleExportCards} disabled={cards.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Xuất file CSV
          </Button>
          <Button variant="secondary" onClick={handleExportTxt} disabled={cards.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Xuất file TXT
          </Button>
          <Button variant="outline" onClick={exportSelectedCsv} disabled={selectedList.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV (đã chọn)
          </Button>
          <Button variant="outline" onClick={exportSelectedTxt} disabled={selectedList.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            TXT (đã chọn)
          </Button>
          <Button variant="destructive" onClick={deleteSelected} disabled={selectedList.length === 0}>
            Xóa đã chọn
          </Button>
        </div>
      </div>

      {/* Thống kê tổng theo CSDL */}
      <div className="space-y-2">
        <h3 className="text-sm text-muted-foreground">Tổng theo CSDL</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
            <CreditCard />
            <div>
              <div className="text-2xl font-bold">{globalStats.total.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Tổng số thẻ (toàn bộ)</div>
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
            <CheckCircle2 className="text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{globalStats.live}</div>
              <div className="text-sm text-muted-foreground">Thẻ Live</div>
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
            <XCircle className="text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-600">{globalStats.die}</div>
              <div className="text-sm text-muted-foreground">Thẻ Die</div>
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
            <HelpCircle className="text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-600">{globalStats.unknown}</div>
              <div className="text-sm text-muted-foreground">Chưa xác định</div>
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
            <Workflow className="text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{globalStats.checking}</div>
              <div className="text-sm text-muted-foreground">Đang kiểm tra</div>
            </div>
          </div>
        </div>
      </div>

      {/* Thống kê theo tìm kiếm số thẻ - chỉ hiển thị khi có nhập ô tìm kiếm */}
      {searchTerm.trim() && (
        <div className="space-y-2">
          <h3 className="text-sm text-muted-foreground">Kết quả theo tìm kiếm</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
              <CheckCircle2 className="text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{totals.live}</div>
                <div className="text-sm text-muted-foreground">Live (theo tìm kiếm)</div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
              <XCircle className="text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-600">{totals.die}</div>
                <div className="text-sm text-muted-foreground">Die (theo tìm kiếm)</div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
              <HelpCircle className="text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-600">{totals.unknown}</div>
                <div className="text-sm text-muted-foreground">Chưa xác định (theo tìm kiếm)</div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
              <Workflow className="text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600">{totals.checking}</div>
                <div className="text-sm text-muted-foreground">Đang kiểm tra (theo tìm kiếm)</div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
              <CreditCard />
              <div>
                <div className="text-2xl font-bold">{totals.all.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Tổng tìm thấy (theo tìm kiếm)</div>
              </div>
            </div>
          </div>
        </div>
      )}

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
