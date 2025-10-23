"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { useSocket } from "@/hooks/use-socket"
import { Play, Send, Bug, BookOpen, RefreshCw, Square, Copy, Loader2 } from "lucide-react"

export default function AdminAPITesterPage() {
  const { toast } = useToast()
  const { on: socketOn, emit: socketEmit, isConnected } = useSocket({ enabled: true })

  // Start Tab State
  const [startCards, setStartCards] = useState("")
  const [startGate, setStartGate] = useState("1")
  const [startSessionId, setStartSessionId] = useState<string | null>(null)
  const [startStats, setStartStats] = useState({ total: 0, processed: 0, pending: 0, live: 0, die: 0, unknown: 0, billedAmount: 0, pricePerCard: 0 })
  const [startResults, setStartResults] = useState<any[]>([])
  const [startLoading, setStartLoading] = useState(false)

  // Fetch Tab State
  const [fetchAmount, setFetchAmount] = useState("5")
  const [fetchTypeCheck, setFetchTypeCheck] = useState("1")
  const [fetchToken, setFetchToken] = useState("")
  const [fetchDevice, setFetchDevice] = useState("Admin-Tester")
  const [fetchResult, setFetchResult] = useState<any>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [autoFetchInterval, setAutoFetchInterval] = useState<NodeJS.Timeout | null>(null)

  // Update Tab State
  const [updateId, setUpdateId] = useState("")
  const [updateFullCard, setUpdateFullCard] = useState("")
  const [updateStatus, setUpdateStatus] = useState("2") // 1=live, 2=die, 3=checking, 4=unknown
  const [updateMsg, setUpdateMsg] = useState("Approved")
  const [updateTypeCheck, setUpdateTypeCheck] = useState("1")
  const [updateResult, setUpdateResult] = useState<any>(null)
  const [updateLoading, setUpdateLoading] = useState(false)
  
  // Batch Update
  const [updateBatchItems, setUpdateBatchItems] = useState("")

  // Debug Tab State
  const [debugLogs, setDebugLogs] = useState<any[]>([])
  const [socketEventCount, setSocketEventCount] = useState(0)

  // Load config on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/admin/site-config")
        const cfg = (res as any)?.data?.data?.siteConfig || {}
        if (cfg.checkerDefaultBatchSize != null) {
          setFetchAmount(String(cfg.checkerDefaultBatchSize))
        }
      } catch (e) {
        console.error('Failed to load checker config:', e)
      }
    })()
  }, [])

  // Socket listeners for Start tab
  useEffect(() => {
    if (!startSessionId) return

    const cleanup1 = socketOn('checker:session:start', (data: any) => {
      addDebugLog('Socket', 'checker:session:start', data)
      if (data.sessionId === startSessionId) {
        setStartStats(s => ({ ...s, total: data.total, pricePerCard: data.pricePerCard }))
      }
    })

    const cleanup2 = socketOn('checker:session:update', (data: any) => {
      addDebugLog('Socket', 'checker:session:update', data)
      setSocketEventCount(c => c + 1)
      if (data.sessionId === startSessionId) {
        setStartStats({
          total: data.total || 0,
          processed: data.processed || 0,
          pending: data.pending || 0,
          live: data.live || 0,
          die: data.die || 0,
          unknown: data.unknown || 0,
          billedAmount: data.billedAmount || 0,
          pricePerCard: data.pricePerCard || 0
        })
      }
    })

    const cleanup3 = socketOn('checker:card', (data: any) => {
      addDebugLog('Socket', 'checker:card', data)
      setSocketEventCount(c => c + 1)
      if (data.sessionId === startSessionId) {
        setStartResults(prev => {
          const idx = prev.findIndex(r => r.card === data.card)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], status: data.status, response: data.response }
            return updated
          }
          return [...prev, { card: data.card, status: data.status, response: data.response }]
        })
      }
    })

    return () => {
      cleanup1()
      cleanup2()
      cleanup3()
    }
  }, [startSessionId, socketOn])

  const addDebugLog = (type: string, event: string, data: any) => {
    setDebugLogs(prev => [{
      timestamp: new Date().toISOString(),
      type,
      event,
      data: JSON.stringify(data, null, 2)
    }, ...prev.slice(0, 99)]) // Keep last 100 logs
  }

  // Start Tab Actions
  const handleStart = async () => {
    setStartLoading(true)
    try {
      const lines = startCards.split('\n').filter(Boolean)
      const cards = lines.map(l => {
        const [num, mm, yy, cvv] = l.split('|')
        return { cardNumber: num, expiryMonth: mm, expiryYear: yy, cvv }
      })

      const res = await apiClient.post('/checkcc/start', { cards, checkType: parseInt(startGate), gate: startGate })
      addDebugLog('API', 'POST /checkcc/start', res.data)
      
      if (res.data?.success) {
        const sessionId = res.data.data?.sessionId
        setStartSessionId(sessionId)
        if (sessionId && socketEmit) {
          socketEmit('session:join', sessionId)
        }
        setStartResults(cards.map(c => ({ card: `${c.cardNumber}|${c.expiryMonth}|${c.expiryYear}|${c.cvv}`, status: 'pending', response: '' })))
        toast({ title: "Thành công", description: `Session ${sessionId} đã bắt đầu` })
      } else {
        toast({ title: "Lỗi", description: res.data?.message || "Không thể start", variant: "destructive" })
      }
    } catch (error: any) {
      addDebugLog('Error', 'POST /checkcc/start', error)
      toast({ title: "Lỗi", description: error.message, variant: "destructive" })
    } finally {
      setStartLoading(false)
    }
  }

  const handleStop = async () => {
    if (!startSessionId) return
    try {
      const res = await apiClient.post('/checkcc/stop', { sessionId: startSessionId, stop: true })
      addDebugLog('API', 'POST /checkcc/stop', res.data)
      if (socketEmit) {
        socketEmit('session:leave', startSessionId)
      }
      toast({ title: "Đã dừng", description: `Session ${startSessionId}` })
      setStartSessionId(null)
    } catch (error: any) {
      addDebugLog('Error', 'POST /checkcc/stop', error)
      toast({ title: "Lỗi", description: error.message, variant: "destructive" })
    }
  }

  const handleClearStart = () => {
    setStartCards("")
    setStartResults([])
    setStartStats({ total: 0, processed: 0, pending: 0, live: 0, die: 0, unknown: 0, billedAmount: 0, pricePerCard: 0 })
    if (startSessionId && socketEmit) {
      socketEmit('session:leave', startSessionId)
    }
    setStartSessionId(null)
  }

  // Fetch Tab Actions
  const handleFetch = async () => {
    setFetchLoading(true)
    try {
      const payload = {
        LoaiDV: 1,
        Amount: parseInt(fetchAmount),
        TypeCheck: parseInt(fetchTypeCheck),
        Device: fetchDevice
      }
      
      const res = await apiClient.post('/checkcc', payload, {
        headers: fetchToken ? { 'Authorization': `Bearer ${fetchToken}` } : {}
      })
      
      addDebugLog('API', 'POST /checkcc (LoaiDV=1)', res.data)
      setFetchResult(res.data)
      
      if (res.data?.ErrorId === 1 && res.data?.PauseZenno) {
        toast({ title: "Hết thẻ", description: res.data?.Message || "Card store not found", variant: "default" })
      } else {
        toast({ title: "Thành công", description: `Fetched ${res.data?.Content?.length || 0} cards` })
      }
    } catch (error: any) {
      addDebugLog('Error', 'POST /checkcc (LoaiDV=1)', error)
      toast({ title: "Lỗi", description: error.message, variant: "destructive" })
    } finally {
      setFetchLoading(false)
    }
  }

  const handleAutoFetchStart = () => {
    if (autoFetchInterval) return
    const interval = setInterval(() => {
      handleFetch()
    }, 5000) // Fetch every 5 seconds
    setAutoFetchInterval(interval)
    toast({ title: "Auto-Fetch Started", description: "Fetching every 5 seconds" })
  }

  const handleAutoFetchStop = () => {
    if (autoFetchInterval) {
      clearInterval(autoFetchInterval)
      setAutoFetchInterval(null)
      toast({ title: "Auto-Fetch Stopped" })
    }
  }

  // Update Tab Actions
  const handleUpdateOne = async () => {
    setUpdateLoading(true)
    try {
      const payload = {
        LoaiDV: 2,
        Id: updateId,
        FullThe: updateFullCard,
        Status: parseInt(updateStatus),
        Msg: updateMsg,
        TypeCheck: parseInt(updateTypeCheck)
      }
      
      const res = await apiClient.post('/checkcc', payload)
      addDebugLog('API', 'POST /checkcc (LoaiDV=2) Single', res.data)
      setUpdateResult(res.data)
      toast({ title: "Thành công", description: "Đã gửi update" })
    } catch (error: any) {
      addDebugLog('Error', 'POST /checkcc (LoaiDV=2)', error)
      toast({ title: "Lỗi", description: error.message, variant: "destructive" })
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleUpdateBatch = async () => {
    setUpdateLoading(true)
    try {
      const lines = updateBatchItems.split('\n').filter(Boolean)
      const items = lines.map(line => {
        const [id, status, msg] = line.split('|')
        return { Id: id, Status: parseInt(status), Msg: msg || 'Batch update', TypeCheck: parseInt(updateTypeCheck) }
      })
      
      const payload = {
        items
      }
      
      const res = await apiClient.post('/checkcc/update', payload)
      addDebugLog('API', 'POST /checkcc/update Batch', res.data)
      setUpdateResult(res.data)
      toast({ title: "Thành công", description: `Đã gửi ${items.length} updates` })
    } catch (error: any) {
      addDebugLog('Error', 'POST /checkcc/update Batch', error)
      toast({ title: "Lỗi", description: error.message, variant: "destructive" })
    } finally {
      setUpdateLoading(false)
    }
  }

  const copyCurl = (endpoint: string) => {
    let curl = ``
    if (endpoint === 'fetch') {
      curl = `curl -X POST https://checkcc.live/api/checkcc \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"LoaiDV":1,"Amount":5,"TypeCheck":1,"Device":"ZennoPoster"}'`
    } else if (endpoint === 'update') {
      curl = `curl -X POST https://checkcc.live/api/checkcc \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"LoaiDV":2,"Id":"CARD_ID","Status":2,"Msg":"Declined","TypeCheck":1}'`
    } else if (endpoint === 'evict') {
      curl = `curl -X POST https://checkcc.live/api/checkcc/evict \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId":"SESSION_ID"}'`
    }
    navigator.clipboard.writeText(curl)
    toast({ title: "Copied", description: "cURL command copied to clipboard" })
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin API Tester</h1>
      
      <Tabs defaultValue="start" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="start"><Play className="w-4 h-4 mr-2"/>Start (FE Mimic)</TabsTrigger>
          <TabsTrigger value="fetch"><Send className="w-4 h-4 mr-2"/>Fetch (LoaiDV=1)</TabsTrigger>
          <TabsTrigger value="update"><Send className="w-4 h-4 mr-2"/>Update (LoaiDV=2)</TabsTrigger>
          <TabsTrigger value="debug"><Bug className="w-4 h-4 mr-2"/>Debug</TabsTrigger>
          <TabsTrigger value="guide"><BookOpen className="w-4 h-4 mr-2"/>Hướng dẫn</TabsTrigger>
        </TabsList>

        {/* Start Tab */}
        <TabsContent value="start">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm thử Start API (FE Mimic)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Danh sách thẻ (CC|MM|YY|CVV)</Label>
                <Textarea 
                  placeholder="4532015112830366|12|25|123" 
                  value={startCards} 
                  onChange={e => setStartCards(e.target.value)} 
                  rows={5}
                  disabled={!!startSessionId}
                />
              </div>
              <div>
                <Label>Gate (TypeCheck)</Label>
                <Input value={startGate} onChange={e => setStartGate(e.target.value)} disabled={!!startSessionId} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStart} disabled={startLoading || !!startSessionId}>
                  <Play className="w-4 h-4 mr-2"/>Start
                </Button>
                <Button onClick={handleStop} disabled={!startSessionId} variant="destructive">
                  <Square className="w-4 h-4 mr-2"/>Stop
                </Button>
                <Button onClick={handleClearStart} variant="outline">Clear</Button>
              </div>

              {startSessionId && (
                <div className="mt-4 p-4 bg-muted rounded space-y-2">
                  <p><strong>Session ID:</strong> {startSessionId}</p>
                  <p><strong>Price/Card:</strong> {startStats.pricePerCard}</p>
                  <p><strong>Billed:</strong> {startStats.billedAmount}</p>
                  <div className="grid grid-cols-6 gap-2">
                    <div><strong>Total:</strong> {startStats.total}</div>
                    <div><strong>Processed:</strong> {startStats.processed}</div>
                    <div><strong>Pending:</strong> {startStats.pending}</div>
                    <div className="text-green-600"><strong>Live:</strong> {startStats.live}</div>
                    <div className="text-red-600"><strong>Die:</strong> {startStats.die}</div>
                    <div><strong>Unknown:</strong> {startStats.unknown}</div>
                  </div>
                </div>
              )}

              {startResults.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Results ({startResults.length})</h3>
                  <div className="max-h-96 overflow-y-auto space-y-1">
                    {startResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded text-sm">
                        <span className="font-mono">{r.card}</span>
                        <Badge variant={r.status === 'live' ? 'default' : r.status === 'die' ? 'destructive' : 'secondary'} className="flex items-center gap-1">
                          {(r.status === 'pending' || r.status === 'checking') && <Loader2 className="w-3 h-3 animate-spin" />}
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fetch Tab */}
        <TabsContent value="fetch">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm thử Fetch API (LoaiDV=1)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={fetchAmount} onChange={e => setFetchAmount(e.target.value)} />
                </div>
                <div>
                  <Label>TypeCheck</Label>
                  <Input value={fetchTypeCheck} onChange={e => setFetchTypeCheck(e.target.value)} />
                </div>
                <div>
                  <Label>Token (Optional)</Label>
                  <Input type="password" value={fetchToken} onChange={e => setFetchToken(e.target.value)} placeholder="Bearer token" />
                </div>
                <div>
                  <Label>Device</Label>
                  <Input value={fetchDevice} onChange={e => setFetchDevice(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleFetch} disabled={fetchLoading}>
                  <Send className="w-4 h-4 mr-2"/>Fetch Once
                </Button>
                <Button onClick={handleAutoFetchStart} disabled={!!autoFetchInterval} variant="outline">
                  Auto-Fetch Start
                </Button>
                <Button onClick={handleAutoFetchStop} disabled={!autoFetchInterval} variant="outline">
                  Auto-Fetch Stop
                </Button>
              </div>

              {fetchResult && (
                <div className="mt-4 p-4 bg-muted rounded">
                  <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(fetchResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Update Tab */}
        <TabsContent value="update">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm thử Update API (LoaiDV=2)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">Single Update</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Card ID</Label>
                  <Input value={updateId} onChange={e => setUpdateId(e.target.value)} placeholder="Card _id từ DB" />
                </div>
                <div>
                  <Label>Full Card (Optional)</Label>
                  <Input value={updateFullCard} onChange={e => setUpdateFullCard(e.target.value)} placeholder="CC|MM|YY|CVV" />
                </div>
                <div>
                  <Label>Status (1=live, 2=die, 3=checking, 4=unknown)</Label>
                  <Input value={updateStatus} onChange={e => setUpdateStatus(e.target.value)} />
                </div>
                <div>
                  <Label>Message</Label>
                  <Input value={updateMsg} onChange={e => setUpdateMsg(e.target.value)} />
                </div>
                <div>
                  <Label>TypeCheck</Label>
                  <Input value={updateTypeCheck} onChange={e => setUpdateTypeCheck(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleUpdateOne} disabled={updateLoading}>
                <Send className="w-4 h-4 mr-2"/>Send One
              </Button>

              <hr className="my-4"/>

              <h3 className="font-semibold">Batch Update</h3>
              <div>
                <Label>Batch Items (ID|Status|Msg per line)</Label>
                <Textarea 
                  placeholder="card_id_1|2|Declined
card_id_2|1|Approved" 
                  value={updateBatchItems} 
                  onChange={e => setUpdateBatchItems(e.target.value)} 
                  rows={5}
                />
              </div>
              <Button onClick={handleUpdateBatch} disabled={updateLoading}>
                <Send className="w-4 h-4 mr-2"/>Send Batch
              </Button>

              {updateResult && (
                <div className="mt-4 p-4 bg-muted rounded">
                  <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(updateResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debug Tab */}
        <TabsContent value="debug">
          <Card>
            <CardHeader>
              <CardTitle>Debug Console</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4">
                <Badge>Socket Events: {socketEventCount}</Badge>
                <Badge variant="outline">Total Logs: {debugLogs.length}</Badge>
                <Button size="sm" onClick={() => setDebugLogs([])}>Clear Logs</Button>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {debugLogs.map((log, i) => (
                  <div key={i} className="p-2 border rounded text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={log.type === 'Error' ? 'destructive' : 'default'}>{log.type}</Badge>
                      <span className="text-muted-foreground">{log.timestamp}</span>
                      <span className="font-semibold">{log.event}</span>
                    </div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">{log.data}</pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guide Tab */}
        <TabsContent value="guide">
          <Card>
            <CardHeader>
              <CardTitle>Hướng dẫn tích hợp ZennoPoster</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Fetch cards (LoaiDV=1)</h3>
                <Button size="sm" onClick={() => copyCurl('fetch')} className="mb-2">
                  <Copy className="w-4 h-4 mr-2"/>Copy cURL
                </Button>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
{`POST /api/checkcc
{
  "LoaiDV": 1,
  "Amount": 5,
  "TypeCheck": 1,
  "Device": "ZennoPoster"
}`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. Update status (LoaiDV=2)</h3>
                <Button size="sm" onClick={() => copyCurl('update')} className="mb-2">
                  <Copy className="w-4 h-4 mr-2"/>Copy cURL
                </Button>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
{`POST /api/checkcc
{
  "LoaiDV": 2,
  "Id": "CARD_ID",
  "Status": 2,
  "Msg": "Declined",
  "TypeCheck": 1
}`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Evict/Stop</h3>
                <Button size="sm" onClick={() => copyCurl('evict')} className="mb-2">
                  <Copy className="w-4 h-4 mr-2"/>Copy cURL
                </Button>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
{`POST /api/checkcc/evict
{
  "sessionId": "SESSION_ID"
}`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Status Mapping</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><strong>1</strong> = Live (Approved)</li>
                  <li><strong>2</strong> = Die (Declined)</li>
                  <li><strong>3</strong> = Checking (Processing)</li>
                  <li><strong>4</strong> = Unknown (Error/Timeout)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">PauseZenno</h3>
                <p className="text-sm">Khi hết thẻ, server trả:</p>
                <pre className="bg-muted p-2 rounded text-xs">
{`{
  "ErrorId": 1,
  "Title": "card store not found",
  "Message": "No cards available",
  "PauseZenno": true,
  "Content": []
}`}
                </pre>
                <p className="text-sm mt-2">ZennoPoster nên dừng vòng lặp khi nhận được <code>PauseZenno: true</code></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
