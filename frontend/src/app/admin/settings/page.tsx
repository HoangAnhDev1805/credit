'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SharedForm, FormField } from '@/components/shared/Form'
import { useToast } from '@/components/shared/Toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUpload } from '@/components/shared/ImageUpload'
import { apiClient } from '@/lib/api'
import { Settings, Globe, DollarSign, Eye, CreditCard, Palette, Languages, Zap, Tag, Bitcoin } from 'lucide-react'

interface SiteConfig {
  siteName: string
  siteDescription: string
  siteKeywords: string
  seoTitle: string
  seoDescription: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  contactEmail: string
  supportPhone: string
  address: string
  footerText: string
  logo: string
  favicon: string
  thumbnail: string
}

interface PricingConfig {
  pricePerCard: number
  bulkDiscounts: Array<{
    minQuantity: number
    discount: number
  }>
  currency: string
  paymentMethods: string[]
}

interface UiConfig { defaultLanguage: string; languageSwitcher: boolean; availableLanguages: string[] }
interface CryptApiConfig { merchantAddress?: string; merchantAddresses?: Record<string, string>; webhookDomain: string; enabledCoins: Record<string, boolean> }

interface PaymentConfig {
  usdToCreditRate: number;
  showBuyCredits: boolean;
  showCryptoPayment: boolean;
  creditPackages: Array<{ id: number; name: string; credits: number; price: number; popular: boolean }>;
  minDepositAmount: number;
  maxDepositAmount: number;
}


