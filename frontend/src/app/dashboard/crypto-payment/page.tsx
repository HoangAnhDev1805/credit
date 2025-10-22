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
import { useSocket } from '@/hooks/use-socket'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  RefreshCw,
  History as HistoryIcon,
  XCircle,
  Eye
} from 'lucide-react'

interface PaymentData {
  paymentRequestId: string;
  orderId: string;
  coin: string;
  amount: number;
  address_in: string;
  minimum_transaction_coin: number;
  qr_code_base64?: string;
  qr_code?: string;
  qrcode_url?: string;
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
  const { on: socketOn, isConnected } = useSocket({ enabled: true })

  const [creditPackages, setCreditPackages] = useState<any[]>([])
  const [conversionRate, setConversionRate] = useState(10)
  const [minDeposit, setMinDeposit] = useState(1)
  const [maxDeposit, setMaxDeposit] = useState<number | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<any>(null)
  const [selectedCoin, setSelectedCoin] = useState('btc')
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [enabledCoins, setEnabledCoins] = useState<Record<string, boolean> | null>(null)
  const [cryptoUsdPrices, setCryptoUsdPrices] = useState<Record<string, number> | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [cancelingPaymentId, setCancelingPaymentId] = useState<string | null>(null)
  const [hasPendingPayment, setHasPendingPayment] = useState(false)

  useEffect(() => {
    // Set token first, wait a bit for it to settle, then load config
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    if (token) {
      apiClient.setToken(token)
    }

    // Load configuration including enabled coins and packages
    const loadConfig = async () => {
      try {
        // Load both config and packages in parallel for faster page load
        const [configResp, packagesResp] = await Promise.all([
          apiClient.getPublicConfig(),
          apiClient.get('/payments/packages')
        ])
        
        // Process config data
        const root = (configResp?.data && configResp.data.data) ? configResp.data.data : (configResp.data || {})
        const apiCfg = root.api || {}
        const coins = apiCfg.cryptapi_enabled_coins || apiCfg.cryptapi?.enabledCoins || null
        setEnabledCoins(coins)
        const payCfg = root.payment || {}
        const prices = payCfg.crypto_usd_prices || payCfg.cryptoUsdPrices || null
        setCryptoUsdPrices(prices)
        const conv = (typeof payCfg.usdToCreditRate === 'number' && payCfg.usdToCreditRate > 0)
          ? payCfg.usdToCreditRate
          : (typeof payCfg.payment_credit_per_usd === 'number' && payCfg.payment_credit_per_usd > 0
              ? payCfg.payment_credit_per_usd
              : conversionRate)
        setConversionRate(conv)

        const minDep = (typeof payCfg.minDepositAmount === 'number') ? payCfg.minDepositAmount
                     : (typeof payCfg.min_deposit_amount === 'number' ? payCfg.min_deposit_amount : undefined)
        if (typeof minDep === 'number') setMinDeposit(minDep || 1)

        const maxDep = (typeof payCfg.maxDepositAmount === 'number') ? payCfg.maxDepositAmount
                     : (typeof payCfg.max_deposit_amount === 'number' ? payCfg.max_deposit_amount : undefined)
        if (typeof maxDep === 'number') setMaxDeposit(maxDep || null)

        // Prefer Admin Settings creditPackages from public config if available
        const cfgPkgsRaw = Array.isArray(payCfg?.creditPackages)
          ? payCfg.creditPackages
          : (Array.isArray(payCfg?.payment_credit_packages) ? payCfg.payment_credit_packages : [])
        const cfgPkgs = cfgPkgsRaw.map((p: any, idx: number) => ({
          id: p.id ?? idx + 1,
          credits: p.credits,
          price: p.price,
          bonus: p.bonus || 0,
          popular: p.popular || false,
          isActive: (p.isActive === undefined ? true : p.isActive !== false),
          displayOrder: typeof p.displayOrder === 'number' ? p.displayOrder : idx,
          savings: p.bonus > 0 ? `${p.bonus}%` : ''
        })).filter((p: any) => p.isActive !== false).sort((a: any, b: any) => (a.displayOrder||0) - (b.displayOrder||0))

        // Use only Admin Settings packages for consistency across system
        setCreditPackages(cfgPkgs)
        if (cfgPkgs.length > 0) setSelectedPackage(cfgPkgs[0])
      } catch (error) {
        // Failed to load config
      }
    }

    // Load data immediately in parallel
    Promise.all([
      loadConfig(),
      checkPendingPayment()
    ]).then(async () => {
      // If there is a pending crypto payment, prefill paymentData to show banner and countdown
      try {
        const pendingRes = await apiClient.get('/payments/cryptapi/check-pending')
        const p = pendingRes?.data?.data?.payment
        if (pendingRes?.data?.success && pendingRes?.data?.data?.hasPending && p && p.orderId) {
          setPaymentData({
            paymentRequestId: '',
            orderId: p.orderId,
            coin: (p.coin || selectedCoin || 'btc'),
            amount: p.amount || getAmount(),
            address_in: p.address_in || '',
            minimum_transaction_coin: 0,
            expiresAt: p.expiresAt,
            instructions: 'Send the exact amount to the address above'
          } as any)
          setOrderStatus('pending')
          // Không bật banner

          // Fetch full status to populate QR fields for dialog and right pane
          try {
            const st = await apiClient.get(`/payments/cryptapi/status/${p.orderId}`)
            const d = st?.data?.data || {}
            setPaymentData(prev => prev ? ({ ...prev, qrcode_url: d.qrcode_url, qr_code: d.qr_code, payment_uri: d.payment_uri, address_in: d.address_in || prev.address_in, coin: d.coin || prev.coin }) as any : prev)
            setSelectedPaymentDetail((prev: any) => prev ? ({
              ...prev,
              status: d.status || prev.status,
              metadata: {
                ...(prev.metadata || {}),
                qrcode_url: d.qrcode_url,
                cryptapi_qr_code: d.qr_code,
                payment_uri: d.payment_uri,
                cryptapi_address_in: d.address_in,
                cryptapi_coin: d.coin
              }
            }) : prev)
          } catch {}
        }
      } catch {}
    }).catch(() => {})
  }, [])

