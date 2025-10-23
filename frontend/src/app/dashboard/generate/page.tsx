'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/components/I18nProvider'
import {
  CreditCard,
  Download,
  Copy,
  Loader2,
  Shuffle,
  FileText,
  Trash2,
  Zap
} from 'lucide-react'

interface GeneratedCard {
  cardNumber: string
  expiryMonth: string
  expiryYear: string
  cvv: string
  fullCard: string
  brand: string
  bin: string
}

export default function GenerateCardsPage() {
  const router = useRouter()
  const { user, isAuthenticated, checkAuth } = useAuthStore()
  const { toast } = useToast()
  const { t } = useI18n()

  const [formData, setFormData] = useState({
    bin: '',
    quantity: 10,
    month: 'random',
    year: 'random',
    brand: ''
  })

  // Card brand presets with common BINs
  const cardBrands = [
    { name: 'Visa', bin: '457173', icon: '💳' },
    { name: 'MasterCard', bin: '555555', icon: '💳' },
    { name: 'Amex', bin: '378282', icon: '💳' },
    { name: 'Discover', bin: '601111', icon: '💳' }
  ]
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([])
  const [stats, setStats] = useState({
    totalGenerated: 0,
    brands: new Set<string>(),
    format: 'XXXXXXXXXXXXXXXX|MM|YYYY|CVV'
  })

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  const validateBin = (bin: string): boolean => {
    return /^\d{6,8}$/.test(bin)
  }

  const getCardBrand = (bin: string): string => {
    const firstDigit = bin.charAt(0)
    const firstTwo = bin.substring(0, 2)

    if (firstDigit === '4') return 'Visa'
    if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'Mastercard'
    if (['34', '37'].includes(firstTwo)) return 'American Express'
    if (firstTwo === '60') return 'Discover'
    return 'Unknown'
  }

  const generateLuhnChecksum = (cardNumber: string): string => {
    const digits = cardNumber.split('').map(Number)
    let sum = 0

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i]
      if ((digits.length - i) % 2 === 0) {
        digit *= 2
        if (digit > 9) digit -= 9
      }
      sum += digit
    }

    return ((10 - (sum % 10)) % 10).toString()
  }

  const handleGenerate = async () => {
    if (!formData.bin || !validateBin(formData.bin)) {
      toast({
        title: t('common.error'),
        description: t('generator.messages.invalidBin'),
        variant: "destructive"
      })
      return
    }

    if (formData.quantity < 1 || formData.quantity > 1000) {
      toast({
        title: t('common.error'),
        description: 'Số lượng phải từ 1 đến 1000 thẻ',
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)

    try {
      // Real API call to generate cards
      const response = await fetch('/api/cards/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          bin: formData.bin,
          quantity: formData.quantity,
          month: formData.month === 'random' ? undefined : formData.month,
          year: formData.year === 'random' ? undefined : formData.year
        })
      })

      if (response.ok) {
        const responseData = await response.json()
        
        // Backend returns { success: true, data: { cards: [...], count: number } }
        const cards = responseData.data?.cards || responseData.cards || responseData.data || []
        
        if (!Array.isArray(cards)) {
          throw new Error('Invalid cards format')
        }
        
        if (cards.length === 0) {
          throw new Error('No cards generated')
        }
        
        setGeneratedCards(cards)

        // Update stats
        const brands = new Set(cards.map((card: any) => card.brand || card.cardBrand || 'Unknown')) as Set<string>
        setStats({
          totalGenerated: cards.length,
          brands,
          format: 'XXXXXXXXXXXXXXXX|MM|YYYY|CVV'
        })

        toast({
          title: t('common.success'),
          description: `Successfully generated ${cards.length} cards`
        })
      } else {
        const errData = await response.json().catch(() => ({}))
        console.error('API error:', response.status, errData)
        throw new Error(errData.message || `API error: ${response.status}`)
      }
    } catch (error: any) {
      // Fallback to client-side generation if API fails
      console.warn('API generation failed, using client-side fallback:', error)
      const cards: GeneratedCard[] = []
      const brands = new Set<string>()

      for (let i = 0; i < formData.quantity; i++) {
        // Generate card number
        let cardNumber = formData.bin
        while (cardNumber.length < 15) {
          cardNumber += Math.floor(Math.random() * 10).toString()
        }
        cardNumber += generateLuhnChecksum(cardNumber)

        // Generate expiry
        const month = formData.month === 'random'
          ? String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
          : formData.month
        const year = formData.year === 'random'
          ? String(new Date().getFullYear() + Math.floor(Math.random() * 5) + 1)
          : formData.year

        // Generate CVV
        const cvv = Math.floor(Math.random() * 900 + 100).toString()

        // Use selected brand or detect from BIN
        const brand = formData.brand || getCardBrand(formData.bin)
        brands.add(brand)

        const card: GeneratedCard = {
          cardNumber,
          expiryMonth: month,
          expiryYear: year,
          cvv,
          fullCard: `${cardNumber}|${month}|${year}|${cvv}`,
          brand,
          bin: formData.bin
        }

        cards.push(card)
      }

      setGeneratedCards(cards)
      setStats({
        totalGenerated: cards.length,
        brands,
        format: 'XXXXXXXXXXXXXXXX|MM|YYYY|CVV'
      })

      toast({
        title: t('common.success'),
        description: t('generator.messages.generationComplete')
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'quantity') {
      const qty = parseInt(value) || 10
      setFormData(prev => ({
        ...prev,
        quantity: Math.max(1, Math.min(1000, qty))
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleClear = () => {
    setGeneratedCards([])
    setStats({
      totalGenerated: 0,
      brands: new Set<string>(),
      format: 'XXXXXXXXXXXXXXXX|MM|YYYY|CVV'
    })
  }

  const copyCard = async (card: GeneratedCard) => {
    try {
      await navigator.clipboard.writeText(card.fullCard)
      toast({
        title: t('common.success'),
        description: t('generator.messages.copied')
      })
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Failed to copy card',
        variant: "destructive"
      })
    }
  }

  const copyAllCards = async () => {
    if (generatedCards.length === 0) {
      toast({
        title: t('common.error'),
        description: t('generator.messages.noCards'),
        variant: "destructive"
      })
      return
    }

    const allCards = generatedCards.map(card => card.fullCard).join('\n')
    try {
      await navigator.clipboard.writeText(allCards)
      toast({
        title: t('common.success'),
        description: t('generator.messages.copied')
      })
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Failed to copy cards',
        variant: "destructive"
      })
    }
  }

  const downloadCards = () => {
    if (generatedCards.length === 0) {
      toast({
        title: t('common.error'),
        description: t('generator.messages.noCards'),
        variant: "destructive"
      })
      return
    }

    const content = generatedCards.map(card => card.fullCard).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `generated-cards-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: t('common.success'),
      description: t('generator.messages.downloaded')
    })
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          {t('generate.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('generate.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>{t('generate.title')}</span>
              </CardTitle>
              <CardDescription>
                {t('generate.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* BIN Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('generate.binLabel')}</label>
                <div className="flex space-x-2">
                  <Input
                    name="bin"
                    placeholder={t('generate.binPlaceholder')}
                    value={formData.bin}
                    onChange={handleChange}
                    maxLength={8}
                    disabled={isGenerating}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const bins = ['424242', '453173', '555555', '411111', '378282', '371449']
                      const randomBin = bins[Math.floor(Math.random() * bins.length)]
                      setFormData(prev => ({ ...prev, bin: randomBin }))
                    }}
                    disabled={isGenerating}
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Quick Select Card Brands */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quick Select Card Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {cardBrands.map((brand) => (
                    <Button
                      key={brand.name}
                      type="button"
                      variant={formData.bin === brand.bin ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, bin: brand.bin, brand: brand.name }))}
                      disabled={isGenerating}
                      className="flex flex-col items-center justify-center h-auto py-3"
                    >
                      <span className="text-2xl mb-1">{brand.icon}</span>
                      <span className="text-xs">{brand.name}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  BIN presets: Visa (457173), MasterCard (555555), Amex (378282), Discover (601111)
                </p>
              </div>

              {/* Quantity Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('generate.quantityLabel')}</label>
                <Input
                  name="quantity"
                  type="number"
                  placeholder="10"
                  value={formData.quantity}
                  onChange={handleChange}
                  min={1}
                  max={1000}
                  disabled={isGenerating}
                />
              </div>

              {/* Month Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('generate.monthLabel')}</label>
                <Select
                  value={formData.month}
                  onValueChange={(value) => handleSelectChange('month', value)}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">{t('generate.randomOption')}</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('generate.yearLabel')}</label>
                <Select
                  value={formData.year}
                  onValueChange={(value) => handleSelectChange('year', value)}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">{t('generate.randomOption')}</SelectItem>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() + i
                      return (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !formData.bin}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('generate.generateButton')}...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {t('generate.generateButton')}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={isGenerating || generatedCards.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('generate.clearButton')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {generatedCards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Generated Cards ({generatedCards.length})</span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyAllCards}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      {t('generator.form.copyButton')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadCards}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {t('generator.form.downloadButton')}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {generatedCards.map((card, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg font-mono text-sm"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{card.brand}</Badge>
                          <span>{card.fullCard}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCard(card)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{t('generator.stats.generated')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <div className="text-3xl font-bold text-primary">{stats.totalGenerated}</div>
                <div className="text-sm text-muted-foreground">Cards Generated</div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('generator.stats.brands')}</span>
                  <span className="font-medium">{stats.brands.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('generator.stats.format')}</span>
                  <span className="font-medium text-xs">{stats.format}</span>
                </div>
              </div>

              {stats.brands.size > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Card Brands</h4>
                  <div className="space-y-2">
                    {Array.from(stats.brands).map((brand) => (
                      <div key={brand} className="flex items-center justify-between">
                        <Badge variant="outline">{brand}</Badge>
                        <span className="text-sm">
                          {generatedCards.filter(card => card.brand === brand).length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>• Cards are generated using Luhn algorithm</div>
              <div>• Format: XXXXXXXXXXXXXXXX|MM|YYYY|CVV</div>
              <div>• For testing purposes only</div>
              <div>• Maximum 100 cards per generation</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

