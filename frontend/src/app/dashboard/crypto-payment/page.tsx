'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/components/I18nProvider'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/lib/auth'
import { apiClient } from '@/lib/api'
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
  Wallet,
  Copy,
  QrCode,
  Bitcoin,
  Coins,
  ArrowRight,
  RefreshCw
} from 'lucide-react'

interface PaymentData {
  paymentRequestId: string;
  orderId: string;
  coin: string;
  amount: number;
  address_in: string;
  minimum_transaction_coin: number;
  qr_code_base64?: string;
  payment_uri?: string;
  expiresAt: string;
  instructions: string;
}

interface SupportedCoins {
  [key: string]: {
    name: string;
    logo: string;
    minimum_transaction: number;
  };
}

const cryptoOptions = [
  { value: 'btc', label: 'Bitcoin (BTC)', icon: Bitcoin, color: 'text-orange-500' },
  { value: 'ltc', label: 'Litecoin (LTC)', icon: Coins, color: 'text-gray-500' },
  { value: 'eth', label: 'Ethereum (ETH)', icon: Coins, color: 'text-blue-500' },
  { value: 'trc20/usdt', label: 'USDT (TRC20)', icon: DollarSign, color: 'text-green-500' },
  { value: 'bep20/usdt', label: 'USDT (BEP20)', icon: DollarSign, color: 'text-green-500' },
  { value: 'erc20/usdt', label: 'USDT (ERC20)', icon: DollarSign, color: 'text-green-600' },
  { value: 'sol/sol', label: 'Solana (SOL)', icon: Zap, color: 'text-purple-500' },
  { value: 'polygon/pol', label: 'Polygon (POL)', icon: Shield, color: 'text-indigo-500' },
];

