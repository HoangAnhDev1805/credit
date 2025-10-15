'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/components/I18nProvider'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/lib/auth'
import {
  CreditCard,
  DollarSign,
  Zap,
  CheckCircle,
  Clock,
  Star,
  Gift,
  TrendingUp,
  Shield,
  Loader2,
  Building,
  Wallet
} from 'lucide-react'


interface CreditPackage {
  id: string
  credits: number
  price: number
  bonus: number
  popular: boolean
  savings: string
}

interface Transaction {
  id: string
  amount: number
  credits: number
  method: string
  status: 'pending' | 'completed' | 'failed'
  date: string
}

import { SharedModal } from '@/components/shared/Modal'
import { apiClient, PaymentMethod as ApiPaymentMethod } from '@/lib/api'

export default function BuyCreditsPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { user } = useAuthStore()

  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [requests, setRequests] = useState<any[]>([])
  const [methods, setMethods] = useState<ApiPaymentMethod[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [countdown, setCountdown] = useState(600)
  const [creatingRequest, setCreatingRequest] = useState(false)
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([])
  const [conversionRate, setConversionRate] = useState(10)

  useEffect(() => {
    loadMethods()
    loadRequests()
    fetchCreditPackages()
  }, [])



  // Fetch credit packages from unified API
  const fetchCreditPackages = async () => {
    try {
      // Use unified credit packages API
      const response = await apiClient.getCreditPackages()
      if (response.success && response.data) {
        const { packages, creditPerUsd } = response.data

        // Set conversion rate
        setConversionRate(creditPerUsd || 10)

        if (packages && Array.isArray(packages)) {
          // Use packages from unified API
          const creditPackages: CreditPackage[] = packages.map((pkg: any) => ({
            id: pkg.id.toString(),
            credits: pkg.credits,
            price: pkg.price,
            bonus: pkg.bonus || 0,
            popular: pkg.popular || false,
            savings: pkg.savings || ''
          }))
          setCreditPackages(creditPackages)
        } else {
          // Fallback: create packages based on conversion rate
          const rate = creditPerUsd || conversionRate
          const packages: CreditPackage[] = [
            {
              id: '1',
              credits: 100,
              price: Math.round(100 / rate),
              bonus: 0,
              popular: false,
              savings: ''
            },
            {
              id: '2',
              credits: 500,
              price: Math.round(500 / rate * 0.9), // 10% discount
              bonus: 50,
              popular: true,
              savings: '10% off'
            },
            {
              id: '3',
              credits: 1000,
              price: Math.round(1000 / rate * 0.8), // 20% discount
              bonus: 200,
              popular: false,
              savings: '20% off'
            },
            {
              id: '4',
              credits: 5000,
              price: Math.round(5000 / rate * 0.7), // 30% discount
              bonus: 1000,
              popular: false,
              savings: '30% off'
            }
          ]
          setCreditPackages(packages)
        }
      }
    } catch (error) {
      console.error('Failed to fetch credit packages:', error)
      // Fallback to default packages
      setCreditPackages([
        { id: '1', credits: 100, price: 10, bonus: 0, popular: false, savings: '' },
        { id: '2', credits: 500, price: 45, bonus: 50, popular: true, savings: '10% off' },
        { id: '3', credits: 1000, price: 80, bonus: 200, popular: false, savings: '20% off' },
        { id: '4', credits: 5000, price: 350, bonus: 1000, popular: false, savings: '30% off' }
      ])
    }
  }

  const loadMethods = async () => {
    try {
      setLoadingMethods(true)
      const res = await apiClient.getPaymentMethods()
      setMethods(res?.data?.methods || [])
    } catch (error) {
      console.error('Failed to load methods:', error)
    } finally {
      setLoadingMethods(false)
    }
  }

  const loadRequests = async () => {
    try {
      const res = await apiClient.getPaymentRequests({ limit: 10 })
      setRequests(res?.data?.requests || [])
    } catch (error) {
      console.error('Failed to load requests:', error)
    }
  }

  const handlePurchase = async () => {
    if (!selectedPackage || !selectedMethod) {
      toast({
        title: t('common.error'),
        description: 'Vui l\u00f2ng ch\u1ecdn g\u00f3i v\u00e0 ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n',
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      setPaymentModalOpen(true)
      setCountdown(600)
    } finally {
      setIsProcessing(false)
    }
  }
  useEffect(() => {
    if (!paymentModalOpen) return
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [paymentModalOpen])

  const handleConfirmTransfer = async () => {
    if (!selectedPackage || !selectedMethod) return
    const pkg = creditPackages.find(p => p.id === selectedPackage)
    if (!pkg) return
    setCreatingRequest(true)
    try {
      await apiClient.createPaymentRequest({
        paymentMethodId: selectedMethod,
        amount: pkg.price,
        notes: `Mua ${pkg.credits} credits`
      })
      toast({ title: t('common.success'), description: t('buyCredits.modal.waitingApproval') })
      setPaymentModalOpen(false)
      loadRequests()
    } catch (error) {
      toast({ title: t('common.error'), description: t('common.error'), variant: 'destructive' })
    } finally {
      setCreatingRequest(false)
    }
  }


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'rejected':
        return <CheckCircle className="h-4 w-4 text-red-600" />
      case 'cancelled':
        return <Clock className="h-4 w-4 text-gray-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-primary" />
          {t('buyCredits.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('buyCredits.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Packages & Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('buyCredits.currentBalance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {user?.balance || 0} Credits
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Available for card checking and generation
              </p>
            </CardContent>
          </Card>

          {/* Credit Packages */}
          <Card>
            <CardHeader>
              <CardTitle>Choose Credit Package</CardTitle>
              <CardDescription>
                Select the number of credits you want to purchase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {creditPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`relative p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedPackage === pkg.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    } ${pkg.popular ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedPackage(pkg.id)}
                  >
                    {pkg.popular && (
                      <Badge className="absolute -top-2 left-4 bg-primary">
                        <Star className="h-3 w-3 mr-1" />
                        Most Popular
                      </Badge>
                    )}

                    <div className="text-center">
                      <div className="text-2xl font-bold">{pkg.credits.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Credits</div>

                      {pkg.bonus > 0 && (
                        <div className="flex items-center justify-center mt-2">
                          <Gift className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-sm text-green-600">+{pkg.bonus} Bonus</span>
                        </div>
                      )}

                      <div className="mt-3">
                        <div className="text-xl font-bold">${pkg.price}</div>
                        {pkg.savings && (
                          <div className="text-sm text-green-600">{pkg.savings}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>{t('buyCredits.methodsTitle')}</CardTitle>
              <CardDescription>
                {t('buyCredits.methodsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {methods.map((method) => (
                  <div
                    key={method.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedMethod === method.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedMethod(method.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {method.type === 'bank_transfer' ? (
                          <Building className="h-5 w-5" />
                        ) : method.type === 'e_wallet' ? (
                          <Wallet className="h-5 w-5" />
                        ) : (
                          <CreditCard className="h-5 w-5" />
                        )}
                        <div>
                          <div className="font-medium">{method.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {method.bankName ? `${method.bankName} • ${method.accountName}` : method.type}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {typeof method.fee !== 'undefined' && (
                          <div>Fee: {method.feeType === 'percentage' ? `${method.fee}%` : `$${method.fee}`}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handlePurchase}
                disabled={!selectedPackage || !selectedMethod || isProcessing}
                className="w-full mt-6"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('buyCredits.processing')}
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    {t('buyCredits.securePurchase')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Transaction History */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Your recent credit purchases
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.slice(0, 10).map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(req.status)}
                        <div>
                          <div className="font-medium">${req.amount} • {req.paymentMethod?.name || ''}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(req.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground capitalize">
                          {req.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('buyCredits.transactionHistory.empty')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <SharedModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={t('buyCredits.modal.title')}
        size="lg"
        footer={(
          <>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              {t('buyCredits.modal.cancel')}
            </Button>
            <Button onClick={handleConfirmTransfer} disabled={creatingRequest || countdown === 0}>
              {creatingRequest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('buyCredits.modal.sending')}
                </>
              ) : (
                <>{t('buyCredits.modal.confirm')}</>
              )}
            </Button>
          </>
        )}
      >
        {(() => {
          const pkg = creditPackages.find(p => p.id === selectedPackage)
          const method = methods.find(m => m.id === selectedMethod)
          const mins = Math.floor(countdown / 60)
          const secs = (countdown % 60).toString().padStart(2, '0')
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t('buyCredits.modal.timeLeft')}</div>
                <div className="text-lg font-semibold">{mins}:{secs}</div>
              </div>
              {method && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="font-medium">{method.name}</div>
                    {method.bankName && (
                      <div className="text-sm">{t('buyCredits.modal.bankName')}: {method.bankName}</div>
                    )}
                    <div className="text-sm">{t('buyCredits.modal.accountName')}: {method.accountName}</div>
                    <div className="text-sm">{t('buyCredits.modal.accountNumber')}: {method.accountNumber}</div>
                    {pkg && (
                      <div className="text-sm">{t('buyCredits.modal.amount')}: ${pkg.price}</div>
                    )}
                    {method.instructions && (
                      <div className="text-sm whitespace-pre-wrap">{t('buyCredits.modal.instructions')}: {method.instructions}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    {(method as any).qrCode ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(method as any).qrCode} alt="QR Code" className="max-h-64 rounded border" />
                    ) : (
                      <div className="text-sm text-muted-foreground">{t('buyCredits.modal.noQR')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </SharedModal>
    </div>
  )
}
