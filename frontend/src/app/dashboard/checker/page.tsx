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
  Wallet
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/components/I18nProvider"
import { useAuthStore } from "@/lib/auth"

interface CheckResult {
  id: string
  card: string
  status: "Live" | "Dead" | "Error" | "Unknown" | "Checking"
  response?: string
  fromCache?: boolean
}

// Danh sách các gate phổ biến
const GATE_OPTIONS = [
  { value: "cvv_veo", label: "CVV Veo [Stripe Auth] - All Cards" },
  { value: "cvv_stripe", label: "CVV Stripe Auth - Check Bill - All Cards" },
  { value: "ccn_crumbl", label: "CCN Crumbl [Stripe] Auth - All Cards" },
  { value: "ccv_doordash", label: "CCV DoorDash Auth - All Cards" },
  { value: "ccn_braintree", label: "CCN Braintree AVS - All Cards" },
  { value: "ccv_amazon", label: "CCV Amazon Auth - Require Account - All Cards" },
  { value: "killer_luxcheck", label: "Killer LuxCheck - 20 Credits" },
]

export default function CheckerPage() {
  const { toast } = useToast()
  const { t } = useI18n()
  const { user } = useAuthStore()
  
  // Setup Socket.IO connection
  const { on: socketOn } = useSocket({ enabled: true, debug: false })

  // Input & session
  const [cardsInput, setCardsInput] = useState("")
  const [selectedGate, setSelectedGate] = useState("cvv_veo")
  const [isChecking, setIsChecking] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cardCache, setCardCache] = useState<Map<string, CheckResult>>(new Map())

  // Pricing & balance
  const [balance, setBalance] = useState<number>(0)
  const [pricePerCard, setPricePerCard] = useState<number>(0)
  const [pricingTiers, setPricingTiers] = useState<Array<{ min: number; max: number | null; total: number | null; pricePerCard?: number }>>([])

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


  const checkingCount = useMemo(() => results.filter(r => r.status === 'Checking').length, [results])
  const processedCount = useMemo(() => results.filter(r => r.status !== 'Checking').length, [results])
  const remainingCount = useMemo(() => Math.max(0, (stats.total || results.length) - processedCount), [stats.total, results, processedCount])

  // Polling
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Load balance (best-effort) on mount
  useEffect(() => {
    ;(async () => {
      try {
        const me = await apiClient.getMe().catch(() => null as any)
        const user = (me as any)?.data?.data?.user
        if (user?.balance != null) setBalance(user.balance)
      } catch {}

      try {
        // Ensure token set if available (for admin route)
        try {
          const t = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : ''
          if (t) apiClient.setToken(t)
        } catch {}

        // Prefer admin tiers when authenticated (reflects DB exactly), fallback to public tiers
        let tiers: any[] | null = null
        if (user) {
          const adminResp = await apiClient.get('/admin/pricing-tiers').catch(() => null as any)
          const adminTiers = (adminResp as any)?.data?.data?.tiers
          if (Array.isArray(adminTiers)) {
            tiers = adminTiers.map((t: any) => ({
              min: t.minCards,
              max: t.maxCards === null ? null : t.maxCards,
              pricePerCard: Number(t.pricePerCard || 0),
              total: t.maxCards === null ? null : Math.round(Number(t.pricePerCard || 0) * Number(t.maxCards))
            }))
          }
        }

        if (!tiers) {
          const tiersResp = await apiClient.get('/config/pricing-tiers').catch(() => null as any)
          const publicTiers = (tiersResp as any)?.data?.data?.tiers
          if (Array.isArray(publicTiers)) tiers = publicTiers
        }

        if (Array.isArray(tiers)) setPricingTiers(tiers)
      } catch {}

      // Listen for balance changes via Socket.IO (fallback to polling if unavailable)
      socketOn('user:balance-changed', (userData: any) => {
        if (userData?.balance != null) {
          setBalance(userData.balance)
        }
      })
    })()
  }, [])

  // Helpers
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

    // Tính toán credit cần dùng dựa trên pricing tiers
    let requiredCredits = 0
    if (pricingTiers && pricingTiers.length > 0) {
      for (const tier of pricingTiers) {
        const tierMin = tier.min || 0
        const tierMax = tier.max === null ? valid.length : tier.max
        const tierPrice = tier.pricePerCard || 0
        
        if (valid.length >= tierMin && valid.length <= tierMax) {
          requiredCredits = tierPrice * valid.length
          break
        }
      }
    } else {
      requiredCredits = pricePerCard * valid.length
    }

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

    // Tạo initial results với cache check
    const initialResults: CheckResult[] = []
    const cardsToCheck: Card[] = []

    valid.forEach((line, index) => {
      const cardKey = line.trim()
      const cached = cardCache.get(cardKey)

      if (cached) {
        // Sử dụng kết quả từ cache
        initialResults.push({
          ...cached,
          id: `${Date.now()}-${index}`,
          fromCache: true
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
          status: "Checking",
          fromCache: false
        })
      }
    })

    setResults(initialResults)
    setStats((s) => ({
      ...s,
      total: valid.length,
      progress: Math.round((initialResults.filter(r => r.fromCache).length / valid.length) * 100)
    }))

    // Nếu không có thẻ mới cần check, dừng lại
    if (cardsToCheck.length === 0) {
      setIsChecking(false)
      toast({ title: 'Success', description: "All cards already cached", variant: "default" })
      return
    }

    try {
      const res = await apiClient.startCheck({ cards: cardsToCheck, checkType: 1, gate: selectedGate })
      if (!res.success) throw new Error(res.message || 'Check started')

      const data: any = res.data
      setSessionId(data.sessionId)
      setPricePerCard(data.pricePerCard || 0)
      setIsChecking(true) // Set checking state to true

      // Bắt đầu polling
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
                  const status = apiResult.status === 'live' ? 'Live' :
                               apiResult.status === 'die' ? 'Dead' :
                               apiResult.status === 'error' ? 'Error' : 'Unknown'

                  newResults[resultIndex] = {
                    ...newResults[resultIndex],
                    status: status as any,
                    response: apiResult.response
                  }

                  // Lưu vào cache
                  newCache.set(cardLine, {
                    id: newResults[resultIndex].id,
                    card: cardLine,
                    status: status as any,
                    response: apiResult.response
                  })
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



            if (sess.status === "completed" || sess.stopRequested) {
              if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
              }
              setIsChecking(false)
            }
          }
        } catch (e) {
          // bỏ qua lỗi tạm thời
        }
      }, 1200)

      toast({ title: t('common.success'), description: t('checker.messages.checkingStarted') + ` ${valid.length} ${t('checker.stats.cards')}` })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('checker.messages.noCards')
      toast({ title: t('common.error'), description: msg, variant: "destructive" })
      setIsChecking(false)
    }
  }

  const handleStop = async () => {
    setIsChecking(false)
    if (sessionId) {
      try {
        await apiClient.stopCheck(sessionId)
      } catch {}
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setIsChecking(false)
  }

  const handleClear = () => {
    setResults([])
    setCardsInput("")
    setStats({ live: 0, dead: 0, error: 0, unknown: 0, total: 0, progress: 0, successRate: 0, liveRate: 0 })
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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1 text-xs sm:text-sm px-2 py-1">
            <Wallet className="h-3 w-3" />
            <span className="whitespace-nowrap">{balance.toLocaleString()} Credits</span>
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
                <label className="block text-sm font-medium mb-2">Chọn Gate</label>
                <select
                  value={selectedGate}
                  onChange={(e) => setSelectedGate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {GATE_OPTIONS.map((gate) => (
                    <option key={gate.value} value={gate.value}>
                      {gate.label}
                    </option>
                  ))}
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
                  if (!needsDisable && !isChecking) {
                    const lines = cardsInput.split("\n").map(s => s.trim()).filter(Boolean);
                    const valid = lines.filter(validateLine);
                    
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
                  
                  return (
                    <>
                      <Button 
                        onClick={isChecking ? handleStop : handleStart} 
                        size="lg" 
                        variant={isChecking ? 'destructive' : 'default'}
                        disabled={needsDisable}
                      >
                        {isChecking ? (
                          <Square className="mr-2 h-4 w-4" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {isChecking ? t('checker.stopCheck') : t('checker.startCheck')}
                      </Button>
                    </>
                  );
                })()}
                <Button onClick={handleClear} variant="outline" size="lg" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('checker.clearAll')}
                </Button>
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 border rounded-md text-xs sm:text-sm"
                  >
                    <option value="all">{t('checker.filterAll')}</option>
                    <option value="live">{t('checker.filterLive')}</option>
                    <option value="dead">{t('checker.filterDead')}</option>
                    <option value="unknown">{t('checker.filterUnknown')}</option>
                    <option value="error">{t('checker.filterError')}</option>
                    <option value="checking">Checking</option>
                  </select>
                  <Button onClick={handleCopy} variant="outline" size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
                    <Copy className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{t('checker.copyResults')}</span>
                    <span className="sm:hidden">Copy</span>
                  </Button>
                  <Button onClick={exportCheckedTxt} variant="outline" size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
                    <Download className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden md:inline">{t('checker.downloadResults')} TXT</span>
                    <span className="md:hidden">TXT</span>
                  </Button>
                  <Button onClick={exportCheckedCsv} variant="outline" size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
                    <Download className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden md:inline">{t('checker.downloadResults')} CSV</span>
                    <span className="md:hidden">CSV</span>
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
                      {r.fromCache && (
                        <Badge variant="outline" className="text-xs">
                          Cache
                        </Badge>
                      )}
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
                          <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
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

          {/* Pricing Table (public tiers) */}
          <UICard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t('checker.pricing.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pricingTiers.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('checker.pricing.loading')}</div>
              ) : (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {pricingTiers.map((tier, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {tier.max ? (
                          <>
                            {t('checker.pricing.upTo')} {tier.max.toLocaleString()} {t('checker.pricing.cards')}
                          </>
                        ) : (
                          <>
                            {t('checker.pricing.upTo')} ∞ {t('checker.pricing.cards')}
                          </>
                        )}
                      </div>
                      {tier.total != null ? (
                        <div className="text-xl sm:text-2xl font-bold">${String(tier.total).toLocaleString()}</div>
                      ) : (
                        <div className="text-xl sm:text-2xl font-bold">
                          {tier.pricePerCard ?? 0} Credits/card
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

