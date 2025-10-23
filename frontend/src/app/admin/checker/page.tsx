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
import { Settings, Activity, Play, Send, Bug, BookOpen, RefreshCw } from "lucide-react"

export default function AdminCheckerConsolePage() {
  const { toast } = useToast()
  
  // Config state
  const [config, setConfig] = useState({
    checker_card_timeout_sec: 120,
    checker_default_fetch_batch: 5,
    checker_max_concurrent_checking: 1000,
    min_cards_per_check: 1,
    max_cards_per_check: 1000,
    default_price_per_card: 1
  })
  const [configLoading, setConfigLoading] = useState(false)

  // Metrics state
  const [metrics, setMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Start Tester state
  const [startCards, setStartCards] = useState("")
  const [startGate, setStartGate] = useState("1")
  const [startResult, setStartResult] = useState<any>(null)

  // Fetch Tester state
  const [fetchAmount, setFetchAmount] = useState("5")
  const [fetchTypeCheck, setFetchTypeCheck] = useState("1")
  const [fetchResult, setFetchResult] = useState<any>(null)

  // Update Tester state
  const [updateId, setUpdateId] = useState("")
  const [updateStatus, setUpdateStatus] = useState("2")
  const [updateResult, setUpdateResult] = useState<any>(null)

  // Load config
  const loadConfig = async () => {
    setConfigLoading(true)
    try {
      const res = await apiClient.get('/admin/site-config')
      if (res.data?.success && res.data?.data?.siteConfig) {
        const cfg = res.data.data.siteConfig
        setConfig({
          checker_card_timeout_sec: cfg.checkerCardTimeoutSec || 120,
          checker_default_fetch_batch: cfg.checkerDefaultBatchSize || 5,
          checker_max_concurrent_checking: 1000,
          min_cards_per_check: 1,
          max_cards_per_check: 1000,
          default_price_per_card: 1
        })
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể tải cấu hình", variant: "destructive" })
    } finally {
      setConfigLoading(false)
    }
  }

  // Load metrics
  const loadMetrics = async () => {
    setMetricsLoading(true)
    try {
      const res = await apiClient.get('/admin/checker/metrics')
      if (res.data?.success) {
        setMetrics(res.data.data)
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể tải metrics", variant: "destructive" })
    } finally {
      setMetricsLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
    loadMetrics()
    const interval = setInterval(loadMetrics, 10000)
    return () => clearInterval(interval)
  }, [])

  // Test Start
  const testStart = async () => {
    try {
      const lines = startCards.split('\n').filter(Boolean)
      const cards = lines.map(l => {
        const [num, mm, yy, cvv] = l.split('|')
        return { cardNumber: num, expiryMonth: mm, expiryYear: yy, cvv }
      })
      const res = await apiClient.post('/checkcc/start', { cards, checkType: parseInt(startGate), gate: startGate })
      setStartResult(res.data)
      toast({ title: "Thành công", description: "Đã gửi request Start" })
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể gửi Start", variant: "destructive" })
    }
  }

  // Test Fetch
  const testFetch = async () => {
    try {
      const res = await apiClient.post('/checkcc', { LoaiDV: 1, Amount: parseInt(fetchAmount), TypeCheck: parseInt(fetchTypeCheck) })
      setFetchResult(res.data)
      toast({ title: "Thành công", description: "Đã gọi Fetch API" })
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể gọi Fetch", variant: "destructive" })
    }
  }

  // Test Update
  const testUpdate = async () => {
    try {
      const res = await apiClient.post('/checkcc', { LoaiDV: 2, Id: updateId, Status: parseInt(updateStatus), Msg: 'Test từ Admin Console' })
      setUpdateResult(res.data)
      toast({ title: "Thành công", description: "Đã gọi Update API" })
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể gọi Update", variant: "destructive" })
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bảng Điều Khiển Checker (Admin)</h1>
      
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="config"><Settings className="w-4 h-4 mr-2"/>Cấu hình</TabsTrigger>
          <TabsTrigger value="metrics"><Activity className="w-4 h-4 mr-2"/>Giám sát</TabsTrigger>
          <TabsTrigger value="start"><Play className="w-4 h-4 mr-2"/>Start</TabsTrigger>
          <TabsTrigger value="fetch"><Send className="w-4 h-4 mr-2"/>Fetch</TabsTrigger>
          <TabsTrigger value="update"><Send className="w-4 h-4 mr-2"/>Update</TabsTrigger>
          <TabsTrigger value="debug"><Bug className="w-4 h-4 mr-2"/>Debug</TabsTrigger>
          <TabsTrigger value="guide"><BookOpen className="w-4 h-4 mr-2"/>Hướng dẫn</TabsTrigger>
        </TabsList>

        {/* Cấu hình API */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình API Checker</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timeout mỗi thẻ (giây)</Label>
                  <Input type="number" value={config.checker_card_timeout_sec} onChange={e => setConfig({...config, checker_card_timeout_sec: parseInt(e.target.value)})} />
                </div>
                <div>
                  <Label>Batch mặc định</Label>
                  <Input type="number" value={config.checker_default_fetch_batch} onChange={e => setConfig({...config, checker_default_fetch_batch: parseInt(e.target.value)})} />
                </div>
                <div>
                  <Label>Tối đa đồng thời</Label>
                  <Input type="number" value={config.checker_max_concurrent_checking} onChange={e => setConfig({...config, checker_max_concurrent_checking: parseInt(e.target.value)})} />
                </div>
                <div>
                  <Label>Giá mặc định/thẻ</Label>
                  <Input type="number" value={config.default_price_per_card} onChange={e => setConfig({...config, default_price_per_card: parseInt(e.target.value)})} />
                </div>
              </div>
              <Button onClick={loadConfig} disabled={configLoading}>
                <RefreshCw className="w-4 h-4 mr-2"/>Tải lại
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Giám sát & Thống kê */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Giám sát & Thống kê</CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? <p>Đang tải...</p> : metrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">{metrics.queue?.pending || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Checking</p>
                      <p className="text-2xl font-bold">{metrics.queue?.checking || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Unknown</p>
                      <p className="text-2xl font-bold">{metrics.queue?.unknown || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Live</p>
                      <p className="text-2xl font-bold text-green-600">{metrics.queue?.live || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Die</p>
                      <p className="text-2xl font-bold text-red-600">{metrics.queue?.die || 0}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Fetch/phút</p>
                      <p className="text-xl font-semibold">{metrics.tps?.fetchPerMin || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Update/phút</p>
                      <p className="text-xl font-semibold">{metrics.tps?.updatePerMin || 0}</p>
                    </div>
                  </div>
                  <Button onClick={loadMetrics} disabled={metricsLoading}>
                    <RefreshCw className="w-4 h-4 mr-2"/>Làm mới
                  </Button>
                </div>
              ) : <p>Không có dữ liệu</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Start Tester */}
        <TabsContent value="start">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm thử Start API</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Danh sách thẻ (CC|MM|YY|CVV)</Label>
                <Textarea placeholder="4532015112830366|12|25|123" value={startCards} onChange={e => setStartCards(e.target.value)} rows={5} />
              </div>
              <div>
                <Label>Gate (typeCheck)</Label>
                <Input value={startGate} onChange={e => setStartGate(e.target.value)} />
              </div>
              <Button onClick={testStart}><Play className="w-4 h-4 mr-2"/>Gửi Start</Button>
              {startResult && (
                <div className="mt-4 p-4 bg-muted rounded">
                  <pre className="text-xs">{JSON.stringify(startResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fetch Tester */}
        <TabsContent value="fetch">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm thử Fetch API (LoaiDV=1)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Số lượng (Amount)</Label>
                <Input type="number" value={fetchAmount} onChange={e => setFetchAmount(e.target.value)} />
              </div>
              <div>
                <Label>TypeCheck</Label>
                <Input value={fetchTypeCheck} onChange={e => setFetchTypeCheck(e.target.value)} />
              </div>
              <Button onClick={testFetch}><Send className="w-4 h-4 mr-2"/>Gọi Fetch</Button>
              {fetchResult && (
                <div className="mt-4 p-4 bg-muted rounded">
                  <pre className="text-xs">{JSON.stringify(fetchResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Update Tester */}
        <TabsContent value="update">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm thử Update API (LoaiDV=2)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Card ID</Label>
                <Input value={updateId} onChange={e => setUpdateId(e.target.value)} placeholder="Card _id từ DB" />
              </div>
              <div>
                <Label>Status (1=checking, 2=live, 3=die, 4=unknown)</Label>
                <Input value={updateStatus} onChange={e => setUpdateStatus(e.target.value)} />
              </div>
              <Button onClick={testUpdate}><Send className="w-4 h-4 mr-2"/>Gửi Update</Button>
              {updateResult && (
                <div className="mt-4 p-4 bg-muted rounded">
                  <pre className="text-xs">{JSON.stringify(updateResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debug */}
        <TabsContent value="debug">
          <Card>
            <CardHeader>
              <CardTitle>Debug Console</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Xem logs request/response ở các tab Tester bên trên.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hướng dẫn */}
        <TabsContent value="guide">
          <Card>
            <CardHeader>
              <CardTitle>Hướng dẫn tích hợp ZennoPoster</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Fetch thẻ (LoaiDV=1)</h3>
                <pre className="bg-muted p-2 rounded text-xs">
POST /api/checkcc
{`{"LoaiDV": 1, "Amount": 5, "TypeCheck": 1}`}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. Update kết quả (LoaiDV=2)</h3>
                <pre className="bg-muted p-2 rounded text-xs">
POST /api/checkcc
{`{"LoaiDV": 2, "Id": "<card_id>", "Status": 2, "Msg": "Approved"}`}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. Status mapping</h3>
                <ul className="list-disc list-inside text-sm">
                  <li>1 = checking</li>
                  <li>2 = live</li>
                  <li>3 = die</li>
                  <li>4 = unknown</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4. PauseZenno</h3>
                <p className="text-sm">Khi hết thẻ, server trả <code>PauseZenno: true</code> để ZennoPoster dừng lại.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
