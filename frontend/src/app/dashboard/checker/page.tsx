"use client"

import "@/styles/checker.css"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { apiClient, type Card } from "@/lib/api"
import { useSocket } from "@/hooks/use-socket"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
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

// Normalize backend/WS statuses to UI statuses
const normalizeStatus = (s: string): CheckResult['status'] => {
  const v = String(s || '').toLowerCase()
  if (v === 'live') return 'Live'
  if (v === 'die' || v === 'dead') return 'Die'
  if (v === 'error') return 'Error'
  if (v === 'unknown') return 'Unknown'
  if (v === 'checking') return 'Checking'
  return 'Unknown'
}

interface CheckResult {
  id: string
  card: string
  cardNumber?: string
  expiryMonth?: string
  expiryYear?: string
  cvv?: string
  status: "Live" | "Die" | "Error" | "Unknown" | "Checking"
  response?: string
  brand?: string
  bin?: string
  country?: string
  bank?: string
  level?: string
  typeCheck?: number
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
  const { on: socketOn, emit: socketEmit, isConnected } = useSocket({ enabled: true, debug: false })

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
  const stopRequestedRef = useRef<boolean>(false)
  const sentCardsRef = useRef<string[]>([])
  const autoStopRef = useRef<boolean>(false)

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
    pending: 0,
    progress: 0,
    successRate: 0,
    liveRate: 0,
  })

  // Billing display
  const [recentDebit, setRecentDebit] = useState<number>(0)
  const recentDebitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [sessionBilled, setSessionBilled] = useState<number>(0)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summary, setSummary] = useState<{ total: number; live: number; die: number; unknown: number; billed: number; durationSec: number }>({ total: 0, live: 0, die: 0, unknown: 0, billed: 0, durationSec: 0 })
  const sessionStartRef = useRef<number | null>(null)

  // Results
  const [results, setResults] = useState<CheckResult[]>([])
  const [filter, setFilter] = useState<"all" | "live" | "die" | "unknown" | "error" | "checking">("all")
  const [searchCard, setSearchCard] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100) // 100 results per page
  
  const filteredResults = useMemo(() => {
    let filtered = results
    
    // Filter by status
    if (filter !== "all") {
      filtered = filtered.filter((r) => r.status.toLowerCase() === filter)
    }
    
    // Filter by card search (partial match)
    if (searchCard.trim()) {
      const search = searchCard.trim().toLowerCase()
      filtered = filtered.filter((r) => r.card.toLowerCase().includes(search))
    }
    
    return filtered
  }, [results, filter, searchCard])
  
  // Paginated results
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredResults.slice(start, end)
  }, [filteredResults, currentPage, pageSize])
  
  const totalPages = Math.ceil(filteredResults.length / pageSize)

  // Remove finished cards from textarea input (and persist to localStorage)
  const removeCardsFromInput = useCallback((cards: string[]) => {
    if (!cards || cards.length === 0) return
    setCardsInput(prev => {
      if (!prev) return prev
      const toRemove = new Set(cards.map(c => String(c).trim()))
      const next = prev
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(line => !toRemove.has(line))
        .join('\n')
      try { localStorage.setItem('checker_cards_input', next) } catch {}
      return next
    })
  }, [])

  // Join session room when sessionId is set; leave on change/unmount
  useEffect(() => {
    if (sessionId && socketEmit) {
      try { socketEmit('session:join', sessionId) } catch {}
    }
    return () => {
      if (sessionId && socketEmit) {
        try { socketEmit('session:leave', sessionId) } catch {}
      }
    }
  }, [sessionId, socketEmit])

  // Load persisted state on mount (keep results after reload)
  useEffect(() => {
    try {
      const savedResults = localStorage.getItem('checker_results')
      const savedCardsInput = localStorage.getItem('checker_cards_input')
      const savedCache = localStorage.getItem('checker_card_cache')
      const savedSessionId = localStorage.getItem('checker_session_id')
      const savedIsChecking = localStorage.getItem('checker_is_checking')

      if (savedResults) {
        const arr = JSON.parse(savedResults)
        if (Array.isArray(arr)) {
          const normalized = arr.map((r: any) => ({ ...r, status: normalizeStatus(r?.status) }))
          setResults(normalized)
          const unknownCards = normalized.filter((r: any) => r.status === 'Unknown').map((r: any) => r.card)
          if (unknownCards.length > 0) {
            const txt = unknownCards.join('\n')
            setCardsInput(txt)
            try { localStorage.setItem('checker_cards_input', txt) } catch {}
          } else if (savedCardsInput) {
            setCardsInput(savedCardsInput)
          }
        }
      }
      // DON'T load stats from localStorage - they might be from old sessions
      // Stats will be updated by socket/polling when session starts
      if (savedCache) {
        const entries: any[] = JSON.parse(savedCache)
        if (Array.isArray(entries)) setCardCache(new Map(entries))
      }
      
      // ✅ FIX: Stop session on reload and clear all data
      if (savedSessionId && savedIsChecking === '1') {
        console.log('[Checker] Detected active session on reload, stopping:', savedSessionId)
        
        // Stop the session via API (pause ZennoPoster)
        apiClient.post('/checker/stop', { sessionId: savedSessionId })
          .then(() => {
            console.log('[Checker] Session stopped successfully')
          })
          .catch((err: any) => {
            console.error('[Checker] Failed to stop session:', err)
          })
          .finally(() => {
            // Clear all state regardless of API result
            setIsChecking(false)
            setSessionId(null)
            setResults([])
            setCardsInput('')
            setStats({
              total: 0,
              live: 0,
              dead: 0,
              error: 0,
              unknown: 0,
              pending: 0,
              progress: 0,
              successRate: 0,
              liveRate: 0
            })
            
            // Clear localStorage
            try {
              localStorage.removeItem('checker_results')
              localStorage.removeItem('checker_cards_input')
              localStorage.removeItem('checker_session_id')
              localStorage.removeItem('checker_is_checking')
              localStorage.removeItem('checker_stats')
              localStorage.removeItem('checker_card_cache')
            } catch {}
          })
      } else {
        // No active session → reset state
        setIsChecking(false)
        setSessionId(null)
        try { 
          localStorage.setItem('checker_is_checking', '0')
          localStorage.removeItem('checker_session_id')
          localStorage.removeItem('checker_stats')
        } catch {}
      }
    } catch {}
  }, [])

  // Secondary load: avoid overriding textarea after first init
  useEffect(() => {
    try {
      const savedResults = localStorage.getItem('checker_results')
      const savedCardsInput = localStorage.getItem('checker_cards_input')
      const savedCache = localStorage.getItem('checker_card_cache')

      if (savedResults) setResults(JSON.parse(savedResults))
      if (savedCardsInput) { /* keep current input (may be Unknown list) */ }
      // DON'T load stats from localStorage
      if (savedCache) {
        const entries: any[] = JSON.parse(savedCache)
        if (Array.isArray(entries)) setCardCache(new Map(entries))
      }
    } catch {}
  }, [])

  // Persist to localStorage when state changes
  useEffect(() => {
    try { localStorage.setItem('checker_results', JSON.stringify(results)) } catch {}
  }, [results])
  useEffect(() => {
    try { localStorage.setItem('checker_cards_input', cardsInput) } catch {}
  }, [cardsInput])
  // DON'T persist stats to localStorage - they should be session-specific only
  useEffect(() => {
    try { localStorage.setItem('checker_card_cache', JSON.stringify(Array.from(cardCache.entries()))) } catch {}
  }, [cardCache])
  useEffect(() => {
    try { sessionId ? localStorage.setItem('checker_session_id', sessionId) : localStorage.removeItem('checker_session_id') } catch {}
  }, [sessionId])
  useEffect(() => {
    try { localStorage.setItem('checker_is_checking', isChecking ? '1' : '0') } catch {}
  }, [isChecking])

  // After reload: only treat as running if a session is active and there are Checking items
  useEffect(() => {
    if (!sessionId) return
    if (results.some(r => r.status === 'Checking')) setIsChecking(true)
  }, [results, sessionId])

  // Normalize leftover 'Checking' items only when not currently checking AND no active session
  useEffect(() => {
    if (sessionId) return
    if (isChecking) return
    setResults(prev => prev.map(r => r.status === 'Checking' ? { ...r, status: 'Unknown', response: 'Stopped' } : r))
    setIsChecking(false)
    try { localStorage.setItem('checker_is_checking', '0') } catch {}
  }, [sessionId, isChecking])

  // Resume polling after reload if needed
  useEffect(() => {
    if (!sessionId) return
    if (isConnected && isConnected()) return // socket will drive updates
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const st = await apiClient.getCheckStatus(sessionId)
        if (st.success) {
          const sess = (st.data as any).session
          const re = (st.data as any).results || []
          setStats((s) => ({
            ...s,
            live: sess.live,
            dead: sess.die,
            unknown: sess.unknown,
            progress: sess.progress,
            successRate: sess.total > 0 ? Math.round(((sess.live + sess.die) / sess.total) * 100) : 0,
            liveRate: sess.total > 0 ? Math.round((sess.live / sess.total) * 100) : 0,
            total: sess.total
          }))
          // Merge results like logic above
          setResults(prev => {
            const list = [...prev]
            const cacheNew = new Map(cardCache)
            re.forEach((apiResult: any) => {
              const cardLine = apiResult.card
              const idx = list.findIndex(r => r.card === cardLine && r.status === 'Checking')
              if (idx !== -1) {
                const apiStatus = String(apiResult.status || '').toLowerCase()
                if (apiStatus && apiStatus !== 'pending' && apiStatus !== 'checking') {
                  const status = normalizeStatus(apiStatus)
                  list[idx] = { ...list[idx], status: status as any, response: apiResult.response || '' }
                  cacheNew.set(cardLine, { id: list[idx].id, card: cardLine, status: status as any, response: apiResult.response || '' })
                }
              }
            })
            setCardCache(cacheNew)
            return list
          })
          if (sess.status === 'completed' || sess.pending === 0) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            setIsChecking(false)
          } else {
            setIsChecking(true)
          }
        }
      } catch {}
    }, 1500)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [sessionId])

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
  const remainingCount = useMemo(() => {
    if (typeof stats.pending === 'number' && stats.pending > 0) return stats.pending
    return Math.max(0, (stats.total || results.length) - processedCount)
  }, [stats.pending, stats.total, results, processedCount])

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
          (user && user.role === 'admin') ? apiClient.get('/admin/pricing-tiers').catch(() => null) : Promise.resolve(null)
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
          const newBal = Number(userData.balance)
          // Hiển thị số credits bị trừ (đỏ) trong vài giây
          if (!isNaN(newBal) && balance > 0 && newBal < balance) {
            const diff = Math.max(0, balance - newBal)
            setRecentDebit(diff)
            try { if (recentDebitTimerRef.current) clearTimeout(recentDebitTimerRef.current) } catch {}
            recentDebitTimerRef.current = setTimeout(() => setRecentDebit(0), 4000)
          }
          setBalance(newBal)
        }
      })
      // Stop polling when socket connects
      socketOn('connect', () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      })
      // Resume polling when socket disconnects and a session is active
      socketOn('disconnect', () => {
        if (!sessionId) return
        if (!pollRef.current) {
          pollRef.current = setInterval(async () => {
            try {
              const st = await apiClient.getCheckStatus(sessionId)
              if (st.success) {
                const sess = (st.data as any).session
                const re = (st.data as any).results || []
                setStats((s) => ({
                  ...s,
                  live: sess.live,
                  dead: sess.die,
                  unknown: sess.unknown,
                  progress: sess.progress,
                  successRate: sess.total > 0 ? Math.round(((sess.live + sess.die) / sess.total) * 100) : 0,
                  liveRate: sess.total > 0 ? Math.round((sess.live / sess.total) * 100) : 0,
                  total: sess.total
                }))
                setResults(prev => {
                  const list = [...prev]
                  const cacheNew = new Map(cardCache)
                  re.forEach((apiResult: any) => {
                    const cardLine = apiResult.card
                    const idx = list.findIndex(r => r.card === cardLine && r.status === 'Checking')
                    if (idx !== -1) {
                      const apiStatus = String(apiResult.status || '').toLowerCase()
                      if (apiStatus && apiStatus !== 'pending' && apiStatus !== 'checking') {
                        const status = apiStatus === 'live' ? 'Live' : apiStatus === 'die' ? 'Die' : apiStatus === 'error' ? 'Error' : 'Unknown'
                        list[idx] = { ...list[idx], status: status as any, response: apiResult.response || '' }
                        cacheNew.set(cardLine, { id: list[idx].id, card: cardLine, status: status as any, response: apiResult.response || '' })
                      }
                    }
                  })
                  setCardCache(cacheNew)
                  return list
                })
                if (sess.status === 'completed' || sess.pending === 0) {
                  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
                  setIsChecking(false)
                }
              }
            } catch {}
          }, 1500)
        }
      })
      // Realtime session start
      socketOn('checker:session:start', (_snap: any) => {
        if (stopRequestedRef.current) return
        sessionStartRef.current = Date.now()
        setHasFetched(false)
        setTimeLeft(0)
        setIsChecking(true)
      })
      // Realtime session stopped
      socketOn('checker:session:stopped', (msg: any) => {
        console.log('[Checker] Session stopped:', msg)
        setIsChecking(false)
        stopRequestedRef.current = true
        setTimeLeft(0)
        toast({ title: 'Đã dừng checking', variant: 'default' })
      })
      // Khi ZennoPoster fetch cards → bắt đầu timeout
      socketOn('checker:fetch', (msg: any) => {
        if (stopRequestedRef.current) return
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
        const total = Number(snap.total || stats.total || results.length || 0)
        const live = Number(snap.live || 0)
        const dead = Number(snap.die || 0)
        const unknown = Number(snap.unknown || 0)
        const processed = live + dead + unknown
        const pending = typeof snap.pending === 'number' ? Math.max(0, Number(snap.pending)) : Math.max(0, total - processed)
        const progressRaw = typeof snap.progress === 'number' ? Number(snap.progress) : (total > 0 ? Math.round((processed / total) * 100) : 0)
        const progress = Math.max(0, Math.min(100, progressRaw))
        const successRate = total > 0 ? Math.round(((live + dead) / total) * 100) : 0
        const liveRate = total > 0 ? Math.round((live / total) * 100) : 0
        setStats((s) => ({
          ...s,
          live,
          dead,
          unknown,
          total,
          pending,
          progress,
          successRate,
          liveRate,
        }))
        if (typeof snap.pricePerCard === 'number') setPricePerCard(snap.pricePerCard)
        if (typeof snap.billedAmount === 'number') setSessionBilled(snap.billedAmount)
        if (isChecking) {
          const t = Number(timeoutSec) || 120
          startCountdown(t)
        }
        // Hoàn thành/stop → tắt trạng thái đang chạy
        const pendingLeft = Number(snap.pending || 0)
        if (snap.status === 'completed' || snap.stopRequested === true || pendingLeft === 0) {
          setIsChecking(false)
          stopCountdown()
          const end = Date.now()
          const dur = sessionStartRef.current ? Math.max(0, Math.round((end - sessionStartRef.current) / 1000)) : 0
          setSummary({
            total,
            live,
            die: dead,
            unknown,
            billed: typeof snap.billedAmount === 'number' ? Number(snap.billedAmount) : sessionBilled,
            durationSec: dur,
          })
          setSummaryOpen(true)
        }
      })

      // Realtime card result
      socketOn('checker:card', (msg: any) => {
        if (!msg || !msg.card) return
        const apiStatus = String(msg.status || '').toLowerCase()
        if (!apiStatus || apiStatus === 'pending' || apiStatus === 'checking') return
        const status = apiStatus === 'live' ? 'Live' : apiStatus === 'die' ? 'Die' : apiStatus === 'error' ? 'Error' : 'Unknown'
        const applyUpdate = () => setResults(prev => {
          const list = [...prev]
          const key = String(msg.card).trim()
          const idx = list.findIndex(r => String(r.card).trim() === key && r.status === 'Checking')
          if (idx !== -1) {
            list[idx] = { 
              ...list[idx], 
              status: status as any, 
              response: msg.response || '',
              cardNumber: msg.cardNumber,
              expiryMonth: msg.expiryMonth,
              expiryYear: msg.expiryYear,
              cvv: msg.cvv,
              brand: msg.brand,
              bin: msg.bin,
              country: msg.country,
              bank: msg.bank,
              level: msg.level,
              typeCheck: msg.typeCheck
            }
          }
          return list
        })
        // Reset timeout on each activity
        try { if (isChecking) { const t = Number(timeoutSec) || 120; startCountdown(t) } } catch {}
        // If cached result: avoid double delay when server already delayed
        if (msg.cached === true && msg.serverDelayed === true) {
          applyUpdate()
          removeCardsFromInput([msg.card])
        } else if (msg.cached === true) {
          const delay = Math.floor(Math.random() * (600 - 30 + 1) + 30) * 1000
          setTimeout(() => { applyUpdate(); removeCardsFromInput([msg.card]) }, delay)
        } else {
          applyUpdate()
          removeCardsFromInput([msg.card])
        }
      })
    })()
  }, [user?.balance])

  // Auto-stop when balance is insufficient for next card cost
  useEffect(() => {
    if (!isChecking) return
    if (autoStopRef.current) return
    if (pricePerCard > 0 && balance < pricePerCard) {
      autoStopRef.current = true
      stopChecking().finally(() => {
        toast({ title: 'Insufficient Credits', description: 'Auto-stopped due to low balance', variant: 'destructive' })
        setIsChecking(false)
      })
    }
  }, [balance, pricePerCard, isChecking])

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
    stopRequestedRef.current = false
    sentCardsRef.current = []
    autoStopRef.current = false
    const lines = cardsInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    const valid = lines.filter(validateLine)
    if (valid.length > 5000) {
      toast({ title: 'Too many cards', description: 'You can submit at most 5000 cards per run. Please split your list and try again.', variant: 'destructive' })
      setIsChecking(false)
      return
    }
    if (valid.length === 0) {
      toast({ title: t('common.error'), description: t('checker.messages.noCards'), variant: 'destructive' })
      setIsChecking(false)
      return
    }

    // Kiểm tra số dư trước khi gửi
    try {
      const chosen = gates.find(g => String((g as any).typeCheck) === String(selectedGate) || (g as any).id === selectedGate)
      const tc = chosen ? String((chosen as any).typeCheck) : String(selectedGate)
      const costPerCard = (typeof gateCostMap[tc] === 'number' && gateCostMap[tc] > 0) ? gateCostMap[tc] : (pricePerCard > 0 ? pricePerCard : 1)
      const requiredCredits = costPerCard * valid.length
      if (balance < requiredCredits) {
        toast({ title: t('common.error'), description: `Insufficient balance Credits. need ${Math.ceil(requiredCredits)} credits, currently has ${Math.floor(balance)} credits`, variant: 'destructive' })
        setIsChecking(false)
        return
      }
    } catch {}

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
                      card.status === 'die' ? 'Die' :
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
    const sentFullList: string[] = []

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
      } else if (dbResult && dbResult.status === 'Die') {
        // Nếu DB đã có kết quả Die: vẫn GỬI lên backend để xử lý billing + emit cached:true (FE sẽ delay)
        const [num, mm, yyOrYyyy, cvv] = line.split("|")
        cardsToCheck.push({
          cardNumber: num,
          expiryMonth: mm.padStart(2, "0"),
          expiryYear: yyOrYyyy,
          cvv,
        })
        sentFullList.push(line)

        // UI: giữ trạng thái Checking, đợi socket 'checker:card' với cached:true để hiển thị Die sau delay
        initialResults.push({
          id: `${Date.now()}-${index}`,
          card: line,
          status: "Checking"
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
        sentFullList.push(line)

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
      // Save the batch of cards actually sent for this session
      sentCardsRef.current = sentFullList
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
            const cardsFinished: string[] = []
            setResults(prevResults => {
              const newResults = [...prevResults]
              const newCache = new Map(cardCache)

              re.forEach((apiResult: any) => {
                const cardLine = String(apiResult.card || '').trim() // Backend trả về fullCard format
                const resultIndex = newResults.findIndex(r =>
                  String(r.card).trim() === cardLine && r.status === "Checking"
                )

                if (resultIndex !== -1) {
                  // Only update if we have a definitive status (not pending/checking)
                  const apiStatus = apiResult.status?.toLowerCase()
                  if (apiStatus && apiStatus !== 'pending' && apiStatus !== 'checking') {
                    const status = apiStatus === 'live' ? 'Live' :
                                 apiStatus === 'die' ? 'Die' :
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

                    // Mark for input removal
                    cardsFinished.push(cardLine)
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
      // Signal Zenno to pause only the cards sent in this session
      try { 
        const payload = { 
          LoaiDV: 1, 
          Device: 'WebDashboard', 
          pauseZenno: true,
          SessionId: sessionId,
          Content: (sentCardsRef.current || []).map(f => ({ FullThe: f }))
        }
        await apiClient.post('/checkcc', payload) 
      } catch {}

      stopRequestedRef.current = true
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
          return r // Keep existing results (Live/Die/Error) unchanged
        })
      })
      
      setIsChecking(false)
      setSessionId(null)
      toast({ title: 'Success', description: 'Checking stopped', variant: "default" })
    } catch (err) {
      console.error('Stop checking error:', err)
      setIsChecking(false)
    }
  }

  const handleStop = async () => {
    await stopChecking()
  }

  // Clear only input textarea
  const handleClearInput = () => {
    setCardsInput("")
    try { localStorage.setItem('checker_cards_input', '') } catch {}
  }

  // Clear only results (not allowed while checking)
  const handleClearResults = () => {
    if (isChecking) {
      toast({ title: 'Đang kiểm tra', description: 'Hãy dừng Checking trước khi Clear Results.', variant: 'destructive' })
      return
    }
    setResults([])
    setStats({ live: 0, dead: 0, error: 0, unknown: 0, total: 0, pending: 0, progress: 0, successRate: 0, liveRate: 0 })
    setCardCache(new Map())
    try {
      localStorage.removeItem('checker_results')
      localStorage.removeItem('checker_stats')
      localStorage.removeItem('checker_card_cache')
    } catch {}
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
    
    // Format: card|mm|yy|cvv|TYPE: xxx|LEVEL: xxx|BANK: xxx|COUNTRY https://Checkcc.live
    const txt = checked.map(r => {
      const typeCheck = r.typeCheck ? `TYPE: ${r.typeCheck === 1 ? 'CREDIT' : r.typeCheck === 2 ? 'DEBIT' : 'UNKNOWN'}` : 'TYPE: UNKNOWN'
      const level = r.level ? `LEVEL: ${r.level.toUpperCase()}` : 'LEVEL: UNKNOWN'
      const bank = r.bank ? `BANK: ${r.bank}` : 'BANK: UNKNOWN'
      const country = r.country ? `${r.country} https://Checkcc.live` : 'UNKNOWN https://Checkcc.live'
      
      return `${r.card}|${typeCheck}|${level}|${bank}|${country}`
    }).join('\n')
    
    const blob = new Blob([txt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checked_cards_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Success', description: `Exported ${checked.length} cards to TXT` })
  }

  const exportCheckedCsv = () => {
    const checked = results.filter(r => r.status !== 'Checking')
    if (checked.length === 0) return
    
    const header = 'Card Number,Expiry Month,Expiry Year,CVV,Full Card,Status,Type,Brand,BIN,Level,Bank,Country,Message'
    const rows = checked.map(r => {
      const typeCheck = r.typeCheck === 1 ? 'CREDIT' : r.typeCheck === 2 ? 'DEBIT' : 'UNKNOWN'
      return [
        r.cardNumber || '',
        r.expiryMonth || '',
        r.expiryYear || '',
        r.cvv || '',
        r.card || '',
        r.status || '',
        typeCheck,
        (r.brand || '').toUpperCase(),
        r.bin || '',
        (r.level || '').toUpperCase(),
        r.bank || '',
        r.country || '',
        (r.response || '').replace(/,/g, ';')
      ].join(',')
    })
    
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checked_cards_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Success', description: `Exported ${checked.length} cards to CSV` })
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
                      // Dùng giá gate hiện tại nếu có; fallback vào pricePerCard
                      const costPerCard = (() => {
                        const chosen = gates.find(g => String((g as any).typeCheck) === String(selectedGate) || (g as any).id === selectedGate);
                        const tc = chosen ? String((chosen as any).typeCheck) : String(selectedGate);
                        const mapped = gateCostMap[tc];
                        if (typeof mapped === 'number' && mapped > 0) return mapped;
                        if (typeof pricePerCard === 'number' && pricePerCard > 0) return pricePerCard;
                        return 1;
                      })();
                      const requiredCredits = costPerCard * valid.length;
                      
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
                      <Button onClick={handleClearInput} variant="outline" size="lg" className="w-full sm:w-auto text-xs sm:text-sm">
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
                    <option value="die">{t('checker.filterDead') || 'Die'}</option>
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
              <div className="flex items-center justify-between mb-2 gap-4">
                <Input 
                  placeholder="Search card (e.g. 4532...)"
                  value={searchCard}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchCard(e.target.value); setCurrentPage(1); }}
                  className="max-w-xs"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {filteredResults.length} results {totalPages > 1 && `(page ${currentPage}/${totalPages})`}
                  </span>
                  <Button onClick={handleClearResults} variant="outline" size="sm" disabled={isChecking}>Clear Results</Button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {paginatedResults.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-mono text-sm">{r.card}</span>
                <div className="flex items-center gap-2">
                  <Badge
                        variant={
                          r.status === "Live" ? "default" :
                          r.status === "Die" ? "destructive" :
                          r.status === "Error" ? "destructive" :
                          r.status === "Checking" ? "secondary" : "secondary"
                        }
                        className="flex items-center gap-1"
                      >
                        {r.status === "Live" && <CheckCircle className="h-3 w-3" />}
                        {r.status === "Die" && <XCircle className="h-3 w-3" />}
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
                {paginatedResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('checker.noData')}</p>
                  </div>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
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
                <span className="font-semibold flex items-center gap-2">
                  {balance.toLocaleString()}
                  {recentDebit > 0 && (
                    <span className="text-red-600 text-xs font-bold animate-pulse">- {recentDebit.toFixed(0)}</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('checker.info.pricePerCard')}</span>
                <span className="font-semibold">{pricePerCard} Credits</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('checker.info.estimatedCost')}</span>
                <span className="font-semibold text-primary">{estimatedCost} Credits</span>
              </div>
              {sessionId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Billed (this session)</span>
                  <span className="font-semibold text-red-600">- {sessionBilled.toFixed(0)} Credits</span>
                </div>
              )}
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
                    <span className="text-sm font-medium">Die</span>
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