  // Check if user has pending payment
  const checkPendingPayment = async () => {
    try {
      const response = await apiClient.get('/payments/requests?status=pending&limit=1')
      if (response.data.success && response.data.data) {
        const requests = response.data.data.requests || []
        setHasPendingPayment(requests.length > 0)
      }
    } catch (error) {
      // Failed to check pending payment
    }
  }

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
  const [bannerOpen, setBannerOpen] = useState<boolean>(false)

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
      // Không dùng banner; chỉ mở dialog
      // Auto open detail dialog to show QR + cancel button
      setSelectedPaymentDetail({
        amount: paymentData.amount,
        status: orderStatus,
        orderId: paymentData.orderId,
        metadata: {
          cryptapi_qr_code: (paymentData as any).qr_code,
          qrcode_url: (paymentData as any).qrcode_url,
          payment_uri: (paymentData as any).payment_uri,
          cryptapi_address_in: paymentData.address_in,
          cryptapi_coin: paymentData.coin
        },
        createdAt: new Date().toISOString(),
        expiresAt: paymentData.expiresAt
      })
      // Không tự mở dialog chi tiết nữa; người dùng thao tác trực tiếp trên trang
    }
  }, [paymentData]);

  // Hydrate missing fields on reload (ensure QR/address/coin are filled)
  useEffect(() => {
    (async () => {
      try {
        if (paymentData && paymentData.orderId && (!paymentData.qrcode_url && !paymentData.qr_code) ) {
          const st = await apiClient.get(`/payments/cryptapi/status/${paymentData.orderId}`)
          const d = st?.data?.data || {}
          setPaymentData(prev => prev ? ({
            ...prev,
            qrcode_url: d.qrcode_url || prev.qrcode_url,
            qr_code: d.qr_code || prev.qr_code,
            payment_uri: d.payment_uri || (prev as any).payment_uri,
            address_in: d.address_in || prev.address_in,
            coin: d.coin || prev.coin,
            // carry minimum if backend provides
            minimum_transaction_coin: (d.minimum_transaction_coin ?? prev.minimum_transaction_coin)
          } as any) : prev)
        }
      } catch {}
    })()
  }, [paymentData?.orderId])

  // Removed polling; rely solely on Socket.IO realtime events

  // Socket realtime: generic status updates
  useEffect(() => {
    const off = socketOn('payment:update', (msg: any) => {
      if (!msg || !paymentData) return
      if (msg.orderId && msg.orderId !== paymentData.orderId) return
      const st = String(msg.status || '').toLowerCase()
      if (st === 'approved') {
        setOrderStatus('approved')
        setBannerOpen(false)
      } else if (st === 'processing') {
        setOrderStatus('processing')
        // Cập nhật QR nếu backend gửi kèm
        setSelectedPaymentDetail((prev: any) => prev ? ({
          ...prev,
          metadata: { ...(prev.metadata||{}), cryptapi_qr_code: msg?.qr_code || prev?.metadata?.cryptapi_qr_code, qrcode_url: msg?.qrcode_url || prev?.metadata?.qrcode_url, payment_uri: msg?.payment_uri || prev?.metadata?.payment_uri }
        }) : prev)
      } else if (st === 'failed') {
        if (timeLeft === 0) {
          setOrderStatus('failed')
          setBannerOpen(false)
        }
      }
    })
    return () => { if (typeof off === 'function') off() }
  }, [paymentData, timeLeft])

  // Socket realtime: payment completed -> auto credit and UI update
  useEffect(() => {
    const off = socketOn('payment:completed', (msg: any) => {
      try {
        if (!paymentData) return
        setOrderStatus('approved')
        // Close banner
        setBannerOpen(false)
      } catch {}
    })
    return () => { if (typeof off === 'function') off() }
  }, [paymentData])

  // Timeout → mark failed (only when truly past expiresAt)
  useEffect(() => {
    if (!paymentData) return
    const expiryTime = new Date(paymentData.expiresAt).getTime();
    const now = Date.now();
    if (now >= expiryTime && (orderStatus === 'pending' || orderStatus === 'processing')) {
      setOrderStatus('failed')
      setBannerOpen(false)
    }
  }, [timeLeft, paymentData, orderStatus])

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
    // Check for pending payment first
    if (hasPendingPayment) {
      toast({
        title: 'Pending Payment',
        description: 'You already have a pending payment. Please complete or cancel it before creating a new one.',
        variant: "destructive",
      });
      return;
    }

    const amount = getAmount();

    if (!amount || amount < (minDeposit || 1)) {
      toast({
        title: t('cryptoPayment.toasts.errorTitle'),
        description: t('cryptoPayment.toasts.minAmount'),
        variant: "destructive",
      });
      return;
    }
    if (maxDeposit && amount > maxDeposit) {
      toast({
        title: t('cryptoPayment.toasts.errorTitle'),
        description: `Maximum deposit is $${maxDeposit}`,
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

      const response = await apiClient.post('/payments/cryptapi/create-address', {
        amount,
        coin: selectedCoin,
        confirmations: 1
      });

      if (response.data.success) {
        setPaymentData(response.data.data);
        setOrderStatus('pending');
        // No toast; dialog + banner will handle UX
        setBannerOpen(true)
      } else {
        toast({
          title: t('cryptoPayment.toasts.errorTitle'),
          description: response.data.message || t('cryptoPayment.toasts.createError'),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi tạo thanh toán';
      // Keep error silently or surface in UI if needed
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
    setBannerOpen(false)
  };

  const cancelCurrentPayment = async () => {
    try {
      // Try find by current orderId first
      const currentOrder = paymentData?.orderId
      const res = await apiClient.get('/payments/requests?status=pending&limit=10')
      const list = res?.data?.data?.requests || []
      const req = list.find((r: any) => r?.orderId === currentOrder) || list[0]
      const rid = (req && (req.id || req._id))
      if (rid) await apiClient.delete(`/payments/requests/${rid}`)
    } catch {}
    resetPayment()
  }

  if (paymentData) {
    const selectedCrypto = cryptoOptions.find(c => c.value === selectedCoin);
    const IconComponent = selectedCrypto?.icon || Bitcoin;

    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
        {/* Banner đã bỏ theo yêu cầu */}
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
              {(orderStatus === 'pending' || orderStatus === 'processing') && (
                <Button variant="destructive" size="sm" className="self-stretch" onClick={cancelCurrentPayment}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Payment
                </Button>
              )}
              {(() => {
                const qrBase64 = paymentData.qr_code_base64 || paymentData.qr_code;
                let qrUrl = paymentData.qrcode_url;
                // Fallback từ payment_uri nếu không có ảnh QR
                if (!qrBase64 && !qrUrl && (paymentData as any)?.payment_uri) {
                  const enc = encodeURIComponent((paymentData as any).payment_uri)
                  qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${enc}`
                }

                if (qrBase64) {
                  return (
                    <div className="p-2 sm:p-4 bg-white rounded-lg w-full flex justify-center">
                      <img
                        src={`data:image/png;base64,${qrBase64}`}
                        alt="QR Code"
                        className="w-40 h-40 sm:w-64 sm:h-64"
                      />
                    </div>
                  );
                } else if (qrUrl) {
                  return (
                    <div className="p-2 sm:p-4 bg-white rounded-lg w-full flex justify-center">
                      <img
                        src={qrUrl}
                        alt="QR Code"
                        className="w-40 h-40 sm:w-64 sm:h-64"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Loading spinner while image loads */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="w-40 h-40 sm:w-64 sm:h-64 bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="text-xs sm:text-sm text-muted-foreground">Loading QR Code...</p>
                      </div>
                    </div>
                  );
                }
              })()}

              <div className="text-center space-y-2 w-full">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('cryptoPayment.scanWithWallet')}
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  {t('cryptoPayment.orderId')} {paymentData.orderId}
                </p>
                {paymentData.address_in && (
                  <p className="text-xs text-muted-foreground break-all">Address: {paymentData.address_in}</p>
                )}
                {typeof paymentData.minimum_transaction_coin === 'number' && paymentData.coin && (
                  <p className="text-xs text-muted-foreground">Minimum: {paymentData.minimum_transaction_coin} {paymentData.coin.toUpperCase()}</p>
                )}
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
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm sm:text-base text-muted-foreground">Loading credit packages...</p>
          </div>
        </div>
      </div>
    );
  }

  // Load payment history
  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await apiClient.get('/payments/requests')
      if (response.data.success) {
        const data = response.data.data
        // Ensure it's always an array
        if (Array.isArray(data)) {
          setPaymentHistory(data)
        } else if (data && Array.isArray(data.requests)) {
          setPaymentHistory(data.requests)
          // Update pending payment flag
          setHasPendingPayment(data.requests.some((p: any) => p.status === 'pending'))
        } else {
          setPaymentHistory([])
        }
      } else {
        setPaymentHistory([])
      }
    } catch (error) {
      setPaymentHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // Handle view payment details
  const handleViewDetail = (payment: any) => {
    setSelectedPaymentDetail(payment)
    setShowDetailModal(true)
  }

  // Handle cancel payment
  const handleCancelPayment = async (paymentId: string) => {
    setCancelingPaymentId(paymentId)
    try {
      const response = await apiClient.delete(`/payments/requests/${paymentId}`)
      if (response.data.success) {
        toast({
          title: 'Success',
          description: 'Payment request cancelled successfully',
        })
        loadHistory() // Reload history
        checkPendingPayment() // Recheck pending status
        setShowDetailModal(false)
      } else {
        throw new Error(response.data.message || 'Failed to cancel')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel payment',
        variant: 'destructive',
      })
    } finally {
      setCancelingPaymentId(null)
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      <div className="mb-6 sm:mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('cryptoPayment.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('cryptoPayment.subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowHistoryModal(true)
            loadHistory()
          }}
          className="flex items-center gap-2"
        >
          <HistoryIcon className="h-4 w-4" />
          History
        </Button>
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
                disabled={isLoading || !selectedPackage || !selectedCoin || getAmount() < 1 || hasPendingPayment}
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

      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Payment History
            </DialogTitle>
            <DialogDescription>
              View your recent crypto payment transactions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !Array.isArray(paymentHistory) || paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment history found
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment: any) => (
                  <Card key={payment.id || payment._id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              ${payment.amount || payment.finalAmount}
                            </span>
                            <Badge variant={
                              payment.status === 'approved' ? 'default' :
                              payment.status === 'pending' ? 'secondary' :
                              payment.status === 'cancelled' || payment.status === 'rejected' ? 'destructive' : 'outline'
                            }>
                              {payment.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {payment.paymentMethod?.name || payment.paymentMethod?.type || 'N/A'}
                            {payment.paymentMethod?.bankName && ` • ${payment.paymentMethod.bankName}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.createdAt).toLocaleString()}
                          </p>
                          {payment.note && (
                            <p className="text-xs text-muted-foreground italic">
                              Note: {payment.note}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.status === 'pending' && (
                            <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                          )}
                          {payment.status === 'approved' && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          {(payment.status === 'cancelled' || payment.status === 'rejected') && (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(payment)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Details
            </DialogTitle>
            <DialogDescription>
              Review details of your selected crypto payment. If the payment remains pending until it expires, it will be marked as failed automatically.
            </DialogDescription>
          </DialogHeader>

          {selectedPaymentDetail && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <Badge 
                  variant={
                    selectedPaymentDetail.status === 'approved' ? 'default' :
                    selectedPaymentDetail.status === 'pending' ? 'secondary' :
                    'destructive'
                  }
                  className="text-sm px-3 py-1"
                >
                  {selectedPaymentDetail.status === 'pending' && (
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  )}
                  {selectedPaymentDetail.status.toUpperCase()}
                </Badge>
                <span className="text-2xl font-bold">
                  ${selectedPaymentDetail.amount || selectedPaymentDetail.finalAmount}
                </span>
              </div>

              {/* Payment Info */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Payment Method</p>
                      <p className="font-medium">
                        {selectedPaymentDetail.paymentMethod?.name || selectedPaymentDetail.paymentMethod?.type || 'N/A'}
                      </p>
                    </div>
                    {selectedPaymentDetail.paymentMethod?.bankName && (
                      <div>
                        <p className="text-muted-foreground">Bank</p>
                        <p className="font-medium">{selectedPaymentDetail.paymentMethod.bankName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Created At</p>
                      <p className="font-medium">{new Date(selectedPaymentDetail.createdAt).toLocaleString()}</p>
                    </div>
                    {selectedPaymentDetail.processedAt && (
                      <div>
                        <p className="text-muted-foreground">Processed At</p>
                        <p className="font-medium">{new Date(selectedPaymentDetail.processedAt).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedPaymentDetail.expiresAt && (
                      <div>
                        <p className="text-muted-foreground">Expires At</p>
                        <p className="font-medium">{new Date(selectedPaymentDetail.expiresAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {selectedPaymentDetail.note && (
                    <div className="pt-3 border-t">
                      <p className="text-muted-foreground text-sm">Note</p>
                      <p className="text-sm">{selectedPaymentDetail.note}</p>
                    </div>
                  )}

                  {selectedPaymentDetail.adminNote && (
                    <div className="pt-3 border-t">
                      <p className="text-muted-foreground text-sm">Admin Note</p>
                      <p className="text-sm">{selectedPaymentDetail.adminNote}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* QR Code - Show for pending/processing crypto payments */}
              {(selectedPaymentDetail.status === 'pending' || selectedPaymentDetail.status === 'processing') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      Payment Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Try to get QR from different possible fields */}
                    {(() => {
                      let qrUrl = selectedPaymentDetail.metadata?.cryptapi_qr_code || 
                                   selectedPaymentDetail.metadata?.qrcode_url ||
                                   selectedPaymentDetail.qrcode_url;
                      if (!qrUrl) {
                        const uri = selectedPaymentDetail.metadata?.payment_uri || (paymentData as any)?.payment_uri
                        if (uri) {
                          const enc = encodeURIComponent(uri)
                          // External QR image fallback (HTTPS)
                          qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${enc}`
                        }
                      }
                      const address = selectedPaymentDetail.metadata?.cryptapi_address ||
                                     selectedPaymentDetail.metadata?.cryptapi_address_in ||
                                     selectedPaymentDetail.address_in;
                      
                      return (
                        <>
                          {qrUrl && (
                            <div className="flex justify-center p-4 bg-white rounded-lg">
                              <img
                                src={qrUrl}
                                alt="QR Code"
                                className="w-48 h-48"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          {address && (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Address</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                                  {address}
                                </code>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(address)
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                          {selectedPaymentDetail.metadata?.cryptapi_minimum_transaction && (
                            <p className="text-sm text-muted-foreground">
                              Minimum: {selectedPaymentDetail.metadata.cryptapi_minimum_transaction} {selectedPaymentDetail.metadata.cryptapi_coin?.toUpperCase()}
                            </p>
                          )}
                          {!qrUrl && !address && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Payment information not available
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Cancel Button - For pending/processing payments */}
              {(selectedPaymentDetail.status === 'pending' || selectedPaymentDetail.status === 'processing') && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={cancelCurrentPayment}
                  disabled={!!cancelingPaymentId}
                >
                  {cancelingPaymentId === (selectedPaymentDetail.id || selectedPaymentDetail._id) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Payment
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
