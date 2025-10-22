"use client"

import "@/styles/checker.css"
import { useEffect, useMemo, useRef, useState } from "react"
import { apiClient, type Card } from "@/lib/api"
import { useSocket } from "@/hooks/use-socket"
import { Button } from "@/components/ui/button"
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Copy,
  Play,
  Square,
  Trash2,
  CreditCard,
  DollarSign,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Download,
  Zap,
  Shield,
  BarChart3,
  Wallet,
  Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/components/I18nProvider"
import { useAuthStore } from "@/lib/auth"

interface CheckResult {
  id: string
  card: string
  status: "Live" | "Dead" | "Error" | "Unknown" | "Checking"
  response?: string
}

interface Gate {
  id: string
  name: string
  typeCheck: number
  description?: string
}

export default function CheckerPage() {
  const { toast } = useToast()
  const { t } = useI18n()
  const { user } = useAuthStore()
  
  // Setup Socket.IO connection
  const { on: socketOn, isConnected } = useSocket({ enabled: true, debug: false })

  // Input & session
  const [cardsInput, setCardsInput] = useState("")
  const [selectedGate, setSelectedGate] = useState<string>("") // Will be set from gates
  const [gates, setGates] = useState<Gate[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cardCache, setCardCache] = useState<Map<string, CheckResult>>(new Map())
  const [timeoutSec, setTimeoutSec] = useState<number>(120)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const [hasFetched, setHasFetched] = useState<boolean>(false)

  // Pricing & balance
  const [balance, setBalance] = useState<number>(0)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [pricePerCard, setPricePerCard] = useState<number>(1)
  const [gateCostMap, setGateCostMap] = useState<Record<string, number>>({})
  const [pricingTiers, setPricingTiers] = useState<Array<{ min: number; max: number | null; total: number | null; pricePerCard?: number }>>([{ min: 1, max: null, total: null, pricePerCard: 1 }])

  // Stats
  const [stats, setStats] = useState({
    live: 0,
    dead: 0,
    error: 0,
    unknown: 0,
    total: 0,
    progress: 0,
    successRate: 0,
    liveRate: 0,
  })

  // Results
  const [results, setResults] = useState<CheckResult[]>([])
  const [filter, setFilter] = useState<"all" | "live" | "dead" | "unknown" | "error" | "checking">("all")
  const filteredResults = useMemo(() => {
    if (filter === "all") return results
    return results.filter((r) => r.status.toLowerCase() === filter)
  }, [results, filter])

  // Report result to /api/checkcc with LoaiDV=2
  const reportToCheckCC = async (cardId: string, status: string, response?: string) => {
    try {
      // Map status to checkcc Status code
      let statusCode = 4 // unknown
      if (status === 'live') statusCode = 2
      else if (status === 'die') statusCode = 3
      else if (status === 'error') statusCode = 4

      await apiClient.post('/checkcc', {
        LoaiDV: 2,
        Device: 'WebDashboard',
        Id: cardId,
        Status: statusCode,
        State: 0,
        From: 1, // Web dashboard
        Msg: response || ''
      })
    } catch (error) {
      console.error('Report to checkcc error:', error)
    }
  }

  useEffect(() => {
    // Chỉ set Unknown khi đã thực sự bắt đầu đếm ngược (đã fetch) và hết thời gian
    if (isChecking && hasFetched && timeLeft === 0) {
      setResults(prev => prev.map(r => r.status === 'Checking' ? { ...r, status: 'Unknown', response: 'Timeout' } : r))
      setIsChecking(false)
    }
  }, [timeLeft, isChecking, hasFetched])


  const checkingCount = useMemo(() => results.filter(r => r.status === 'Checking').length, [results])
  const processedCount = useMemo(() => results.filter(r => r.status !== 'Checking').length, [results])
  const remainingCount = useMemo(() => Math.max(0, (stats.total || results.length) - processedCount), [stats.total, results, processedCount])

  // Polling
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Load balance IMMEDIATELY from auth store, then load other data in parallel
  useEffect(() => {
    // IMMEDIATELY set balance from auth store if available (instant display)
    if (user?.balance != null) {
      setBalance(user.balance)
      setBalanceLoading(false)
    }
    
    ;(async () => {
      try {
        // Load gates and pricing in parallel (don't wait for balance)
        const [gatesRes, publicTiersRes, adminTiersRes] = await Promise.all([
          apiClient.get('/gates').catch(() => null),
          apiClient.get('/config/pricing-tiers').catch(() => null),
          user ? apiClient.get('/admin/pricing-tiers').catch(() => null) : Promise.resolve(null)
        ])
        
        // Refresh balance in background (update if changed)
        apiClient.getMe().then((meRes) => {
          const userData = (meRes as any)?.data?.data?.user
          if (userData?.balance != null) setBalance(userData.balance)
        }).catch(() => {})
        
        // Process gates
        if (gatesRes?.data && gatesRes.data.success) {
          const gatesData = gatesRes.data.data?.gates || []
          setGates(gatesData)
          
          // Initialize selection by typeCheck (not id)
          const firstGate: any = gatesData[0] as any
          if (firstGate && firstGate.typeCheck != null) {
            setSelectedGate(String(firstGate.typeCheck))
          }

          // Build map: typeCheck(string) -> creditCost
          const costMap: Record<string, number> = {}
          for (const g of gatesData) {
            const anyG: any = g as any
            const tcKey = String(anyG.typeCheck)
            const cost = Number(anyG.creditCost ?? 1)
            costMap[tcKey] = isNaN(cost) ? 1 : cost
          }
          setGateCostMap(costMap)
          // Initialize UI price from selected typeCheck
          const selTc = (firstGate && firstGate.typeCheck != null) ? String(firstGate.typeCheck) : undefined
          const initialCost = selTc ? costMap[selTc] : undefined
          const firstCost = typeof initialCost === 'number' ? initialCost : (gatesData.length ? Number((gatesData[0] as any).creditCost ?? 1) : 1)
          if (!isNaN(firstCost)) setPricePerCard(Math.max(0, firstCost))
        }
        
        // Use gate cost; tiers UI hidden
        setPricingTiers([{ min: 1, max: null, total: null, pricePerCard: pricePerCard }])
        
      } catch (err) {
        console.error('Load checker data error:', err)
      } finally {
        setBalanceLoading(false)
      }

      // Listen for balance changes via Socket.IO
      socketOn('user:balance-changed', (userData: any) => {
        if (userData?.balance != null) {
          setBalance(userData.balance)
        }
      })
      // Realtime session start
      socketOn('checker:session:start', (_snap: any) => {
        // Reset trạng thái timer cho phiên mới; chỉ khi nhận 'checker:fetch' mới bắt đầu đếm
    setHasFetched(false)
    setTimeLeft(0)
    setIsChecking(true)
        // Không bắt đầu countdown ở đây; đợi sự kiện fetch
      })
      // Khi ZennoPoster fetch cards → bắt đầu timeout
      socketOn('checker:fetch', (msg: any) => {
        try {
          setHasFetched(true)
          const t = Number(msg?.timeoutSec) || timeoutSec || 120
          setTimeoutSec(t)
          startCountdown(t)
        } catch {}
      })
      // Realtime session snapshot
      socketOn('checker:session:update', (snap: any) => {
        if (!snap) return
        setStats((s) => ({
          ...s,
          live: Number(snap.live || 0),
          dead: Number(snap.die || 0),
          unknown: Number(snap.unknown || 0),
          progress: Number(snap.progress || 0)
        }))
        if (typeof snap.pricePerCard === 'number') setPricePerCard(snap.pricePerCard)
        // Hoàn thành/stop → tắt trạng thái đang chạy
        const pendingLeft = Number(snap.pending || 0)
        if (snap.status === 'completed' || snap.stopRequested === true || pendingLeft === 0) {
          setIsChecking(false)
          stopCountdown()
        }
      })

      // Realtime card result
      socketOn('checker:card', (msg: any) => {
        if (!msg || !msg.card) return
        const apiStatus = String(msg.status || '').toLowerCase()
        if (!apiStatus || apiStatus === 'pending' || apiStatus === 'checking') return
        const status = apiStatus === 'live' ? 'Live' : apiStatus === 'die' ? 'Dead' : apiStatus === 'error' ? 'Error' : 'Unknown'
        setResults(prev => {
          const list = [...prev]
          const idx = list.findIndex(r => r.card === msg.card && r.status === 'Checking')
          if (idx !== -1) {
            list[idx] = { ...list[idx], status: status as any, response: msg.response || '' }
          }
          return list
        })
      })
    })()
  }, [user?.balance])

  // Helpers
  const startCountdown = (sec: number) => {
    try { if (countdownRef.current) clearInterval(countdownRef.current) } catch {}
    setTimeLeft(sec)
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1
        return next >= 0 ? next : 0
      })
    }, 1000)
  }
  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setTimeLeft(0)
  }
  const validateLine = (line: string) => {
    // cc|mm|yy|cvv or cc|mm|yyyy|cvv
    return /^(\d{13,19})\|(\d{1,2})\|(\d{2}|\d{4})\|(\d{3,4})$/.test(line.trim())
  }

  const parseLinesToCards = (lines: string[]): Card[] => {
    return lines.map((l) => {
      const [num, mm, yyOrYyyy, cvv] = l.split("|")
      return {
        cardNumber: num,
        expiryMonth: mm.padStart(2, "0"),
        expiryYear: yyOrYyyy,
        cvv,
      }
    })
  }

  // Actions
  const handleStart = async () => {
    const lines = cardsInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)

    const valid = lines.filter(validateLine)
    if (valid.length === 0) {
      toast({ title: t('common.error'), description: t('checker.messages.invalidFormat'), variant: "destructive" })
      return
    }

    // Giá theo GATE: pricePerCard * số thẻ
    const requiredCredits = valid.length * (pricePerCard || 1)

    // Kiểm tra credit đủ không
    if (balance < requiredCredits) {
      toast({ 
        title: 'Insufficient Credits', 
        description: `You need ${requiredCredits.toFixed(0)} credits but only have ${balance.toFixed(0)}. Please buy more credits.`, 
        variant: "destructive" 
      })
      return
    }

    setIsChecking(true)

    // Check database trước để lấy kết quả đã check
    let dbCheckedCards: any[] = []
    try {
      const cardNumbers = valid.map(line => line.split("|")[0])
      const dbCheckRes = await apiClient.post('/checker/check-existing', { cardNumbers })
      if (dbCheckRes.data && dbCheckRes.data.success) {
        dbCheckedCards = dbCheckRes.data.data || []
      }
    } catch (err) {
      console.error('Failed to check existing cards (skipping cache):', err)
      // Continue without cache - not a critical error
    }

    // Map database results by card number (only fast-return for DIE)
    const dbResultsMap = new Map()
    dbCheckedCards.forEach((card: any) => {
      if (card.fullCard && card.status) {
        const status = card.status === 'live' ? 'Live' :
                      card.status === 'die' ? 'Dead' :
                      card.status === 'error' ? 'Error' : 'Unknown'
        dbResultsMap.set(card.fullCard, {
          status,
          response: card.errorMessage || card.response || ''
        })
      }
    })

    // Tạo initial results với cache check và DB check
    const initialResults: CheckResult[] = []
    const cardsToCheck: Card[] = []

    valid.forEach((line, index) => {
      const cardKey = line.trim()
      const cached = cardCache.get(cardKey)
      const dbResult = dbResultsMap.get(cardKey)

      if (cached) {
        // Sử dụng kết quả từ cache
        initialResults.push({
          ...cached,
          id: `${Date.now()}-${index}`
        })
      } else if (dbResult && dbResult.status === 'Dead') {
        // Nếu trong DB đã có và là Die → trả luôn, không gửi Zenno
        initialResults.push({
          id: `${Date.now()}-${index}`,
          card: line,
          status: dbResult.status as any,
          response: dbResult.response
        })
        // Cache lần sau
        cardCache.set(cardKey, {
          id: `${Date.now()}-${index}`,
          card: line,
          status: dbResult.status as any,
          response: dbResult.response
        })
      } else {
        // Thẻ mới cần check
        const [num, mm, yyOrYyyy, cvv] = line.split("|")
        cardsToCheck.push({
          cardNumber: num,
          expiryMonth: mm.padStart(2, "0"),
          expiryYear: yyOrYyyy,
          cvv,
        })

        // Thêm vào results với status "Checking"
        initialResults.push({
          id: `${Date.now()}-${index}`,
          card: line,
          status: "Checking"
        })
      }
    })

    setResults(initialResults)
    setStats((s) => ({
      ...s,
      total: valid.length,
      progress: 0 // Will be updated by polling
    }))

    // Nếu không có thẻ mới cần check, dừng lại
    if (cardsToCheck.length === 0) {
      setIsChecking(false)
      toast({ title: 'Success', description: "All cards already cached", variant: "default" })
      return
    }

    try {
      // Convert selectedGate (typeCheck number as string) to number
      const typeCheckValue = parseInt(selectedGate) || 1
      const res = await apiClient.startCheck({ cards: cardsToCheck, checkType: typeCheckValue, gate: selectedGate })
      if (!res.success) throw new Error(res.message || 'Check started')

      const data: any = res.data
      setSessionId(data.sessionId)
      if (typeof data.pricePerCard === 'number' && data.pricePerCard >= 0) {
        setPricePerCard(data.pricePerCard)
      }
      // Không start countdown ở đây; sẽ start khi nhận 'checker:fetch'
      setIsChecking(true) // Set checking state to true

      // Bắt đầu polling nếu socket chưa kết nối
      if (isConnected && isConnected()) {
        // Socket sẽ cập nhật realtime, không cần polling
      } else {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(async () => {
          if (!data.sessionId) return
          try {
            const st = await apiClient.getCheckStatus(data.sessionId)
            if (st.success) {
              const sess = (st.data as any).session
              const re = (st.data as any).results || []

            // Cập nhật results với kết quả mới từ API
            setResults(prevResults => {
              const newResults = [...prevResults]
              const newCache = new Map(cardCache)

              re.forEach((apiResult: any) => {
                const cardLine = apiResult.card // Backend trả về fullCard format
                const resultIndex = newResults.findIndex(r =>
                  r.card === cardLine && r.status === "Checking"
                )

                if (resultIndex !== -1) {
                  // Only update if we have a definitive status (not pending/checking)
                  const apiStatus = apiResult.status?.toLowerCase()
                  if (apiStatus && apiStatus !== 'pending' && apiStatus !== 'checking') {
                    const status = apiStatus === 'live' ? 'Live' :
                                 apiStatus === 'die' ? 'Dead' :
                                 apiStatus === 'error' ? 'Error' : 'Unknown'

                    newResults[resultIndex] = {
                      ...newResults[resultIndex],
                      status: status as any,
                      response: apiResult.response || ''
                    }

                    // Lưu vào cache
                    newCache.set(cardLine, {
                      id: newResults[resultIndex].id,
                      card: cardLine,
                      status: status as any,
                      response: apiResult.response || ''
                    })

                    // Report result to /api/checkcc with LoaiDV=2 (optional, if needed)
                    if (apiResult.cardId) {
                      reportToCheckCC(apiResult.cardId, apiResult.status, apiResult.response).catch(err => {
                        console.error('Failed to report to checkcc:', err)
                      })
                    }
                  }
                  // If status is pending/checking or missing, keep showing "Checking"
                }
              })

              setCardCache(newCache)
              return newResults
            })

            setStats((s) => ({
              ...s,
              live: sess.live,
              dead: sess.die,
              unknown: sess.unknown,
              progress: sess.progress,
              successRate: sess.total > 0 ? Math.round(((sess.live + sess.die) / sess.total) * 100) : 0,
              liveRate: sess.total > 0 ? Math.round((sess.live / sess.total) * 100) : 0,
            }))
            // Update pricePerCard from session if backend returns it
            if (typeof (sess as any).pricePerCard === 'number') {
              setPricePerCard((sess as any).pricePerCard)
            }



            if (sess.status === "completed" || sess.stopRequested) {
              if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
              }
              setIsChecking(false)
            }
          }
        } catch (e) {
          // bỏ qua lỗi tạm thởi
        }
      }, 1200)
      }

      toast({ title: t('common.success'), description: t('checker.messages.checkingStarted') + ` ${valid.length} ${t('checker.stats.cards')}` })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('checker.messages.noCards')
      toast({ title: t('common.error'), description: msg, variant: "destructive" })
      setIsChecking(false)
    }
  }

  const stopChecking = async () => {
    if (!sessionId) return
    if (!isChecking) return
    try {
      // Stop checking on backend
      await apiClient.stopCheck({ sessionId })
      
      // Stop polling
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      
      // Update frontend: Change all "Checking" cards to "Unknown"
      setResults(prevResults => {
        return prevResults.map(r => {
          if (r.status === 'Checking') {
            return {
              ...r,
              status: 'Unknown',
              response: 'Stopped by user'
            }
          }
          return r // Keep existing results (Live/Dead/Error) unchanged
        })
      })
      
      setIsChecking(false)
      toast({ title: 'Success', description: 'Checking stopped', variant: "default" })
    } catch (err) {
      console.error('Stop checking error:', err)
      setIsChecking(false)
    }
  }

  const handleStop = async () => {
    await stopChecking()
  }

  const handleClear = () => {
    setResults([])
    setCardsInput("")
    setStats({ live: 0, dead: 0, error: 0, unknown: 0, total: 0, progress: 0, successRate: 0, liveRate: 0 })
    setCardCache(new Map()) // Clear memory cache
  }

  const handleCopy = async () => {
    const text = filteredResults.map((r) => r.card).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: t('checker.messages.copied'), description: t('checker.messages.copied') + ` ${filteredResults.length} ${t('checker.stats.lines')}` })
    } catch {
      toast({ title: "Lỗi", description: "Không thể copy", variant: "destructive" })
    }
  }

  const exportCheckedTxt = () => {
    const checked = results.filter(r => r.status !== 'Checking')
    if (checked.length === 0) return
    const txt = checked.map(r => r.card).join('\n')
    const blob = new Blob([txt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checked_cards_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCheckedCsv = () => {
    const checked = results.filter(r => r.status !== 'Checking')
    if (checked.length === 0) return
    const header = 'Card,Status,Message'
    const rows = checked.map(r => `${r.card},${r.status},${(r.response||'').replace(/,/g,';')}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checked_cards_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }


  const estimatedCost = useMemo(() => (stats.total || 0) * (pricePerCard || 0), [stats.total, pricePerCard])

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            {t('checker.title')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            {t('checker.description')}
          </p>
        </div>

      {/* Removed standalone Auto-timeout bar; countdown will be visualized in spinner */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1 text-xs sm:text-sm px-2 py-1">
            <Wallet className="h-3 w-3" />
            {balanceLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Loading credits...</span>
              </span>
            ) : (
              <span className="whitespace-nowrap">{balance.toLocaleString()} Credits</span>
            )}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left Column - Input & Controls */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Card Input Section */}
          <UICard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Card Input
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('checker.formatInfo')}
              </p>
            </CardHeader>
            <CardContent>
              {/* Gate Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Chọn GATE</label>
                <select
                  value={selectedGate}
                  onChange={(e) => {
                    setSelectedGate(e.target.value)
                    // Try to update price from map by typeCheck
                    const chosen = gates.find(g => String((g as any).typeCheck) === String(e.target.value) || (g as any).id === e.target.value)
                    const tc = chosen ? String((chosen as any).typeCheck) : String(e.target.value)
                    const cost = gateCostMap[tc]
                    if (typeof cost === 'number') setPricePerCard(cost)
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={gates.length === 0}
                >
                  {gates.length === 0 ? (
                    <option value="">Loading gates...</option>
                  ) : (
                    gates.map((gate) => (
                      <option key={gate.id} value={String((gate as any).typeCheck)}>
                        {gate.name} {gate.description ? `- ${gate.description}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <Textarea
                value={cardsInput}
                onChange={(e) => setCardsInput(e.target.value)}
                rows={10}
                placeholder={t('checker.inputPlaceholder')}
                className="font-mono text-xs sm:text-sm"
              />
              <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2">
                {/* Tính disable: không có cards, chưa chọn gate, đang check, hoặc credit không đủ */}
                {(() => {
                  const hasCards = cardsInput.trim().length > 0;
                  const hasGate = !!selectedGate;
                  
                  let needsDisable = !hasCards || !hasGate || isChecking;
                  
                  // Tính credit cần thiết
                  if (!needsDisable && !isChecking && hasCards) {
                    const lines = cardsInput.split("\n").map(s => s.trim()).filter(Boolean);
                    const valid = lines.filter(validateLine);
                    
                    if (valid.length === 0) {
                      needsDisable = true;
                    } else {
                      let requiredCredits = 0;
                      if (pricingTiers && pricingTiers.length > 0) {
                        for (const tier of pricingTiers) {
                          const tierMin = tier.min || 0;
                          const tierMax = tier.max === null ? valid.length : tier.max;
                          const tierPrice = tier.pricePerCard || 0;
                          
                          if (valid.length >= tierMin && valid.length <= tierMax) {
                            requiredCredits = tierPrice * valid.length;
                            break;
                          }
                        }
                      } else {
                        requiredCredits = pricePerCard * valid.length;
                      }
                      
                      if (balance < requiredCredits) {
                        needsDisable = true;
                      }
                    }
                  }
                  
                  return (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        onClick={isChecking ? handleStop : handleStart} 
                        size="lg" 
                        variant={isChecking ? 'destructive' : 'default'}
                        disabled={isChecking ? false : needsDisable}
                        className="flex-1"
                      >
                        {isChecking ? (
                          <Square className="mr-2 h-4 w-4" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {isChecking ? t('checker.stopCheck') : t('checker.startCheck')}
                      </Button>
                      <Button onClick={handleClear} variant="outline" size="lg" className="w-full sm:w-auto text-xs sm:text-sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('checker.clearAll')}
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </UICard>

          {/* Results Section */}
          <UICard>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('checker.results.title')}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="px-3 py-1.5 border rounded-md text-sm flex-shrink-0"
                  >
                    <option value="all">{t('checker.filterAll') || 'All'}</option>
                    <option value="live">{t('checker.filterLive') || 'Live'}</option>
                    <option value="dead">{t('checker.filterDead') || 'Dead'}</option>
                    <option value="unknown">{t('checker.filterUnknown') || 'Unknown'}</option>
                    <option value="error">{t('checker.filterError') || 'Error'}</option>
                    <option value="checking">Checking</option>
                  </select>
                  <Button onClick={handleCopy} variant="outline" size="sm" className="flex-shrink-0">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button onClick={exportCheckedTxt} variant="outline" size="sm" className="flex-shrink-0">
                    <Download className="mr-2 h-4 w-4" />
                    TXT
                  </Button>
                  <Button onClick={exportCheckedCsv} variant="outline" size="sm" className="flex-shrink-0 hidden sm:inline-flex">
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredResults.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-mono text-sm">{r.card}</span>
                <div className="flex items-center gap-2">
                  <Badge
                        variant={
                          r.status === "Live" ? "default" :
                          r.status === "Dead" ? "destructive" :
                          r.status === "Error" ? "destructive" :
                          r.status === "Checking" ? "secondary" : "secondary"
                        }
                        className="flex items-center gap-1"
                      >
                        {r.status === "Live" && <CheckCircle className="h-3 w-3" />}
                        {r.status === "Dead" && <XCircle className="h-3 w-3" />}
                        {r.status === "Error" && <AlertCircle className="h-3 w-3" />}
                        {r.status === "Unknown" && <Clock className="h-3 w-3" />}
                        {r.status === "Checking" && (
                          hasFetched ? (
                            (() => {
                              const remainPct = Math.max(0, Math.min(100, Math.round((timeLeft/Math.max(1, timeoutSec))*100)))
                              return (
                                <div className="relative h-3 w-3" aria-hidden>
                                  <div
                                    className="absolute inset-0 rounded-full"
                                    style={{ background: `conic-gradient(currentColor ${remainPct}%, rgba(0,0,0,0.15) 0)` }}
                                  />
                                  <div className="absolute inset-0.5 rounded-full bg-background" />
                                </div>
                              )
                            })()
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )
                        )}
                        {r.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {filteredResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('checker.noData')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </UICard>

          {/* Pricing - fixed */}
          <UICard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t('checker.pricing.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Current Price</div>
                <div className="text-2xl font-bold">{pricePerCard} Credit{pricePerCard === 1 ? '' : 's'} / card</div>
              </div>
            </CardContent>
          </UICard>
        </div>

        {/* Right Column - Stats & Info */}
        <div className="space-y-6">
          {/* Account Info */}
          <UICard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t('checker.info.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('checker.info.balance')}</span>
                <span className="font-semibold">{balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('checker.info.pricePerCard')}</span>
                <span className="font-semibold">{pricePerCard} Credits</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('checker.info.estimatedCost')}</span>
                <span className="font-semibold text-primary">{estimatedCost} Credits</span>
              </div>
            </CardContent>
          </UICard>

          {/* Progress Stats */}
          <UICard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('checker.stats.progress')}</span>
                  <Badge variant="secondary">{stats.progress}%</Badge>
                </div>
                <Progress value={stats.progress} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">{t('checker.stats.checking') || 'Checking'}</div>
                  <div className="text-xl font-bold">{checkingCount}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">{t('checker.stats.processed') || 'Checked'}</div>
                  <div className="text-xl font-bold">{processedCount}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">{t('checker.stats.remaining') || 'Remaining'}</div>
                  <div className="text-xl font-bold">{remainingCount}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 border rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Live</span>
                  </div>
                  <div className="text-xl font-bold">{stats.live}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Dead</span>
                  </div>
                  <div className="text-xl font-bold">{stats.dead}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">Unknown</span>
                  </div>
                  <div className="text-xl font-bold">{stats.unknown}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-sm font-medium">Total</span>
                  </div>
                  <div className="text-xl font-bold">{stats.total}</div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-medium">{stats.successRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Live Rate</span>
                  <span className="font-medium">{stats.liveRate}%</span>
                </div>
              </div>
            </CardContent>
          </UICard>

          {/* Security Info */}
          <UICard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>SSL Encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>No Data Stored</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Real-time Processing</span>
                </div>
              </div>
            </CardContent>
          </UICard>
        </div>
      </div>

    </div>
  )
}

