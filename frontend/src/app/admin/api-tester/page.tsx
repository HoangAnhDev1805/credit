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
import { Send, Copy, Trash2, Info } from 'lucide-react'

interface TestRequest {
  id: string
  timestamp: string
  type: 'sender' | 'receiver'
  payload: any
  response: any
  status: 'pending' | 'success' | 'error'
  error?: string
}

export default function ApiTesterPage() {
  const { success, error: showError } = useToast()
  const [activeMode, setActiveMode] = useState<'sender' | 'receiver' | 'crypto'>('sender')
  const [logs, setLogs] = useState<TestRequest[]>([])
  const [loading, setLoading] = useState(false)
  
  // Sender fields (LoaiDV=1)
  const [senderUrl, setSenderUrl] = useState('https://checkcc.live/api/checkcc')
  const [cardNumber, setCardNumber] = useState('4532015112830366')
  const [cardMonth, setCardMonth] = useState('12')
  const [cardYear, setCardYear] = useState('25')
  const [cardCvv, setCardCvv] = useState('123')
  
  // Receiver fields (LoaiDV=2)
  const [receiverUrl, setReceiverUrl] = useState('')
  const [receiverResponse, setReceiverResponse] = useState('')

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
  }, [])

  const addLog = (req: TestRequest) => {
    setLogs(prev => [req, ...prev])
  }

  const clearLogs = () => {
    setLogs([])
    success('Logs cleared')
  }

  // LoaiDV=1: Send card to external API
  const handleSendCard = async () => {
    if (!senderUrl.trim()) {
      showError('Error', 'Please enter receiver API URL')
      return
    }

    const reqId = Date.now().toString()
    const payload = {
      loaiDV: 1,
      cardNumber: cardNumber.trim(),
      cardMonth: cardMonth.trim(),
      cardYear: cardYear.trim(),
      cardCvv: cardCvv.trim()
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
      // Send as POST to the configured receiver URL
      const response = await fetch(senderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      
      setLogs(prev => prev.map(log =>
        log.id === reqId
          ? {
              ...log,
              response: data,
              status: response.ok ? 'success' : 'error',
              error: response.ok ? undefined : data.message || 'Request failed'
            }
          : log
      ))

      if (response.ok) {
        success('Success', 'Card sent successfully')
      } else {
        showError('Error', data.message || 'Failed to send card')
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
    } finally {
      setLoading(false)
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
    const reqId = Date.now().toString()
    const payload = {
      loaiDV: 2,
      result: receiverResponse.trim()
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
      // Send result to local backend
      const response = await apiClient.post('/checkcc/receive-result', payload)

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
      setReceiverResponse('')
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
    } finally {
      setLoading(false)
    }
  }

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

      <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'sender' | 'receiver' | 'crypto')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sender">
            📤 LoaiDV 1: Gửi Thẻ
          </TabsTrigger>
          <TabsTrigger value="receiver">
            📥 LoaiDV 2: Nhận Kết Quả
          </TabsTrigger>
          <TabsTrigger value="crypto">
            💰 Test CryptAPI
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
              {/* Receiver URL */}
              <div>
                <Label htmlFor="senderUrl">URL API Nhận Thẻ</Label>
                <Input
                  id="senderUrl"
                  placeholder="https://checkcc.live/api/checkcc"
                  value={senderUrl}
                  onChange={(e) => setSenderUrl(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  API bên ngoài sẽ nhận dữ liệu thẻ
                </p>
              </div>

              {/* Card Info */}
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

        {/* Crypto Tab */}
        <TabsContent value="crypto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                💰 Kiểm Tra CryptAPI
              </CardTitle>
              <CardDescription>
                Kiểm tra phương thức thanh toán crypto và CryptAPI integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method */}
                <div>
                  <Label htmlFor="cryptoMethod">Phương Thức <span className="text-red-500">*</span></Label>
                  <select
                    id="cryptoMethod"
                    value={cryptoMethod}
                    onChange={(e) => setCryptoMethod(e.target.value)}
                    className="w-full mt-1 p-2 border rounded text-sm"
                  >
                    <option value="GET_BALANCE">GET_BALANCE - Lấy số dư ví</option>
                    <option value="CREATE_PAYMENT">CREATE_PAYMENT - Tạo yêu cầu thanh toán</option>
                    <option value="GET_PAYMENT">GET_PAYMENT - Lấy trạng thái thanh toán</option>
                    <option value="ESTIMATE_PRICE">ESTIMATE_PRICE - Ước tính giá</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Chọn phương thức API cần kiểm tra
                  </p>
                </div>

                {/* Address */}
                <div>
                  <Label htmlFor="cryptoAddress">Địa Chỉ Ví / Order ID <span className="text-red-500">*</span></Label>
                  <Input
                    id="cryptoAddress"
                    placeholder="0x1234567890123456789012345678901234567890"
                    value={cryptoAddress}
                    onChange={(e) => setCryptoAddress(e.target.value)}
                    className="mt-1 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Địa chỉ ví hoặc Order ID tùy theo phương thức
                  </p>
                </div>
              </div>

              {/* Amount (for CREATE_PAYMENT) */}
              {cryptoMethod === 'CREATE_PAYMENT' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cryptoAmount">Số Tiền (USD)</Label>
                    <Input
                      id="cryptoAmount"
                      type="number"
                      placeholder="100.00"
                      step="0.01"
                      min="0"
                      value={cryptoAmount}
                      onChange={(e) => setCryptoAmount(e.target.value)}
                      className="mt-1 text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Số tiền cần thanh toán
                    </p>
                  </div>
                </div>
              )}

              {/* Method Info Box */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  <Info className="h-3 w-3 inline mr-1" />
                  Thông Tin Phương Thức
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  {cryptoMethod === 'GET_BALANCE' && 'Lấy số dư hiện tại của ví từ CryptAPI'}
                  {cryptoMethod === 'CREATE_PAYMENT' && 'Tạo yêu cầu thanh toán mới với số tiền USD'}
                  {cryptoMethod === 'GET_PAYMENT' && 'Kiểm tra trạng thái của đơn thanh toán theo Order ID'}
                  {cryptoMethod === 'ESTIMATE_PRICE' && 'Ước tính giá chuyển đổi từ crypto sang USD'}
                </p>
              </div>

              <Button
                onClick={handleTestCryptoAPI}
                disabled={loading || !cryptoAddress.trim()}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    🚀 Kiểm Tra API
                  </>
                )}
              </Button>

              {/* Request Preview */}
              <div>
                <Label>Request Payload</Label>
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded mt-1 text-xs font-mono overflow-auto max-h-32">
                  {JSON.stringify(
                    {
                      method: cryptoMethod,
                      address: cryptoAddress.trim() || 'WALLET_ADDRESS',
                      ...(cryptoMethod === 'CREATE_PAYMENT' && cryptoAmount ? { amount: parseFloat(cryptoAmount) } : {})
                    },
                    null,
                    2
                  )}
                </div>
              </div>

              {/* Response */}
              <div>
                <Label>Phản Hồi API</Label>
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded mt-1 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap break-words border border-gray-300 dark:border-gray-700">
                  {cryptoResponse || 'Chưa có phản hồi. Gửi yêu cầu để xem kết quả.'}
                </div>
                {cryptoResponse && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(cryptoResponse)}
                    className="mt-2"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Sao chép
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
                {/* Receiver Tab */}
        <TabsContent value="receiver" className="space-y-4">
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
              <div>
                <Label htmlFor="receiverResponse">JSON Kết Quả</Label>
                <textarea
                  id="receiverResponse"
                  placeholder='{"checkResult": "LIVE", "balance": "500"}' 
                  value={receiverResponse}
                  onChange={(e) => setReceiverResponse(e.target.value)}
                  className="w-full h-32 p-2 border rounded font-mono text-sm mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Dán kết quả JSON nhận được từ người gửi bên ngoài
                </p>
              </div>

              <Button
                onClick={handleReceiveResult}
                disabled={loading || !receiverResponse.trim()}
                className="w-full"
              >
                {loading ? 'Đang xử lý...' : 'Nhận Kết Quả'}
              </Button>

              {/* Request/Response Preview */}
              <div>
                <Label>Request Payload</Label>
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded mt-1 text-xs font-mono overflow-auto max-h-40">
                  {JSON.stringify({
                    loaiDV: 2,
                    result: receiverResponse.trim() ? JSON.parse(receiverResponse || '{}') : 'RESULT_OBJECT'
                  }, null, 2).replace(/RESULT_OBJECT/g, receiverResponse || 'RESULT_OBJECT')}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
