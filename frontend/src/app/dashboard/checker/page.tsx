"use client"

import "@/styles/checker.css"
import { useEffect, useMemo, useRef, useState } from "react"
import { apiClient, type Card } from "@/lib/api"
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

interface CheckResult {
  id: string
  card: string
  status: "Live" | "Dead" | "Error" | "Unknown" | "Checking"
  response?: string
  fromCache?: boolean
}

export default function CheckerPage() {
  const { toast } = useToast()
  const { t } = useI18n()

  // Input & session
  const [cardsInput, setCardsInput] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cardCache, setCardCache] = useState<Map<string, CheckResult>>(new Map())

  // Pricing & balance
  const [balance, setBalance] = useState<number>(0)
  const [pricePerCard, setPricePerCard] = useState<number>(0)
  // Gate / TypeCheck: 1=Check Live, 2=Check Charge
  const [typeCheck, setTypeCheck] = useState<number>(1)

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
      toast({ title: t('common.success'), description: "Tất cả thẻ đã có kết quả từ cache", variant: "default" })
      return
    }

    try {
      const res = await apiClient.startCheck({ cards: cardsToCheck, checkType: typeCheck })
      if (!res.success) throw new Error(res.message || t('checker.messages.checkingStarted'))

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-primary" />
            {t('checker.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('checker.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            {balance.toLocaleString()} Credits
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Input & Controls */}
        <div className="lg:col-span-2 space-y-6">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-sm mb-1">GATE / Type</label>
                  <select
                    value={typeCheck}
                    onChange={(e) => setTypeCheck(Number(e.target.value))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value={1}>Check Live</option>
                    <option value={2}>Check Charge</option>
                  </select>
                </div>
              </div>
              <Textarea
                value={cardsInput}
                onChange={(e) => setCardsInput(e.target.value)}
                rows={12}
                placeholder={t('checker.inputPlaceholder')}
                className="font-mono text-sm"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={isChecking ? handleStop : handleStart} size="lg" variant={isChecking ? 'destructive' : 'default'}>
                  {isChecking ? (
                    <Square className="mr-2 h-4 w-4" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isChecking ? t('checker.stopCheck') : t('checker.startCheck')}
                </Button>
                <Button onClick={handleClear} variant="outline" size="lg">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('checker.clearAll')}
                </Button>
              </div>
            </CardContent>
          </UICard>

          {/* Results Section */}
          <UICard>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('checker.results.title')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value="all">{t('checker.filterAll')}</option>
                    <option value="live">{t('checker.filterLive')}</option>
                    <option value="dead">{t('checker.filterDead')}</option>
                    <option value="unknown">{t('checker.filterUnknown')}</option>
                    <option value="error">{t('checker.filterError')}</option>
                    <option value="checking">Checking</option>
                  </select>
                  <Button onClick={handleCopy} variant="outline" size="sm">
                    <Copy className="mr-2 h-4 w-4" />
                    {t('checker.copyResults')}
                  </Button>
                  <Button onClick={exportCheckedTxt} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    {t('checker.downloadResults')} TXT
                  </Button>
                  <Button onClick={exportCheckedCsv} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    {t('checker.downloadResults')} CSV
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
                <span className="font-semibold">${pricePerCard}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('checker.info.estimatedCost')}</span>
                <span className="font-semibold text-primary">${estimatedCost}</span>
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