export default function CryptoPaymentPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { user } = useAuthStore()

  const [creditPackages, setCreditPackages] = useState<any[]>([])
  const [conversionRate, setConversionRate] = useState(10)
  const [selectedPackage, setSelectedPackage] = useState<any>(null)
  const [selectedCoin, setSelectedCoin] = useState('btc')
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [enabledCoins, setEnabledCoins] = useState<Record<string, boolean> | null>(null)
  const [cryptoUsdPrices, setCryptoUsdPrices] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    // Set token first, wait a bit for it to settle, then load config
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    if (token) {
      apiClient.setToken(token)
      console.log('[CryptoPayment] Token set from localStorage:', token.substring(0, 20) + '...')
    } else {
      console.warn('[CryptoPayment] No token found in localStorage')
    }

    // Load configuration including enabled coins and packages
    const loadConfig = async () => {
      try {
        // Load enabled coins & crypto prices from public config
        const resp = await apiClient.getPublicConfig()
        const data = resp.data || {}
        const apiCfg = data.api || {}
        const coins = apiCfg.cryptapi_enabled_coins || null
        setEnabledCoins(coins)
        const payCfg = data.payment || {}
        const prices = payCfg.crypto_usd_prices || null
        setCryptoUsdPrices(prices)

        // Load credit packages from unified API
        const packagesResp = await apiClient.getCreditPackages()
        if (packagesResp.success && packagesResp.data) {
          const { packages, creditPerUsd } = packagesResp.data
          setConversionRate(creditPerUsd || 10)

          // Convert packages to expected format
          const creditPackages = packages.map((pkg: any) => ({
            id: pkg.id.toString(),
            credits: pkg.credits,
            price: pkg.price,
            bonus: pkg.bonus || 0,
            popular: pkg.popular || false,
            savings: pkg.savings || (pkg.popular ? '10%' : '')
          }))

          setCreditPackages(creditPackages)
          if (creditPackages.length > 0) {
            setSelectedPackage(creditPackages[0])
          }
        }
      } catch (error) {
        console.error('[CryptoPayment] Failed to load config:', error)
      }
    }

    // Small delay to ensure token interceptor is ready
    const timer = setTimeout(() => {
      loadConfig()
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const availableOptions = enabledCoins ? cryptoOptions.filter((o) => enabledCoins[o.value]) : cryptoOptions

  useEffect(() => {
    if (enabledCoins && !enabledCoins[selectedCoin]) {
      const first = availableOptions[0]?.value
      if (first) setSelectedCoin(first)
    }
  }, [enabledCoins])

  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [orderStatus, setOrderStatus] = useState<string>('pending')
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(0)

  // Countdown timer
  useEffect(() => {
    if (paymentData && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, paymentData]);

  // Set initial countdown when payment is created
  useEffect(() => {
    if (paymentData) {
      const expiryTime = new Date(paymentData.expiresAt).getTime();
      const now = new Date().getTime();
      const secondsLeft = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setTimeLeft(secondsLeft);
    }
  }, [paymentData]);

  // Check order status periodically
  useEffect(() => {
    if (paymentData && orderStatus === 'pending') {
      const interval = setInterval(async () => {
        try {
          const response = await apiClient.get(`/payments/cryptapi/status/${paymentData.orderId}`);
          if (response.data.success) {
            const status = response.data.data.status;
            setOrderStatus(status);

            if (status === 'approved') {
              toast({
                title: t('cryptoPayment.toasts.successTitle'),
                description: t('cryptoPayment.toasts.successDesc'),
                variant: "default",
              });
              // Refresh user data
              window.location.reload();
            }
          }
        } catch (error) {
          console.error('Failed to check order status:', error);
        }
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [paymentData, orderStatus, toast]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getAmount = () => {
    return isCustom ? parseFloat(customAmount) || 0 : (selectedPackage?.price || 0);
  };

  const getCredits = () => {
    if (isCustom) {
      const amount = parseFloat(customAmount) || 0;
      return Math.floor(amount * conversionRate); // Use dynamic conversion rate
    }
    return selectedPackage?.credits + (selectedPackage?.bonus || 0);
  };


  const getCoinShortName = (coinValue: string) => {
    if (coinValue.includes('/')) {
      return coinValue.split('/')[1];
    }
    return coinValue;
  };

  const handleCreatePayment = async () => {
    const amount = getAmount();

    if (!amount || amount < 1) {
      toast({
        title: t('cryptoPayment.toasts.errorTitle'),
        description: t('cryptoPayment.toasts.minAmount'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Token is already set in apiClient from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      console.log('[HandleCreatePayment] Making request with token');
      console.log('[HandleCreatePayment] Payload:', { amount, coin: selectedCoin });

      const response = await apiClient.post('/payments/cryptapi/create-address', {
        amount,
        coin: selectedCoin,
        confirmations: 1
      });

      if (response.data.success) {
        setPaymentData(response.data.data);
        setOrderStatus('pending');
        toast({
          title: t('cryptoPayment.toasts.createdTitle'),
          description: t('cryptoPayment.toasts.createdDesc'),
          variant: "default",
        });
      } else {
        toast({
          title: t('cryptoPayment.toasts.errorTitle'),
          description: response.data.message || t('cryptoPayment.toasts.createError'),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[HandleCreatePayment] Full error:', error);
      console.error('[HandleCreatePayment] Response:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi tạo thanh toán';
      toast({
        title: t('cryptoPayment.toasts.errorTitle'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: t('cryptoPayment.toasts.copiedTitle'),
        description: t('cryptoPayment.toasts.copiedDesc'),
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: t('cryptoPayment.toasts.errorTitle'),
        description: t('cryptoPayment.toasts.copyError'),
        variant: "destructive",
      });
    }
  };

  const resetPayment = () => {
    setPaymentData(null);
    setOrderStatus('pending');
    setTimeLeft(0);
  };

  if (paymentData) {
    const selectedCrypto = cryptoOptions.find(c => c.value === selectedCoin);
    const IconComponent = selectedCrypto?.icon || Bitcoin;

    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('cryptoPayment.payTitle')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('cryptoPayment.payDescription', { credits: getCredits().toString() })}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <IconComponent className={`h-5 w-5 ${selectedCrypto?.color}`} />
                {t('cryptoPayment.paymentInfo')}
              </CardTitle>
              <CardDescription>
                {t('cryptoPayment.sendTo', { label: selectedCrypto?.label || '' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-xs sm:text-sm font-medium">{t('cryptoPayment.status')}</span>
                <Badge variant={orderStatus === 'approved' ? 'default' : orderStatus === 'pending' ? 'secondary' : 'destructive'}>
                  {orderStatus === 'approved' ? t('cryptoPayment.statusPaid') :
                   orderStatus === 'pending' ? t('cryptoPayment.statusPending') : orderStatus}
                </Badge>
              </div>

              {/* Countdown */}
              {timeLeft > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg gap-2">
                  <span className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t('cryptoPayment.timeLeft')}
                  </span>
                  <span className="font-mono text-orange-600 dark:text-orange-400 text-sm">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              )}

              {/* Address */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  {t('cryptoPayment.receiveAddress', { coin: paymentData.coin.toUpperCase() })}
                </label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <Input
                    value={paymentData.address_in}
                    readOnly
                    className="font-mono text-xs order-2 sm:order-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(paymentData.address_in)}
                    className="shrink-0 order-1 sm:order-2"
                  >
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs sm:text-sm font-medium">{t('cryptoPayment.amountUSD')}</label>
                  <Input value={`$${paymentData.amount}`} readOnly className="text-xs sm:text-sm" />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium">{t('cryptoPayment.creditsReceive')}</label>
                  <Input value={`${getCredits()} credits`} readOnly className="text-xs sm:text-sm" />
                </div>
              </div>

              {/* Minimum */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                  <strong>{t('cryptoPayment.minimumAmount')}</strong> {paymentData.minimum_transaction_coin} {paymentData.coin.toUpperCase()}
                </p>
              </div>

              {/* Instructions */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs sm:text-sm">{paymentData.instructions}</p>
              </div>

              <Button onClick={resetPayment} variant="outline" className="w-full text-xs sm:text-sm">
                <ArrowRight className="h-4 w-4 mr-2" />
                {t('cryptoPayment.newPayment')}
              </Button>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <QrCode className="h-5 w-5" />
                {t('cryptoPayment.qrCode')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('cryptoPayment.qrDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              {paymentData.qr_code_base64 ? (
                <div className="p-2 sm:p-4 bg-white rounded-lg w-full flex justify-center">
                  <img
                    src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                    alt="QR Code"
                    className="w-40 h-40 sm:w-64 sm:h-64"
                  />
                </div>
              ) : (
                <div className="w-40 h-40 sm:w-64 sm:h-64 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-xs sm:text-sm text-muted-foreground">QR Code không khả dụng</p>
                </div>
              )}

              <div className="text-center space-y-2 w-full">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('cryptoPayment.scanWithWallet')}
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  {t('cryptoPayment.orderId')} {paymentData.orderId}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading state while packages are being loaded
  if (!selectedPackage || creditPackages.length === 0) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('cryptoPayment.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('cryptoPayment.subtitle')}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm sm:text-base text-muted-foreground">Đang tải gói credit...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('cryptoPayment.title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t('cryptoPayment.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Credit Packages */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Gift className="h-5 w-5" />
                {t('cryptoPayment.choosePackage')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('cryptoPayment.choosePackageDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Package Selection */}
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {creditPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`relative p-3 sm:p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedPackage?.id === pkg.id && !isCustom
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setIsCustom(false);
                    }}
                  >
                    {pkg.popular && (
                      <Badge className="absolute -top-2 left-4" variant="default">
                        <Star className="h-3 w-3 mr-1" />
                        {t('cryptoPayment.popular')}
                      </Badge>
                    )}

                    <div className="text-center space-y-2">
                      <div className="text-lg sm:text-2xl font-bold">{pkg.credits}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">Credits</div>
                      {pkg.bonus > 0 && (
                        <div className="text-xs sm:text-sm text-green-600 font-medium">
                          +{pkg.bonus} bonus
                        </div>
                      )}
                      <div className="text-base sm:text-xl font-bold">${pkg.price}</div>
                      {pkg.savings && (
                        <Badge variant="secondary" className="text-xs">
                          {t('cryptoPayment.savings', { percent: pkg.savings })}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="border-t pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    id="custom"
                    checked={isCustom}
                    onChange={(e) => setIsCustom(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="custom" className="text-xs sm:text-sm font-medium">
                    {t('cryptoPayment.customAmount')}
                  </label>
                </div>

                {isCustom && (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      placeholder={t('cryptoPayment.customAmountPlaceholder')}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      min="1"
                      step="0.01"
                      className="text-xs sm:text-sm"
                    />
                    {customAmount && (
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {t('cryptoPayment.willReceive', { credits: Math.floor((parseFloat(customAmount) || 0) * conversionRate).toString() })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Method & Summary */}
        <div className="space-y-6">
          {/* Crypto Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Coins className="h-5 w-5" />
                {t('cryptoPayment.chooseCrypto')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3">
              {availableOptions.map((crypto) => {
                const IconComponent = crypto.icon;
                return (
                  <div
                    key={crypto.value}
                    className={`flex items-center space-x-3 p-2 sm:p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedCoin === crypto.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedCoin(crypto.value)}
                  >
                    <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${crypto.color}`} />
                    <span className="text-xs sm:text-sm font-medium">{crypto.label}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <TrendingUp className="h-5 w-5" />
                {t('cryptoPayment.summary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>{t('cryptoPayment.amount')}</span>
                  <span className="font-medium">${getAmount()}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>{t('cryptoPayment.creditsReceive')}</span>
                  <span className="font-medium">{getCredits()} credits</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>{t('cryptoPayment.method')}</span>
                  <span className="font-medium text-right">
                    {cryptoOptions.find(c => c.value === selectedCoin)?.label}
                  </span>
                </div>
                {(() => {
                  const shortName = getCoinShortName(selectedCoin);
                  const price = cryptoUsdPrices?.[shortName] || 0;
                  const amt = getAmount();
                  if (price > 0 && amt > 0) {
                    const coinAmt = amt / price;
                    return (
                      <div className="flex justify-between text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                        <span>{t('cryptoPayment.estimatedCryptoAmount', { coin: shortName.toUpperCase() })}</span>
                        <span className="font-medium">{coinAmt.toFixed(8)} {shortName.toUpperCase()}</span>
                      </div>
                    )
                  }
                  return null;
                })()}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-medium text-xs sm:text-sm">
                  <span>{t('cryptoPayment.total')}</span>
                  <span>${getAmount()}</span>
                </div>
              </div>

              <Button
                onClick={handleCreatePayment}
                disabled={isLoading || !selectedPackage || !selectedCoin || getAmount() < 1}
                className="w-full text-xs sm:text-sm"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('cryptoPayment.creating')}
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-2" />
                    {t('cryptoPayment.createAddress')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* User Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <DollarSign className="h-5 w-5" />
                {t('cryptoPayment.currentBalance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-primary">
                {user?.balance || 0} credits
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {t('cryptoPayment.balanceNotice')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
