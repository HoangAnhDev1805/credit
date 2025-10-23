'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api'
import { useBinDatabase } from '@/hooks/use-bin-database'
import { enrichCardWithBin } from '@/lib/binDatabase'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SharedPagination, usePagination } from '@/components/shared/Pagination'
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Clock, 
  TrendingUp,
  Download,
  RefreshCw,
  Filter,
  X,
  FileText,
  FileSpreadsheet
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface HistoryCardItem {
  _id: string
  cardNumber: string
  expiryMonth?: string
  expiryYear?: string
  cvv?: string
  fullCard?: string
  brand?: string
  bin?: string
  country?: string
  bank?: string
  level?: string
  status: 'live' | 'die' | 'dead' | 'error' | 'pending' | 'unknown' | 'checking'
  typeCheck?: number
  errorMessage?: string
  checkedAt?: string
  createdAt: string
}

interface Stats {
  total: number
  live: number
  dead: number
  unknown: number
  pending: number
  error: number
  successRate: number
}

export default function CardHistoryPage() {
  const { toast } = useToast()
  const { loaded: binLoaded } = useBinDatabase()
  const [items, setItems] = useState<HistoryCardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [stats, setStats] = useState<Stats>({
    total: 0,
    live: 0,
    dead: 0,
    unknown: 0,
    pending: 0,
    error: 0,
    successRate: 0
  })

  // Filters
  const [status, setStatus] = useState<string>('all')
  const [typeCheck, setTypeCheck] = useState<string>('all')
  const [brand, setBrand] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [search, setSearch] = useState<string>('')

  // Pagination
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage } = usePagination(total, 20)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, status, typeCheck, brand, startDate, endDate])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
        ...(status !== 'all' ? { status } : {}),
        ...(typeCheck !== 'all' ? { typeCheck } : {}),
        ...(brand !== 'all' ? { brand } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {})
      })
      const res = await apiClient.get(`/cards/history?${params.toString()}`)
      const data = (res as any)?.data?.data
      const list: HistoryCardItem[] = data?.cards || []
      const filtered = search
        ? list.filter((c) => (c.cardNumber || '').toLowerCase().includes(search.toLowerCase()) || 
                             (c.fullCard || '').toLowerCase().includes(search.toLowerCase()))
        : list
      setItems(filtered)
      
      // Use total from pagination (database total with filters)
      const dbTotal = data?.pagination?.total || filtered.length
      setTotal(dbTotal)
      
      // Get stats from API (total database stats with filters applied)
      if (data?.stats) {
        const apiStats = data.stats
        
        setStats({
          total: apiStats.total || dbTotal,
          live: apiStats.live || 0,
          dead: (apiStats.dead || apiStats.die || 0),
          unknown: apiStats.unknown || 0,
          pending: apiStats.pending || 0,
          error: apiStats.error || 0,
          successRate: apiStats.successRate || 0
        })
      } else {
        setStats({
          total: dbTotal,
          live: 0,
          dead: 0,
          unknown: 0,
          pending: 0,
          error: 0,
          successRate: 0
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to fetch card history',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportTxt = () => {
    try {
      // Format: card|STATUS: xxx|TYPE:  xxx  | LEVEL:  xxx  | BANK: xxx|COUNTRY [CheckerCC.Live]
      const lines = items.map(it => {
        // Enrich with BIN database
        const enriched = binLoaded ? enrichCardWithBin(it) : it
        
        const fullCard = enriched.fullCard || `${enriched.cardNumber}|${enriched.expiryMonth}|${enriched.expiryYear}|${enriched.cvv}`
        const status = `STATUS: ${(enriched.status || '').toUpperCase()}`
        const typeCheck = enriched.typeCheck ? `TYPE:  ${(enriched.typeCheck === 1 ? 'CREDIT' : enriched.typeCheck === 2 ? 'DEBIT' : '').padEnd(10)}` : 'TYPE:  ' + ''.padEnd(10)
        const level = enriched.level ? `LEVEL:  ${(enriched.level.toUpperCase()).padEnd(10)}` : 'LEVEL:  ' + ''.padEnd(10)
        const bank = enriched.bank ? `BANK: ${enriched.bank}` : 'BANK: '
        const country = enriched.country ? `${enriched.country} [CheckerCC.Live]` : '[CheckerCC.Live]'
        
        return `${fullCard}|${status}|${typeCheck}| ${level}| ${bank}|${country}`
      })
      const content = lines.join('\n')
      
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cards-${new Date().toISOString().slice(0,10)}.txt`
      a.click()
      URL.revokeObjectURL(url)
      
      toast({ title: 'Success', description: 'Cards exported to TXT successfully' })
    } catch (e: any) {
      toast({ title: 'Error', description: 'Failed to export TXT', variant: 'destructive' })
    }
  }

  const handleExportExcel = () => {
    try {
      const header = 'Full Card,Status,Type,Level,Bank,Country,Card Number,Expiry Month,Expiry Year,CVV,Brand,BIN,Error Message,Checked At,Created At'
      const rows = items.map(it => {
        // Enrich with BIN database
        const enriched = binLoaded ? enrichCardWithBin(it) : it
        
        const typeCheck = enriched.typeCheck === 1 ? 'CREDIT' : enriched.typeCheck === 2 ? 'DEBIT' : ''
        return [
          enriched.fullCard || '',
          enriched.status || '',
          typeCheck,
          (enriched.level || '').toUpperCase(),
          enriched.bank || '',
          enriched.country || '',
          enriched.cardNumber || '',
          enriched.expiryMonth || '',
          enriched.expiryYear || '',
          enriched.cvv || '',
          (enriched.brand || '').toUpperCase(),
          enriched.bin || '',
          (enriched.errorMessage || '').replace(/,/g, ';'),
          enriched.checkedAt ? new Date(enriched.checkedAt).toISOString() : '',
          new Date(enriched.createdAt).toISOString()
        ].join(',')
      })
      
      const csv = [header, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cards-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast({ title: 'Success', description: 'Cards exported to CSV/Excel successfully' })
    } catch (e: any) {
      toast({ title: 'Error', description: 'Failed to export CSV', variant: 'destructive' })
    }
  }

  const resetFilters = () => {
    setStatus('all')
    setTypeCheck('all')
    setBrand('all')
    setStartDate('')
    setEndDate('')
    setSearch('')
    setCurrentPage(1)
  }

  const getStatusConfig = (st: string) => {
    const s = String(st).toLowerCase()
    if (s === 'live') return { 
      class: 'bg-green-50 text-green-700 border-green-200',
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'Live'
    }
    if (s === 'dead' || s === 'die') return { 
      class: 'bg-red-50 text-red-700 border-red-200',
      icon: <XCircle className="h-3 w-3" />,
      label: 'Dead'
    }
    if (s === 'unknown') return { 
      class: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      icon: <HelpCircle className="h-3 w-3" />,
      label: 'Unknown'
    }
    if (s === 'pending' || s === 'checking') return { 
      class: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <Clock className="h-3 w-3" />,
      label: 'Pending'
    }
    if (s === 'error') return { 
      class: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <XCircle className="h-3 w-3" />,
      label: 'Error'
    }
    return { 
      class: 'bg-gray-50 text-gray-700 border-gray-200',
      icon: <HelpCircle className="h-3 w-3" />,
      label: 'Unknown'
    }
  }

  const getBrandIcon = (brand?: string) => {
    const b = String(brand || '').toLowerCase()
    if (b === 'visa') return '💳'
    if (b === 'mastercard') return '💳'
    if (b === 'amex') return '💳'
    if (b === 'discover') return '💳'
    return '💳'
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 lg:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Card History</h1>
          <p className="text-muted-foreground mt-1">Browse and analyze your checked cards</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => setFiltersOpen(!filtersOpen)} 
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {filtersOpen ? 'Hide' : 'Show'} Filters
          </Button>
          <Button 
            onClick={handleExportTxt}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={items.length === 0}
          >
            <FileText className="h-4 w-4" />
            Export TXT
          </Button>
          <Button 
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={items.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All time records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Cards</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.live}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully validated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dead Cards</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.dead}</div>
            <p className="text-xs text-muted-foreground mt-1">Failed validation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Live / Total checked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {filtersOpen && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Filters & Search</CardTitle>
                <CardDescription>Refine your card history view</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFiltersOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input 
                placeholder="Search by card number or full card..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="dead">Dead</SelectItem>
                    <SelectItem value="die">Die</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Gate Type</label>
                <Select value={typeCheck} onValueChange={setTypeCheck}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Gates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Gates</SelectItem>
                    <SelectItem value="1">Gate Type 1</SelectItem>
                    <SelectItem value="2">Gate Type 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Card Brand</label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="mastercard">Mastercard</SelectItem>
                    <SelectItem value="amex">American Express</SelectItem>
                    <SelectItem value="discover">Discover</SelectItem>
                    <SelectItem value="jcb">JCB</SelectItem>
                    <SelectItem value="diners">Diners Club</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-sm"
                    placeholder="From"
                  />
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-sm"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={resetFilters}
                size="sm"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Reset All
              </Button>
              <Button 
                onClick={() => fetchData()} 
                disabled={loading}
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards List */}
      <div className="space-y-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No cards found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or check back later</p>
            </CardContent>
          </Card>
        ) : (
          items.map((it) => {
            const statusConfig = getStatusConfig(it.status)
            return (
              <Card key={it._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Card Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Card Number & Brand */}
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getBrandIcon(it.brand)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-base font-semibold break-all">
                            {it.fullCard || `${it.cardNumber}|${it.expiryMonth}|${it.expiryYear}|${it.cvv}`}
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {it.brand || 'Unknown'} {it.bin && `• BIN ${it.bin}`}
                          </div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {it.country && <div><span className="font-medium">Country:</span> {it.country}</div>}
                        {it.bank && <div><span className="font-medium">Bank:</span> {it.bank}</div>}
                        {it.level && <div><span className="font-medium">Level:</span> {it.level}</div>}
                        {it.typeCheck && <div><span className="font-medium">Gate:</span> Type {it.typeCheck}</div>}
                        <div><span className="font-medium">Created:</span> {new Date(it.createdAt).toLocaleString()}</div>
                        {it.checkedAt && <div><span className="font-medium">Checked:</span> {new Date(it.checkedAt).toLocaleString()}</div>}
                      </div>

                      {/* Error Message */}
                      {it.errorMessage && (
                        <div className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded">
                          {it.errorMessage}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <Badge className={`border shrink-0 self-start lg:self-center flex items-center gap-1.5 ${statusConfig.class}`}>
                      {statusConfig.icon}
                      {statusConfig.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })
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