export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('site')
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
  const [uiConfig, setUiConfig] = useState<UiConfig | null>(null)
  const [cryptApiConfig, setCryptApiConfig] = useState<CryptApiConfig | null>(null)

  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)

  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null)
  const [pricingTiers, setPricingTiers] = useState<Array<{ max: number | null, total: number }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const { success, error: showError } = useToast()

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const [siteResponse, pricingResponse, tiersResponse, uiResponse, cryptResponse, paymentResp] = await Promise.all([
        apiClient.get('/admin/site-config'),
        apiClient.get('/admin/pricing-config'),
        apiClient.get('/admin/pricing-tiers'),
        apiClient.get('/admin/ui-config'),
        apiClient.get('/admin/cryptapi-config'),
        apiClient.get('/admin/payment-config')
      ])

      setSiteConfig(siteResponse.data.data.siteConfig)
      setPricingConfig(pricingResponse.data.data.pricingConfig)
      setUiConfig(uiResponse.data.data.uiConfig)
      setCryptApiConfig(cryptResponse.data.data.cryptapi)

      setPaymentConfig(paymentResp.data.data.payment)

      const serverTiers = tiersResponse.data?.data?.tiers || []
      // Chuyển đổi sang dạng hiển thị {max, total}
      const displayTiers = serverTiers.map((t: any) => ({
        max: t.maxCards === null ? null : t.maxCards,
        total: t.maxCards === null ? Math.round(t.pricePerCard * t.minCards) : Math.round(t.pricePerCard * t.maxCards)
      }))
      setPricingTiers(displayTiers)
    } catch (error: any) {
      console.error('Failed to fetch configs:', error)
      showError('Lỗi tải dữ liệu', 'Không thể tải cấu hình hệ thống')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSiteConfig = async (formData: any) => {
    try {
      setSaving(true)
      console.log('Saving site config:', formData)
      await apiClient.put('/admin/site-config', formData)
      success('Thành công', 'Cập nhật cấu hình website thành công')

      // Cập nhật state local thay vì fetch lại từ server
      setSiteConfig(prev => ({ ...prev, ...formData }))
    } catch (error: any) {
      console.error('Failed to save site config:', error)
      showError('Lỗi lưu', error.response?.data?.message || 'Không thể lưu cấu hình website')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePricingConfig = async (formData: any) => {
    try {
      setSaving(true)
      await apiClient.put('/admin/pricing-config', formData)
      success('Thành công', 'Cập nhật cấu hình giá thành công')
      fetchConfigs()
    } catch (error: any) {
      console.error('Failed to save pricing config:', error)
      showError('Lỗi lưu', error.response?.data?.message || 'Không thể lưu cấu hình giá')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveUiConfig = async (formData: any) => {
    try {
      setSaving(true)
      await apiClient.put('/admin/ui-config', {
        defaultLanguage: formData.defaultLanguage,
        languageSwitcher: formData.languageSwitcher,
        availableLanguages: [
          ...(formData.lang_en ? ['en'] : []),
          ...(formData.lang_vi ? ['vi'] : [])
        ]
      })
      success('Thành công', 'Cập nhật cấu hình ngôn ngữ thành công')
      fetchConfigs()
    } catch (error: any) {
      console.error('Failed to save UI config:', error)
      showError('Lỗi lưu', error.response?.data?.message || 'Không thể lưu cấu hình ngôn ngữ')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCryptApiConfig = async (formData: any) => {
    try {
      setSaving(true)
      const enabled: Record<string, boolean> = {
        btc: !!formData.enable_btc,
        ltc: !!formData.enable_ltc,
        'bep20/usdt': !!formData.enable_usdt_bep20,
        'trc20/usdt': !!formData.enable_usdt_trc20,
        'erc20/usdt': !!formData.enable_usdt_erc20,
        eth: !!formData.enable_eth,
        'sol/sol': !!formData.enable_sol,
        'polygon/pol': !!formData.enable_pol
      }
      const merchantAddresses: Record<string, string> = {
        btc: formData.addr_btc || '',
        ltc: formData.addr_ltc || '',
        'bep20/usdt': formData.addr_usdt_bep20 || '',
        'trc20/usdt': formData.addr_usdt_trc20 || '',
        'erc20/usdt': formData.addr_usdt_erc20 || ''
      }
      await apiClient.put('/admin/cryptapi-config', {
        merchantAddresses,
        webhookDomain: formData.webhookDomain,
        enabledCoins: enabled
      })
      success('Thành công', 'Cập nhật cấu hình CryptAPI thành công')
      fetchConfigs()
    } catch (error: any) {
      console.error('Failed to save CryptAPI config:', error)
      showError('Lỗi lưu', error.response?.data?.message || 'Không thể lưu cấu hình CryptAPI')
    } finally {
      setSaving(false)
    }
  }



  const handleSavePricingTiers = async () => {
    try {
      setSaving(true)
      // Chuyển đổi sang dạng tài liệu cơ sở dữ liệu
      const payloadTiers = pricingTiers.map((row, idx) => {
        const prevMax = idx === 0 ? 0 : (pricingTiers[idx - 1].max || 0)
        const minCards = prevMax + 1
        const maxCards = row.max === null ? null : row.max
        const divisor = maxCards ? maxCards : minCards
        const pricePerCard = row.total / divisor
        return {
          minCards,
          maxCards,
          pricePerCard,
          discountPercentage: 0,
          isActive: true,
          priority: idx,
          applicableUserRoles: ['user']
        }
      })

      await apiClient.put('/admin/pricing-tiers', { tiers: payloadTiers })
      success('Thành công', 'Cập nhật bảng giá thành công')
      fetchConfigs()
    } catch (error: any) {
      console.error('Failed to save pricing tiers:', error)
      showError('Lỗi lưu', error.response?.data?.message || 'Không thể lưu bảng giá')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePaymentConfig = async (formData: any) => {
    try {
      setSaving(true)
      await apiClient.put('/admin/payment-config', formData)
      success('Thành công', 'Cập nhật cấu hình Payment thành công')
      fetchConfigs()
    } catch (error: any) {
      console.error('Failed to save payment config:', error)
      showError('Lỗi lưu', error.response?.data?.message || 'Không thể lưu cấu hình Payment')
    } finally {
      setSaving(false)
    }
  }


  const siteConfigFields: FormField[] = [
    {
      name: 'logo',
      label: 'Logo Website',
      type: 'image',
      placeholder: 'Tải lên logo website (PNG, SVG khuyến nghị)'
    },
    {
      name: 'favicon',
      label: 'Favicon',
      type: 'image',
      placeholder: 'Tải lên favicon (ICO, PNG 32x32px)'
    },
    {
      name: 'thumbnail',
      label: 'Thumbnail Website',
      type: 'image',
      placeholder: 'Hình đại diện website (1200x630px khuyến nghị)'
    },
    {
      name: 'siteName',
      label: 'Tên website',
      type: 'text',
      required: true,
      placeholder: 'VD: Credit Card Checker'
    },
    {
      name: 'siteDescription',
      label: 'Mô tả website',
      type: 'textarea',
      placeholder: 'Mô tả ngắn về website...'
    },
    {
      name: 'siteKeywords',
      label: 'Từ khóa SEO',
      type: 'text',
      placeholder: 'credit card, checker, validation'
    },
    {
      name: 'seoTitle',
      label: 'SEO Title',
      type: 'text',
      placeholder: 'Tiêu đề hiển thị trên search engine'
    },
    {
      name: 'seoDescription',
      label: 'SEO Description',
      type: 'textarea',
      placeholder: 'Mô tả hiển thị trên search engine'
    },
    {
      name: 'ogTitle',
      label: 'Open Graph Title',
      type: 'text',
      placeholder: 'Tiêu đề khi share trên social media'
    },
    {
      name: 'ogDescription',
      label: 'Open Graph Description',
      type: 'textarea',
      placeholder: 'Mô tả khi share trên social media'
    },
    {
      name: 'ogImage',
      label: 'Open Graph Image URL',
      type: 'text',
      placeholder: 'https://example.com/og-image.jpg'
    },
    {
      name: 'contactEmail',
      label: 'Email liên hệ',
      type: 'email',
      placeholder: 'contact@example.com'
    },
    {
      name: 'supportPhone',
      label: 'Số điện thoại hỗ trợ',
      type: 'text',
      placeholder: '+84 123 456 789'
    },
    {
      name: 'address',
      label: 'Địa chỉ',
      type: 'textarea',
      placeholder: 'Địa chỉ công ty...'
    },
    {
      name: 'footerText',
      label: 'Text footer',
      type: 'textarea',
      placeholder: 'Copyright text và thông tin khác...'
    }
  ]

  const pricingConfigFields: FormField[] = [
    {
      name: 'pricePerCard',
      label: 'Giá mỗi thẻ (VND)',
      type: 'number',
      required: true,
      placeholder: '1000'
    },
    {
      name: 'currency',
      label: 'Đơn vị tiền tệ',
      type: 'select',
      options: [
        { value: 'VND', label: 'VND' },
        { value: 'USD', label: 'USD' }
      ],
      required: true
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cấu hình Website</h1>
          <p className="text-muted-foreground">Quản lý cấu hình hệ thống</p>
        </div>

        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Cấu hình Website</h1>
        <p className="text-muted-foreground">Quản lý cấu hình hệ thống và SEO</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 gap-1">
          <TabsTrigger value="site" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Globe className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium">Cấu hình chung</div>
              <div className="text-xs opacity-70">Site & SEO</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="language" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
            <Languages className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium">Giao diện</div>
              <div className="text-xs opacity-70">UI & Ngôn ngữ</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="payment" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
            <CreditCard className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium">Thanh toán</div>
              <div className="text-xs opacity-70">Credit & Payment</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="cryptapi" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <Bitcoin className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium">API & Tích hợp</div>
              <div className="text-xs opacity-70">CryptAPI</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="pricing" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
            <Tag className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium">Bảng giá</div>
              <div className="text-xs opacity-70">Pricing Tiers</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="preview" className="data-[state=active]:bg-gray-500 data-[state=active]:text-white">
            <Eye className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium">Preview</div>
              <div className="text-xs opacity-70">Xem trước</div>
            </div>
          </TabsTrigger>
        </TabsList>

        {/* Site Configuration Tab */}
        <TabsContent value="site">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
              <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
                <Globe className="h-5 w-5 mr-2" />
                Cấu hình chung - Website & SEO
              </CardTitle>
              <CardDescription>
                Quản lý thông tin cơ bản của website, logo, favicon và cấu hình SEO để tối ưu hóa công cụ tìm kiếm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SharedForm
                fields={siteConfigFields}
                initialData={siteConfig || {}}
                onSubmit={handleSaveSiteConfig}
                submitText="Lưu cấu hình"
                loading={saving}
                columns={2}
              />
            </CardContent>
          </Card>
        </TabsContent>
        {/* Language Configuration Tab */}
        <TabsContent value="language">
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="bg-purple-50 dark:bg-purple-950/20">
              <CardTitle className="flex items-center text-purple-700 dark:text-purple-300">
                <Languages className="h-5 w-5 mr-2" />
                Giao diện & Ngôn ngữ
              </CardTitle>
              <CardDescription>
                Cấu hình giao diện người dùng, bật/tắt chuyển đổi ngôn ngữ và thiết lập ngôn ngữ mặc định cho hệ thống
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SharedForm
                fields={[
                  {
                    name: 'languageSwitcher',
                    label: 'Hiển thị nút chọn ngôn ngữ',
                    type: 'switch'
                  },
                  {
                    name: 'defaultLanguage',
                    label: 'Ngôn ngữ mặc định',
                    type: 'select',
                    options: [
                      { value: 'vi', label: 'Tiếng Việt' },
                      { value: 'en', label: 'English' }
                    ]
                  },
                  {
                    name: 'lang_vi',
                    label: 'Bật Tiếng Việt',
                    type: 'switch'
                  },
                  {
                    name: 'lang_en',
                    label: 'Bật English',
                    type: 'switch'
                  }
                ]}
                initialData={{
                  languageSwitcher: uiConfig?.languageSwitcher ?? true,
                  defaultLanguage: uiConfig?.defaultLanguage || 'vi',
                  lang_vi: uiConfig?.availableLanguages?.includes('vi'),
                  lang_en: uiConfig?.availableLanguages?.includes('en')
                }}
                onSubmit={handleSaveUiConfig}
                submitText="Lưu ngôn ngữ"
                loading={saving}
                columns={2}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CryptAPI Configuration Tab */}
        <TabsContent value="cryptapi">
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="bg-orange-50 dark:bg-orange-950/20">
              <CardTitle className="flex items-center text-orange-700 dark:text-orange-300">
                <Bitcoin className="h-5 w-5 mr-2" />
                API & Tích hợp - CryptAPI
              </CardTitle>
              <CardDescription>
                Cấu hình tích hợp CryptAPI để nhận thanh toán cryptocurrency, thiết lập địa chỉ ví và webhook domain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SharedForm
                fields={[
                  { name: 'webhookDomain', label: 'Domain công khai cho Webhook', type: 'text', placeholder: 'https://your-domain.com' },
                  { name: 'addr_btc', label: 'Địa chỉ BTC (address_out)', type: 'text' },
                  { name: 'addr_ltc', label: 'Địa chỉ LTC (address_out)', type: 'text' },
                  { name: 'addr_usdt_bep20', label: 'Địa chỉ USDT (BEP20) (address_out)', type: 'text' },
                  { name: 'addr_usdt_trc20', label: 'Địa chỉ USDT (TRC20) (address_out)', type: 'text' },
                  { name: 'addr_usdt_erc20', label: 'Địa chỉ USDT (ERC20) (address_out)', type: 'text' },
                  { name: 'enable_btc', label: 'Bật Bitcoin (BTC)', type: 'switch' },
                  { name: 'enable_ltc', label: 'Bật Litecoin (LTC)', type: 'switch' },
                  { name: 'enable_usdt_bep20', label: 'Bật USDT (BEP20)', type: 'switch' },
                  { name: 'enable_usdt_trc20', label: 'Bật USDT (TRC20)', type: 'switch' },
                  { name: 'enable_usdt_erc20', label: 'Bật USDT (ERC20)', type: 'switch' },
                  { name: 'enable_eth', label: 'Bật Ethereum (ETH)', type: 'switch' },
                  { name: 'enable_sol', label: 'Bật Solana (SOL)', type: 'switch' },
                  { name: 'enable_pol', label: 'Bật Polygon (POL)', type: 'switch' }
                ]}
                initialData={{
                  webhookDomain: cryptApiConfig?.webhookDomain || '',
                  addr_btc: cryptApiConfig?.merchantAddresses?.btc || cryptApiConfig?.merchantAddress || '',
                  addr_ltc: cryptApiConfig?.merchantAddresses?.ltc || '',
                  addr_usdt_bep20: cryptApiConfig?.merchantAddresses?.['bep20/usdt'] || '',
                  addr_usdt_trc20: cryptApiConfig?.merchantAddresses?.['trc20/usdt'] || '',
                  addr_usdt_erc20: cryptApiConfig?.merchantAddresses?.['erc20/usdt'] || '',
                  enable_btc: cryptApiConfig?.enabledCoins?.btc !== false,
                  enable_ltc: cryptApiConfig?.enabledCoins?.ltc === true,
                  enable_usdt_bep20: cryptApiConfig?.enabledCoins?.['bep20/usdt'] !== false,
                  enable_usdt_trc20: cryptApiConfig?.enabledCoins?.['trc20/usdt'] === true,
                  enable_usdt_erc20: cryptApiConfig?.enabledCoins?.['erc20/usdt'] === true,
                  enable_eth: cryptApiConfig?.enabledCoins?.eth === true,
                  enable_sol: cryptApiConfig?.enabledCoins?.['sol/sol'] === true,
                  enable_pol: cryptApiConfig?.enabledCoins?.['polygon/pol'] === true
                }}
                onSubmit={handleSaveCryptApiConfig}
                submitText="Lưu cấu hình CryptAPI"
                loading={saving}
                columns={2}
              />
            </CardContent>
          </Card>
        </TabsContent>



        {/* Pricing Configuration Tab */}
        <TabsContent value="pricing">
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader className="bg-indigo-50 dark:bg-indigo-950/20">
              <CardTitle className="flex items-center text-indigo-700 dark:text-indigo-300">
                <Tag className="h-5 w-5 mr-2" />
                Bảng giá - Pricing Tiers
              </CardTitle>
              <CardDescription>
                Thiết lập giá kiểm tra thẻ tín dụng theo từng loại và cấu hình các gói giảm giá cho khách hàng VIP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SharedForm
                fields={pricingConfigFields}
                initialData={pricingConfig || {}}
                onSubmit={handleSavePricingConfig}
                submitText="Lưu cấu hình"
                loading={saving}
                columns={2}
              />

              {/* Bảng giá theo số lượng thẻ */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Bảng giá theo số lượng thẻ</h3>
                <div className="space-y-3">
                  {pricingTiers.map((tier, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-lg items-center">
                      <div className="text-sm text-muted-foreground">
                        {idx === 0 ? 'Từ 1 thẻ' : `Từ ${((pricingTiers[idx-1].max||0)+1).toLocaleString()} thẻ`}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Tối đa</span>
                        <input
                          type="number"
                          className="w-40 border rounded px-2 py-1"
                          value={tier.max ?? ''}
                          placeholder="∞"
                          onChange={(e) => {
                            const v = e.target.value
                            setPricingTiers(prev => prev.map((t, i) => i === idx ? { ...t, max: v === '' ? null : Number(v) } : t))
                          }}
                        />
                        <span className="text-sm">thẻ</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Tổng giá</span>
                        <input
                          type="number"
                          className="w-40 border rounded px-2 py-1"
                          value={tier.total}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setPricingTiers(prev => prev.map((t, i) => i === idx ? { ...t, total: v } : t))
                          }}
                        />
                        <span className="text-sm">$</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPricingTiers(prev => [...prev, { max: null, total: 0 }])}>Thêm dòng</Button>
                    <Button onClick={handleSavePricingTiers} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu bảng giá'}</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Configuration Tab */}
        <TabsContent value="payment">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="bg-green-50 dark:bg-green-950/20">
              <CardTitle className="flex items-center text-green-700 dark:text-green-300">
                <CreditCard className="h-5 w-5 mr-2" />
                Thanh toán - Credit & Payment Settings
              </CardTitle>
              <CardDescription>
                Quản lý tỷ giá quy đổi USD sang Credit, cấu hình các gói nạp tiền và bật/tắt hiển thị menu thanh toán
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentConfig && (
                <PaymentConfigForm
                  config={paymentConfig}
                  onSave={handleSavePaymentConfig}
                  saving={saving}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <div className="space-y-6">
            <Card className="border-l-4 border-l-gray-500">
              <CardHeader className="bg-gray-50 dark:bg-gray-950/20">
                <CardTitle className="flex items-center text-gray-700 dark:text-gray-300">
                  <Eye className="h-5 w-5 mr-2" />
                  Preview - Xem trước cấu hình
                </CardTitle>
                <CardDescription>
                  Xem trước cách website hiển thị trên Google, mạng xã hội và kiểm tra tất cả cấu hình đã thiết lập
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Google Search Preview */}
                <div>
                  <h3 className="font-semibold mb-2">Google Search Result</h3>
                  <div className="border rounded-lg p-4 bg-white">
                    <div className="text-blue-600 text-lg hover:underline cursor-pointer">
                      {siteConfig?.seoTitle || 'SEO Title'}
                    </div>
                    <div className="text-green-700 text-sm">
                      https://example.com
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      {siteConfig?.seoDescription || 'SEO Description'}
                    </div>
                  </div>
                </div>

                {/* Facebook Preview */}
                <div>
                  <h3 className="font-semibold mb-2">Facebook Share Preview</h3>
                  <div className="border rounded-lg overflow-hidden bg-white max-w-md">
                    {siteConfig?.ogImage && (
                      <img
                        src={siteConfig.ogImage}
                        alt="OG Preview"
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-4">
                      <div className="font-semibold text-gray-900">
                        {siteConfig?.ogTitle || 'Open Graph Title'}
                      </div>
                      <div className="text-gray-600 text-sm mt-1">
                        {siteConfig?.ogDescription || 'Open Graph Description'}
                      </div>
                      <div className="text-gray-500 text-xs mt-2 uppercase">
                        example.com
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Pricing Preview */}
                <div>
                  <h3 className="font-semibold mb-2">Bảng giá hiện tại</h3>
                  <div className="border rounded-lg p-4">
                    <div className="text-lg font-semibold">
                      {pricingConfig?.pricePerCard?.toLocaleString()} {pricingConfig?.currency} / thẻ
                    </div>
                    {pricingConfig?.bulkDiscounts && pricingConfig.bulkDiscounts.length > 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Có {pricingConfig.bulkDiscounts.length} gói giảm giá
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Payment Config Form Component
function PaymentConfigForm({ config, onSave, saving }: {
  config: PaymentConfig;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState(config)

  useEffect(() => {
    setFormData(config)
  }, [config])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const addPackage = () => {
    const newId = Math.max(...formData.creditPackages.map(p => p.id), 0) + 1
    setFormData(prev => ({
      ...prev,
      creditPackages: [...prev.creditPackages, {
        id: newId,
        name: '',
        credits: 0,
        price: 0,
        popular: false
      }]
    }))
  }

  const removePackage = (id: number) => {
    setFormData(prev => ({
      ...prev,
      creditPackages: prev.creditPackages.filter(p => p.id !== id)
    }))
  }

  const updatePackage = (id: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      creditPackages: prev.creditPackages.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Conversion Rate */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="usdToCreditRate">Tỷ giá USD → Credit</Label>
          <Input
            id="usdToCreditRate"
            type="number"
            step="0.1"
            value={formData.usdToCreditRate}
            onChange={(e) => setFormData(prev => ({ ...prev, usdToCreditRate: parseFloat(e.target.value) || 0 }))}
          />
          <p className="text-sm text-muted-foreground mt-1">
            1 USD = {formData.usdToCreditRate} Credits
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showBuyCredits"
              checked={formData.showBuyCredits}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showBuyCredits: !!checked }))}
            />
            <Label htmlFor="showBuyCredits">Hiển thị menu "Mua Credits"</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showCryptoPayment"
              checked={formData.showCryptoPayment}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showCryptoPayment: !!checked }))}
            />
            <Label htmlFor="showCryptoPayment">Hiển thị menu "Crypto Payment"</Label>
          </div>
        </div>
      </div>

      {/* Deposit Limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="minDepositAmount">Số tiền nạp tối thiểu ($)</Label>
          <Input
            id="minDepositAmount"
            type="number"
            step="0.01"
            value={formData.minDepositAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, minDepositAmount: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <Label htmlFor="maxDepositAmount">Số tiền nạp tối đa ($)</Label>
          <Input
            id="maxDepositAmount"
            type="number"
            step="0.01"
            value={formData.maxDepositAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, maxDepositAmount: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      {/* Credit Packages */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>Gói Credits</Label>
          <Button type="button" variant="outline" onClick={addPackage}>
            Thêm gói
          </Button>
        </div>
        <div className="space-y-4">
          {formData.creditPackages.map((pkg) => (
            <div key={pkg.id} className="grid grid-cols-5 gap-4 items-end p-4 border rounded-lg">
              <div>
                <Label>Tên gói</Label>
                <Input
                  value={pkg.name}
                  onChange={(e) => updatePackage(pkg.id, 'name', e.target.value)}
                  placeholder="VD: Starter"
                />
              </div>
              <div>
                <Label>Credits</Label>
                <Input
                  type="number"
                  value={pkg.credits}
                  onChange={(e) => updatePackage(pkg.id, 'credits', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Giá ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pkg.price}
                  onChange={(e) => updatePackage(pkg.id, 'price', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={pkg.popular}
                  onCheckedChange={(checked) => updatePackage(pkg.id, 'popular', !!checked)}
                />
                <Label>Phổ biến</Label>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removePackage(pkg.id)}
              >
                Xóa
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
      </Button>
    </form>
  )
}
