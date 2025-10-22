'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SharedPagination, usePagination } from '@/components/shared/Pagination'

interface HistoryCardItem {
  id: string
  cardNumber: string
  brand?: string
  bin?: string
  status: 'live' | 'dead' | 'error' | 'pending' | 'unknown'
  checkType?: number
  response?: any
  checkedAt?: string
  createdAt: string
  transaction?: { amount: number; createdAt: string }
}

export default function CardHistoryPage() {
  const [items, setItems] = useState<HistoryCardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // Filters
  const [status, setStatus] = useState<string>('all')
  const [checkType, setCheckType] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [q, setQ] = useState<string>('')

  // Pagination
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage } = usePagination(total, 20)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, status, checkType, startDate, endDate])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
        ...(status !== 'all' ? { status } : {}),
        ...(checkType !== 'all' ? { checkType } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {})
      })
      const res = await apiClient.get(`/cards/history?${params.toString()}`)
      const data = (res as any)?.data?.data
      const list: HistoryCardItem[] = data?.cards || []
      const filtered = q
        ? list.filter((c) => (c.cardNumber || '').toLowerCase().includes(q.toLowerCase()))
        : list
      setItems(filtered)
      setTotal(data?.pagination?.total || filtered.length)
    } catch (e) {
      console.error('Fetch history failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const s = { total: 0, live: 0, dead: 0, unknown: 0, pending: 0, error: 0, duplicates: 0 }
    const seen = new Map<string, number>()
    for (const it of items) {
      s.total += 1
      seen.set(it.cardNumber, (seen.get(it.cardNumber) || 0) + 1)
      const st = String(it.status)
      if (st === 'live') s.live += 1
      else if (st === 'dead' || st === 'die') s.dead += 1
      else if (st === 'pending' || st === 'checking') s.pending += 1
      else if (st === 'error') s.error += 1
      else s.unknown += 1
    }
    for (const c of Array.from(seen.values())) { if (c > 1) s.duplicates += 1 }
    return s
  }, [items])

  const statusClass = (st: string) => {
    const s = String(st).toLowerCase()
    if (s === 'live') return 'bg-green-100 text-green-700 border-green-200'
    if (s === 'dead') return 'bg-red-100 text-red-700 border-red-200'
    if (s === 'unknown') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    if (s === 'pending') return 'bg-blue-100 text-blue-700 border-blue-200'
    if (s === 'error') return 'bg-rose-100 text-rose-700 border-rose-200'
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="space-y-6 p-2 sm:p-0 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold">Card History</h1>
        <p className="text-muted-foreground">Browse your previous checked cards with filters and stats</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-4 border rounded-lg"><div className="text-sm text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></div>
        <div className="p-4 border rounded-lg"><div className="text-sm text-muted-foreground">Duplicates</div><div className="text-2xl font-bold">{stats.duplicates}</div></div>
        <div className="p-4 border rounded-lg"><div className="text-sm text-muted-foreground">Live</div><div className="text-2xl font-bold text-green-600">{stats.live}</div></div>
        <div className="p-4 border rounded-lg"><div className="text-sm text-muted-foreground">Dead</div><div className="text-2xl font-bold text-red-600">{stats.dead}</div></div>
        <div className="p-4 border rounded-lg"><div className="text-sm text-muted-foreground">Unknown</div><div className="text-2xl font-bold text-yellow-600">{stats.unknown}</div></div>
        <div className="p-4 border rounded-lg"><div className="text-sm text-muted-foreground">Pending</div><div className="text-2xl font-bold text-blue-600">{stats.pending}</div></div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="relative md:col-span-2">
          <Input placeholder="Search card number..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={checkType} onValueChange={setCheckType}>
          <SelectTrigger>
            <SelectValue placeholder="Gate / Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="1">Type 1</SelectItem>
            <SelectItem value="2">Type 2</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Actions (placed right under filters on all screens) */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setStatus('all'); setCheckType('all'); setStartDate(''); setEndDate(''); setQ(''); setCurrentPage(1); }}>Reset Filters</Button>
          <Button onClick={() => fetchData()} disabled={loading}>Refresh</Button>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          {/* reserved for quick tips or counts if needed */}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 overflow-hidden">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm break-words break-all">{it.cardNumber}</div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span>Brand: {it.brand || '—'}</span>
                <span>BIN: {it.bin || '—'}</span>
                <span>Gate: {it.checkType ?? '—'}</span>
                <span>Created: {it.createdAt ? new Date(it.createdAt).toLocaleString() : '—'}</span>
                {it.checkedAt && <span>Checked: {new Date(it.checkedAt).toLocaleString()}</span>}
              </div>
            </div>
            <Badge className={`border shrink-0 self-start sm:self-auto ${statusClass(it.status as any)}`}>{String(it.status).toUpperCase()}</Badge>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="text-center text-muted-foreground py-8">No records found</div>
        )}
      </div>

      <SharedPagination
        currentPage={currentPage}
        totalPages={Math.ceil(total / itemsPerPage)}
        totalItems={total}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        itemsPerPageOptions={[10, 20, 50, 100]}
      />
    </div>
  )
}
