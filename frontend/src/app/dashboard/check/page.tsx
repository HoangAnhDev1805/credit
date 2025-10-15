'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/components/I18nProvider'
import { validateCardNumber, getCardBrand, maskCardNumber, parseCSV, copyToClipboard } from '@/lib/utils'
import { 
  CreditCard, 
  Upload, 
  Download, 
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  FileText
} from 'lucide-react'
import Link from 'next/link'

interface CardResult {
  cardNumber: string
  expiryMonth: string
  expiryYear: string
  cvv: string
  status: 'live' | 'dead' | 'error' | 'pending'
  message?: string
  brand: string
}

export default function CheckCardsPage() {
  const router = useRouter()
  const { user, isAuthenticated, checkAuth } = useAuthStore()
  const { toast } = useToast()
  const { t } = useI18n()
  
  const [cardsInput, setCardsInput] = useState('')
  const [checkType, setCheckType] = useState(1) // 1: CheckLive, 2: CheckCharge
  const [isChecking, setIsChecking] = useState(false)
  const [results, setResults] = useState<CardResult[]>([])
  const [stats, setStats] = useState({
    total: 0,
    live: 0,
    dead: 0,
    error: 0
  })

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  const parseCards = (input: string) => {
    const lines = input.trim().split('\n')
    const cards = []
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      const parts = line.trim().split('|')
      if (parts.length >= 4) {
        const [cardNumber, expiryMonth, expiryYear, cvv] = parts
        if (validateCardNumber(cardNumber)) {
          cards.push({
            cardNumber: cardNumber.replace(/\D/g, ''),
            expiryMonth: expiryMonth.padStart(2, '0'),
            expiryYear: expiryYear,
            cvv: cvv
          })
        }
      }
    }
    
    return cards
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setCardsInput(content)
    }
    reader.readAsText(file)
  }

  const handleCheck = async () => {
    if (!cardsInput.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập danh sách thẻ",
        variant: "destructive"
      })
      return
    }

    const cards = parseCards(cardsInput)
    if (cards.length === 0) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy thẻ hợp lệ nào",
        variant: "destructive"
      })
      return
    }

    setIsChecking(true)
    setResults([])
    
    try {
      const response = await apiClient.checkCards({
        cards,
        checkType
      })
      
      if (response.success && response.data) {
        const cardResults = response.data.results || []
        setResults(cardResults)
        
        // Calculate stats
        const newStats = {
          total: cardResults.length,
          live: cardResults.filter((r: CardResult) => r.status === 'live').length,
          dead: cardResults.filter((r: CardResult) => r.status === 'dead').length,
          error: cardResults.filter((r: CardResult) => r.status === 'error').length
        }
        setStats(newStats)
        
        toast({
          title: "Thành công",
          description: `Đã kiểm tra ${cardResults.length} thẻ`
        })
      }
    } catch (error: any) {
      toast({
        title: "Lỗi kiểm tra",
        description: error.response?.data?.message || "Có lỗi xảy ra khi kiểm tra thẻ",
        variant: "destructive"
      })
    } finally {
      setIsChecking(false)
    }
  }

  const exportResults = () => {
    if (results.length === 0) return
    
    const csv = results.map(result => 
      `${result.cardNumber}|${result.expiryMonth}|${result.expiryYear}|${result.cvv}|${result.status}|${result.message || ''}`
    ).join('\n')
    
    const blob = new Blob([csv], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `card_check_results_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const copyResult = async (result: CardResult) => {
    const text = `${result.cardNumber}|${result.expiryMonth}|${result.expiryYear}|${result.cvv}`
    const success = await copyToClipboard(text)
    
    if (success) {
      toast({
        title: "Đã sao chép",
        description: "Thông tin thẻ đã được sao chép"
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'dead':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="status-live">Live</Badge>
      case 'dead':
        return <Badge className="status-dead">Dead</Badge>
      case 'error':
        return <Badge className="status-error">Error</Badge>
      default:
        return <Badge className="status-pending">Pending</Badge>
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">Kiểm tra thẻ tín dụng</h1>
                <p className="text-sm text-muted-foreground">
                  Kiểm tra tính hợp lệ và trạng thái của thẻ
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                Số dư: ${user.balance}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Nhập danh sách thẻ</CardTitle>
                <CardDescription>
                  Nhập thẻ theo định dạng: số_thẻ|tháng|năm|cvv (mỗi thẻ một dòng)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Loại kiểm tra</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value={1}
                        checked={checkType === 1}
                        onChange={(e) => setCheckType(Number(e.target.value))}
                        disabled={isChecking}
                      />
                      <span>Check Live</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value={2}
                        checked={checkType === 2}
                        onChange={(e) => setCheckType(Number(e.target.value))}
                        disabled={isChecking}
                      />
                      <span>Check Charge</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Danh sách thẻ</label>
                  <textarea
                    className="w-full h-40 p-3 border rounded-md resize-none font-mono text-sm"
                    placeholder="4532123456789012|12|25|123&#10;5555123456789012|01|26|456&#10;..."
                    value={cardsInput}
                    onChange={(e) => setCardsInput(e.target.value)}
                    disabled={isChecking}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={handleCheck}
                    disabled={isChecking || !cardsInput.trim()}
                    className="flex-1"
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang kiểm tra...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Kiểm tra thẻ
                      </>
                    )}
                  </Button>
                  
                  <label htmlFor="file-upload">
                    <Button variant="outline" asChild disabled={isChecking}>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </span>
                    </Button>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isChecking}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Example Format */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Định dạng mẫu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-md font-mono text-sm">
                  4532123456789012|12|25|123<br/>
                  5555123456789012|01|26|456<br/>
                  4111111111111111|03|27|789
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Stats */}
            {results.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Tổng</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.live}</div>
                    <div className="text-xs text-muted-foreground">Live</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.dead}</div>
                    <div className="text-xs text-muted-foreground">Dead</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{stats.error}</div>
                    <div className="text-xs text-muted-foreground">Error</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Kết quả kiểm tra</CardTitle>
                  {results.length > 0 && (
                    <Button variant="outline" size="sm" onClick={exportResults}>
                      <Download className="mr-2 h-4 w-4" />
                      Xuất file
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Chưa có kết quả kiểm tra</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(result.status)}
                          <div>
                            <div className="font-mono text-sm">
                              {maskCardNumber(result.cardNumber)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.expiryMonth}/{result.expiryYear} • {result.cvv}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(result.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyResult(result)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
