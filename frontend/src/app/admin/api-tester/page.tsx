'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/shared/Toast'
import { apiClient } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Send, Copy, Trash2, Info, Loader2 } from 'lucide-react'

interface TestRequest {
  id: string
  timestamp: string
  type: 'sender' | 'receiver'
  payload: any
  response: any
  status: 'pending' | 'success' | 'error'
  error?: string
}

interface Gate {
  id: string
  name: string
  typeCheck: number
  description?: string
}

export default function ApiTesterPage() {
  const { success, error: showError } = useToast()
  const [inspectorTab, setInspectorTab] = useState<'request' | 'response'>('request')
  const [lastRequest, setLastRequest] = useState<{ url: string; method: string; headers: Record<string,string>; body: any } | null>(null)
  const [lastResponse, setLastResponse] = useState<{ status?: number; data?: any; error?: any } | null>(null)
  const [results, setResults] = useState<Array<{ Id: string|number; FullThe: string; TypeCheck?: number; Price?: number; status: 'Pending' | 'Live' | 'Dead' | 'Unknown' | 'Error'; msg?: string }>>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<'sender' | 'receiver'>('sender')
  const [logs, setLogs] = useState<TestRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [gates, setGates] = useState<Gate[]>([])
  const [selectedGate, setSelectedGate] = useState<string>('')
  
  // Sender fields (LoaiDV=1)
  const [senderUrl, setSenderUrl] = useState('')
  const [cardNumber, setCardNumber] = useState('4532015112830366')
  const [cardMonth, setCardMonth] = useState('12')
  const [cardYear, setCardYear] = useState('25')
  const [cardCvv, setCardCvv] = useState('123')
  
  // Receiver fields (LoaiDV=2 - Manual input forms)
  const [receiverId, setReceiverId] = useState('')
  const [receiverStatus, setReceiverStatus] = useState('Live')
  const [receiverState, setReceiverState] = useState('')
  const [receiverFrom, setReceiverFrom] = useState('External API')
  const [receiverMsg, setReceiverMsg] = useState('')

  // Crypto API fields
  const [cryptoMethod, setCryptoMethod] = useState('GET_BALANCE')
  const [cryptoAddress, setCryptoAddress] = useState('')
  const [cryptoAmount, setCryptoAmount] = useState('')
  const [cryptoResponse, setCryptoResponse] = useState('')

  useEffect(() => {
    // Set token for API calls
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    if (token) {
      apiClient.setToken(token)
    }
    
    // Load gates from API
    const loadGates = async () => {
      try {
        const response = await apiClient.get('/gates')
        const gatesData = response.data?.data?.gates || []
        if (Array.isArray(gatesData) && gatesData.length > 0) {
          setGates(gatesData)
          setSelectedGate(String(gatesData[0].typeCheck))
        }
      } catch (error) {
        console.error('Failed to load gates:', error)
      }
    }
    loadGates()

    // Compute senderUrl from apiClient base
    try {
      const base = (apiClient.getBaseUrl() || '').replace(/\/?$/, '')
      setSenderUrl(`${base}/checkcc`)
    } catch {}
  }, [])

  const buildHeadersPreview = () => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : ''
    const masked = token ? `${token.slice(0,4)}...${token.slice(-4)}` : ''
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${masked}` } : {}),
      'User-Agent': 'API-Tester/1.0',
    }
  }

  const addLog = (req: TestRequest) => {
    setLogs(prev => [req, ...prev])
  }

  const clearLogs = () => {
    setLogs([])
    success('Logs cleared')
  }

  // Auto-populate LoaiDV2 form from card data
  const handleQuickUpdate = (cardData: any) => {
    // Extract card ID and info from LoaiDV1 response
    setReceiverId(String(cardData.Id || ''))
    setReceiverStatus('Live')
    setReceiverState('')
    setReceiverFrom('Test API')
    setReceiverMsg('')
    // Switch to receiver tab
    // Note: You may need to add tab switching logic here
    success('Auto-filled', 'Card data loaded to LoaiDV2 tab')
  }

  // LoaiDV=1: Fetch cards from /api/checkcc
  const handleSendCard = async () => {
    const reqId = Date.now().toString()
    const payload = {
      // apicheckcc.md
      Token: localStorage.getItem('token') || '',
      LoaiDV: 1,
      Device: 'API-Tester',
      Amount: 10,
      TypeCheck: parseInt(selectedGate) || 1,
      // manual fields to allow backend fallback create card when stock is empty
      cardNumber: cardNumber.trim(),
      cardMonth: cardMonth.trim(),
      cardYear: cardYear.trim(),
      cardCvv: cardCvv.trim(),
    }

    addLog({
      id: reqId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'sender',
      payload,
      response: null,
      status: 'pending'
    })

    try {
      setLoading(true)
      setResultsLoading(true)
      setResults([])
      // Preview inspector
      setLastRequest({ url: senderUrl || '/api/checkcc', method: 'POST', headers: buildHeadersPreview(), body: payload })
      // Send to /api/checkcc endpoint
      const response = await apiClient.post('/checkcc', payload)
      setLastResponse({ status: response.status, data: response.data })
      const data = response.data
      
      setLogs(prev => prev.map(log =>
        log.id === reqId
          ? {
              ...log,
              response: data,
              status: data.ErrorId === 0 ? 'success' : 'error',
              error: data.ErrorId !== 0 ? data.Message || 'Request failed' : undefined
            }
          : log
      ))

      if (data.ErrorId === 0) {
        success('Success', `Received ${data.Content?.length || 0} cards`)
        // Build pending results list
        if (Array.isArray(data.Content)) {
          const pending = data.Content.map((c: any) => ({
            Id: c.Id,
            FullThe: c.FullThe,
            TypeCheck: c.TypeCheck,
            Price: c.Price,
            status: 'Pending' as const,
          }))
          setResults(pending)
        }
        // Auto-populate first card to LoaiDV2 if available
        if (Array.isArray(data.Content) && data.Content.length > 0) {
          handleQuickUpdate(data.Content[0])
        }
      } else {
        // Friendly handling for Out of stock
        setResults([])
        const msg = data.Message || 'Failed to fetch cards'
        showError('Error', msg)
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Network error'
      setLogs(prev => prev.map(log =>
        log.id === reqId
          ? {
              ...log,
              status: 'error',
              error: errorMsg,
              response: null
            }
          : log
      ))
      showError('Error', errorMsg)
      setLastResponse({ error: errorMsg })
    } finally {
      setLoading(false)
      setResultsLoading(false)
    }
  }

  // Crypto API Test
  const handleTestCryptoAPI = async () => {
    const reqId = Date.now().toString()
    const payload: any = {
      method: cryptoMethod,
      address: cryptoAddress.trim()
    }
    if (cryptoMethod === 'CREATE_PAYMENT' && cryptoAmount) {
      payload.amount = parseFloat(cryptoAmount)
    }

    addLog({
      id: reqId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'sender',
      payload,
      response: null,
      status: 'pending'
    })

    try {
      setLoading(true)
      // Test via backend CryptAPI test endpoint
      const response = await apiClient.get('/payments/cryptapi/test')

      setLogs(prev => prev.map(log =>
        log.id === reqId
          ? {
              ...log,
              response: response.data,
              status: 'success'
            }
          : log
      ))

      success('Thành công', 'Kiểm tra CryptAPI thành công')
      setCryptoResponse(JSON.stringify(response.data, null, 2))
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Yêu cầu thất bại'
      setLogs(prev => prev.map(log =>
        log.id === reqId
          ? {
              ...log,
              status: 'error',
              error: errorMsg,
              response: error.response?.data
            }
          : log
      ))
      showError('Lỗi', errorMsg)
      setCryptoResponse(JSON.stringify(error.response?.data || { error: errorMsg }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  // LoaiDV=2: Receive result from external sender
  const handleReceiveResult = async () => {
    if (!receiverId.trim()) {
      showError('Error', 'ID is required')
      return
    }

    // Map status text to numeric code for API
    const statusMap: Record<string, number> = {
      'Live': 2,
      'Dead': 3,
      'Unknown': 4,
      'Error': 4
    }
    
    const reqId = Date.now().toString()
    const payload = {
      // apicheckcc.md
      Token: localStorage.getItem('token') || '',
      LoaiDV: 2,
      Device: 'API-Tester',
      Id: receiverId.trim(),
      Status: statusMap[receiverStatus] || 4,
      State: receiverState.trim() || '',
      From: receiverFrom.trim() || '3',
      TypeCheck: parseInt(selectedGate) || 1,
      Msg: receiverMsg.trim() || ''
    }

    addLog({
      id: reqId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'receiver',
      payload,
      response: null,
      status: 'pending'
    })

    try {
      setLoading(true)
      setLastRequest({ url: senderUrl || '/api/checkcc', method: 'POST', headers: buildHeadersPreview(), body: payload })
      // Send to /api/checkcc with LoaiDV=2
      const response = await apiClient.post('/checkcc', payload)
      setLastResponse({ status: response.status, data: response.data })

      setLogs(prev => prev.map(log =>
        log.id === reqId
          ? {
              ...log,
              response: response.data,
              status: 'success'
            }
          : log
      ))

      success('Success', 'Result received and saved')
      // Realtime update local results list
      setResults(prev => prev.map(item => {
        if (String(item.Id) === String(receiverId.trim())) {
          const newStatus = receiverStatus as 'Live' | 'Dead' | 'Unknown' | 'Error'
          return { ...item, status: newStatus, msg: receiverMsg.trim() }
        }
        return item
      }))
      // Clear form
      setReceiverId('')
      setReceiverStatus('Live')
      setReceiverState('')
      setReceiverFrom('External API')
      setReceiverMsg('')
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Request failed'
      setLogs(prev => prev.map(log =>
        log.id === reqId
          ? {
              ...log,
              status: 'error',
              error: errorMsg,
              response: error.response?.data
            }
          : log
      ))
      showError('Error', errorMsg)
      setLastResponse({ error: errorMsg })
    } finally {
      setLoading(false)
    }
  }

  // Note: Lint errors for reqId at old line numbers are now resolved after adding reqId definition above

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    success('Copied', 'Text copied to clipboard')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">API Tester</h1>
        <p className="text-muted-foreground">Test /api/checkcc endpoint with LoaiDV 1 (sender) and 2 (receiver)</p>
      </div>

      <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'sender' | 'receiver')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sender">
            📤 LoaiDV 1: Gửi Thẻ
          </TabsTrigger>
          <TabsTrigger value="receiver">
            📥 LoaiDV 2: Nhận Kết Quả
          </TabsTrigger>
        </TabsList>

        {/* Sender Tab */}
        <TabsContent value="sender" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📤 Gửi Dữ Liệu Thẻ (LoaiDV=1)
              </CardTitle>
              <CardDescription>
                Gửi dữ liệu thẻ tín dụng đến API bên ngoài
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* GATE Selector */}
              <div>
                <Label htmlFor="gateSelect">Chọn GATE</Label>
                <select
                  id="gateSelect"
                  value={selectedGate}
                  onChange={(e) => setSelectedGate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground mt-1"
                  disabled={gates.length === 0}
                >
                  {gates.length === 0 ? (
                    <option value="">Loading gates...</option>
                  ) : (
                    gates.map((gate) => (
                      <option key={gate.id} value={String(gate.typeCheck)}>
                        {gate.name} {gate.description ? `- ${gate.description}` : ''}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  TypeCheck value: {selectedGate}
                </p>
              </div>

              {/* Info */}
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Endpoint:</strong> {senderUrl || '/api/checkcc'}<br/>
                  <strong>Description:</strong> Lấy danh sách thẻ ngẫu nhiên từ database với LoaiDV=1
                </p>
              </div>

              {/* Amount field */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cardNumber">Số Thẻ</Label>
                  <Input
                    id="cardNumber"
                    placeholder="4532015112830366"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="cardMonth">Tháng</Label>
                    <Input
                      id="cardMonth"
                      placeholder="12"
                      value={cardMonth}
                      onChange={(e) => setCardMonth(e.target.value)}
                      maxLength={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardYear">Năm</Label>
                    <Input
                      id="cardYear"
                      placeholder="25"
                      value={cardYear}
                      onChange={(e) => setCardYear(e.target.value)}
                      maxLength={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardCvv">CVV</Label>
                    <Input
                      id="cardCvv"
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      maxLength={4}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSendCard}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Đang gửi...' : 'Gửi Thẻ'}
              </Button>

              {/* Request/Response Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Dữ Liệu Gửi Đi</Label>
                  <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded mt-1 text-xs font-mono overflow-auto max-h-32">
                    {JSON.stringify({
                      loaiDV: 1,
                      cardNumber: cardNumber.trim() || 'CARD_NUMBER',
                      cardMonth: cardMonth.trim() || 'MM',
                      cardYear: cardYear.trim() || 'YY',
                      cardCvv: cardCvv.trim() || 'CVV'
                    }, null, 2)}
                  </div>
                </div>
                <div>
                  <Label>Phản Hồi Mong Đợi</Label>
                  <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded mt-1 text-xs font-mono overflow-auto max-h-32">
                    {`{
  "success": true,
  "message": "Thẻ đã nhận",
  "data": {
    "requestId": "uuid",
    "cardLast4": "0366"
  }
}`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receiver Tab */}
        <TabsContent value="receiver" className="space-y-4">
          {/* Quick pick from Pending */}
          <Card>
            <CardHeader>
              <CardTitle>Chọn ID từ Pending</CardTitle>
              <CardDescription>Chọn nhanh một thẻ đã lấy ở LoaiDV=1 để cập nhật kết quả</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pendingSelect">Pending IDs</Label>
                  <select
                    id="pendingSelect"
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground mt-1"
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value)}
                    disabled={results.length === 0}
                  >
                    <option value="">-- Chọn ID --</option>
                    {results.map(r => (
                      <option key={String(r.Id)} value={String(r.Id)}>
                        #{String(r.Id)} - {r.FullThe}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="fromSelect">From</Label>
                  <select
                    id="fromSelect"
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground mt-1"
                    value={receiverFrom}
                    onChange={(e) => setReceiverFrom(e.target.value)}
                  >
                    <option value="1">Google</option>
                    <option value="2">WM</option>
                    <option value="3">Zenno</option>
                    <option value="4">777</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Theo apicheckcc.md: 1:Google, 2:WM, 3:Zenno, 4:777</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📥 Nhận Kết Quả (LoaiDV=2)
              </CardTitle>
              <CardDescription>
                Nhận kết quả kiểm tra từ người gửi bên ngoài
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manual Input Forms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="receiverId">ID <span className="text-red-500">*</span></Label>
                  <Input
                    id="receiverId"
                    placeholder="card_123456"
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ID của thẻ hoặc giao dịch
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="receiverStatus">Status <span className="text-red-500">*</span></Label>
                  <select
                    id="receiverStatus"
                    value={receiverStatus}
                    onChange={(e) => setReceiverStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground mt-1"
                  >
                    <option value="Live">Live</option>
                    <option value="Dead">Dead</option>
                    <option value="Unknown">Unknown</option>
                    <option value="Error">Error</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Trạng thái kiểm tra
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="receiverState">State</Label>
                  <Input
                    id="receiverState"
                    placeholder="Approved, Declined, etc."
                    value={receiverState}
                    onChange={(e) => setReceiverState(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Trạng thái chi tiết từ gateway
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="receiverFrom">From</Label>
                  <Input
                    id="receiverFrom"
                    placeholder="External API"
                    value={receiverFrom}
                    onChange={(e) => setReceiverFrom(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nguồn gửi kết quả
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="receiverMsg">Message</Label>
                <textarea
                  id="receiverMsg"
                  placeholder="Additional information or error message..."
                  value={receiverMsg}
                  onChange={(e) => setReceiverMsg(e.target.value)}
                  className="w-full h-20 p-2 border rounded text-sm mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Thông tin bổ sung hoặc thông báo lỗi
                </p>
              </div>

              <Button
                onClick={handleReceiveResult}
                disabled={loading || !receiverId.trim()}
                className="w-full"
              >
                {loading ? 'Đang xử lý...' : 'Gửi Kết Quả'}
              </Button>

              {/* Request Preview */}
              <div>
                <Label>Request Payload</Label>
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded mt-1 text-xs font-mono overflow-auto max-h-40">
                  {JSON.stringify({
                    LoaiDV: 2,
                    TypeCheck: parseInt(selectedGate) || 1,
                    Id: receiverId.trim() || 'ID',
                    Status: receiverStatus,
                    State: receiverState.trim() || '',
                    From: receiverFrom.trim() || 'External API',
                    Msg: receiverMsg.trim() || ''
                  }, null, 2)}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Kết quả (Realtime)</CardTitle>
            <CardDescription>Danh sách thẻ Pending từ LoaiDV=1 và cập nhật ngay khi POST LoaiDV=2</CardDescription>
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Đang tải danh sách pending...</div>
            ) : results.length === 0 ? (
              <div className="text-sm text-muted-foreground">Chưa có dữ liệu</div>
            ) : (
              <div className="space-y-2">
                {results.map((r) => (
                  <div key={String(r.Id)} className="flex items-center justify-between border rounded p-2">
                    <div className="text-sm">
                      <div className="font-medium">ID #{r.Id}</div>
                      <div className="text-muted-foreground">{r.FullThe}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={r.status === 'Pending' ? 'secondary' : r.status === 'Live' ? 'default' : r.status === 'Dead' ? 'destructive' : 'outline'}>
                        {r.status}
                      </Badge>
                      {r.msg && <div className="text-xs text-muted-foreground mt-1">{r.msg}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Inspector</CardTitle>
            <CardDescription>Hiển thị URL, Headers, Parameters, Payload và Response để debug</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">URL</div>
                <div className="text-xs bg-muted p-2 rounded break-all">{lastRequest?.url || (senderUrl || '/api/checkcc')}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm font-medium">Method</div>
                  <div className="text-xs bg-muted p-2 rounded">{lastRequest?.method || 'POST'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Encoding</div>
                  <div className="text-xs bg-muted p-2 rounded">utf-8</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Headers</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(lastRequest?.headers || buildHeadersPreview(), null, 2)}</pre>
              </div>
              <div>
                <div className="text-sm font-medium">Payload</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(lastRequest?.body || {}, null, 2)}</pre>
              </div>
              <div>
                <div className="text-sm font-medium">Response</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(lastResponse?.data || lastResponse?.error || {}, null, 2)}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lịch Sử Yêu Cầu</CardTitle>
            <CardDescription>Các yêu cầu API test gần đây</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
            disabled={logs.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Xóa
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chưa có lịch sử. Gửi yêu cầu để xem kết quả.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.type === 'sender' ? 'default' : 'secondary'}>
                        {log.type === 'sender' ? 'GỬI' : 'NHẬN'}
                      </Badge>
                      <Badge variant={
                        log.status === 'success' ? 'default' :
                        log.status === 'error' ? 'destructive' :
                        'outline'
                      }>
                        {log.status === 'success' ? 'Thành công' : log.status === 'error' ? 'Lỗi' : 'Đang xử lý'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(log, null, 2))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {log.payload && (
                    <div>
                      <p className="text-xs font-semibold">Request:</p>
                      <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs font-mono overflow-auto max-h-20">
                        {JSON.stringify(log.payload, null, 2)}
                      </div>
                    </div>
                  )}
                  
                  {log.response && (
                    <div>
                      <p className="text-xs font-semibold">Response:</p>
                      <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs font-mono overflow-auto max-h-20">
                        {JSON.stringify(log.response, null, 2)}
                      </div>
                    </div>
                  )}
                  
                  {log.error && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-xs text-red-600 dark:text-red-400">
                      Error: {log.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
