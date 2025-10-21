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
import { Settings, Globe, DollarSign, Eye, CreditCard, Palette, Languages, Zap, Tag, Bitcoin, Shield, Share2, Twitter, Mail, Target } from 'lucide-react'
import { GateManager } from '@/components/admin/GateManager'

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
  telegramSupportUrl?: string
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
  creditPackages: Array<{ id: number; name: string; credits: number; price: number; popular: boolean; bonus?: number; isActive?: boolean; displayOrder?: number }>;
  minDepositAmount: number;
  maxDepositAmount: number;
  cryptoUsdPrices?: Record<string, number>;
}


export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('site')
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
  const [uiConfig, setUiConfig] = useState<UiConfig | null>(null)
  const [cryptApiConfig, setCryptApiConfig] = useState<CryptApiConfig | null>(null)

  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)

  // Pricing removed
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const { success, error: showError } = useToast()

  useEffect(() => {
    // Đảm bảo API client có token trước khi gọi các endpoint admin (tránh race khi rehydrate zustand)
    try {
      const t = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : ''
      if (t) apiClient.setToken(t)
    } catch {}
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const [siteResponse, uiResponse, cryptResponse, paymentResp] = await Promise.all([
        apiClient.get('/admin/site-config'),
        apiClient.get('/admin/ui-config'),
        apiClient.get('/admin/cryptapi-config'),
        apiClient.get('/admin/payment-config')
      ])

      setSiteConfig(siteResponse.data.data.siteConfig)
      setUiConfig(uiResponse.data.data.uiConfig)
      setCryptApiConfig(cryptResponse.data.data.cryptapi)

      setPaymentConfig(paymentResp.data.data.payment)

      // Pricing tiers removed
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

  // Pricing removed

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



  // Pricing removed

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


  // Gom nhóm field theo section (UI-only). Lưu ý: KHÔNG thay đổi logic dữ liệu.
  const brandingFields: FormField[] = [
    { name: 'logo', label: 'Logo Website', type: 'image', placeholder: 'Tải lên logo website (PNG, SVG khuyến nghị)' },
    { name: 'favicon', label: 'Favicon', type: 'image', placeholder: 'Tải lên favicon (ICO, PNG 32x32px)' },
    { name: 'thumbnail', label: 'Thumbnail Website', type: 'image', placeholder: 'Hình đại diện website (1200x630px khuyến nghị). Ảnh này cũng được dùng cho Open Graph & Twitter.' },
    { name: 'siteName', label: 'Tên website', type: 'text', required: true, placeholder: 'VD: Credit Card Checker' },
  ]

  const seoBasicFields: FormField[] = [
    { name: 'seoTitle', label: 'SEO Title', type: 'text', placeholder: 'Tiêu đề hiển thị trên search engine' },
    { name: 'seoDescription', label: 'SEO Description', type: 'textarea', placeholder: 'Mô tả hiển thị trên search engine' },
    { name: 'siteKeywords', label: 'Từ khóa SEO', type: 'text', placeholder: 'credit card, checker, validation' },
    { name: 'canonicalUrl', label: 'Canonical URL (base domain)', type: 'text', placeholder: 'https://checkcc.live', description: 'URL gốc của website. Dùng để tạo canonical cho mọi trang.' },
  ]

  const robotsFields: FormField[] = [
    { name: 'robotsIndex', label: 'Cho phép Index', type: 'switch' },
    { name: 'robotsFollow', label: 'Cho phép Follow', type: 'switch' },
    { name: 'robotsAdvanced', label: 'Robots nâng cao', type: 'text', placeholder: 'max-snippet:-1, max-image-preview:large', description: 'Tùy chọn nâng cao: max-snippet, max-image-preview, max-video-preview, noarchive ...' },
  ]

  const ogFields: FormField[] = [
    { name: 'ogTitle', label: 'Open Graph Title', type: 'text', placeholder: 'Tiêu đề khi share trên social media' },
    { name: 'ogDescription', label: 'Open Graph Description', type: 'textarea', placeholder: 'Mô tả khi share trên social media' },
    { name: 'ogType', label: 'OG Type', type: 'text', placeholder: 'website' },
    { name: 'ogSiteName', label: 'OG Site Name', type: 'text', placeholder: 'Tên trang trên OG' },
    // Không có ogImage (tận dụng thumbnail)
  ]

  const twitterFields: FormField[] = [
    { name: 'twitterCard', label: 'Twitter Card', type: 'text', placeholder: 'summary_large_image' },
    { name: 'twitterSite', label: 'Twitter @site', type: 'text', placeholder: '@yourbrand' },
    { name: 'twitterCreator', label: 'Twitter @creator', type: 'text', placeholder: '@creator' },
    // Không có twitterImage (tận dụng thumbnail)
  ]

  const contactFields: FormField[] = [
    { name: 'contactEmail', label: 'Email liên hệ', type: 'email', placeholder: 'contact@example.com' },
    { name: 'supportPhone', label: 'Số điện thoại hỗ trợ', type: 'text', placeholder: '+84 123 456 789' },
    { name: 'telegramSupportUrl', label: 'Telegram hỗ trợ', type: 'text', placeholder: 'https://t.me/yourgroup', description: 'URL nhóm Telegram hoặc bot hỗ trợ' },
    { name: 'address', label: 'Địa chỉ', type: 'textarea', placeholder: 'Địa chỉ công ty...' },
    { name: 'footerText', label: 'Text footer', type: 'textarea', placeholder: 'Copyright text và thông tin khác...' },
  ]

  // Pricing removed

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
        <TabsList className="flex w-full gap-2 overflow-x-auto md:grid md:grid-cols-3 lg:grid-cols-7 md:overflow-visible px-1">
          <TabsTrigger value="site" className="shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Globe className="h-4 w-4 mr-2" />
            <div className="text-left min-w-0">
              <div className="font-medium truncate">Cấu hình chung</div>
              <div className="text-xs opacity-70 truncate">Site & SEO</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="language" className="shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
            <Languages className="h-4 w-4 mr-2" />
            <div className="text-left min-w-0">
              <div className="font-medium truncate">Giao diện</div>
              <div className="text-xs opacity-70 truncate">UI & Ngôn ngữ</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="payment" className="shrink-0 min-w-[140px] md:min-w-0 data-[state=active]:bg-green-500 data-[state=active]:text-white">
            <CreditCard className="h-4 w-4 mr-2" />
            <div className="text-left min-w-0">
              <div className="font-medium truncate">Thanh toán</div>
              <div className="text-xs opacity-70 truncate">Credit & Payment</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="cryptapi" className="shrink-0 min-w-[140px] md:min-w-0 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <Bitcoin className="h-4 w-4 mr-2" />
            <div className="text-left min-w-0">
              <div className="font-medium truncate">API & Tích hợp</div>
              <div className="text-xs opacity-70 truncate">CryptAPI</div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="gate" className="shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-pink-500 data-[state=active]:text-white">
            <Target className="h-4 w-4 mr-2" />
            <div className="text-left min-w-0">
              <div className="font-medium truncate">GATE</div>
              <div className="text-xs opacity-70 truncate">Check Gates</div>
            </div>
          </TabsTrigger>

          {/* Pricing tab removed */}

          <TabsTrigger value="preview" className="shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-gray-500 data-[state=active]:text-white">
            <Eye className="h-4 w-4 mr-2" />
            <div className="text-left min-w-0">
              <div className="font-medium truncate">Preview</div>
              <div className="text-xs opacity-70 truncate">Xem trước</div>
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
                Quản lý thông tin cơ bản của website, logo, favicon và cấu hình SEO. Ảnh OG/Twitter sẽ tự dùng Thumbnail, favicon dùng Logo khi không đặt riêng.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Branding & Logo */}
              <details className="group border rounded-lg" open>
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-blue-50/60 dark:bg-blue-950/20">
                  <Palette className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-700 dark:text-blue-300">Branding & Logo</span>
                </summary>
                <div className="p-4">
                  <SharedForm
                    fields={brandingFields}
                    initialData={siteConfig || {}}
                    onSubmit={handleSaveSiteConfig}
                    submitText="Lưu Branding"
                    loading={saving}
                    columns={2}
                  />
                </div>
              </details>

              {/* SEO cơ bản */}
              <details className="group border rounded-lg" open>
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-green-50/60 dark:bg-green-950/20">
                  <Settings className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-300">SEO cơ bản</span>
                </summary>
                <div className="p-4">
                  <SharedForm
                    fields={seoBasicFields}
                    initialData={siteConfig || {}}
                    onSubmit={handleSaveSiteConfig}
                    submitText="Lưu SEO cơ bản"
                    loading={saving}
                    columns={2}
                  />
                </div>
              </details>

              {/* Robots & Indexing */}
              <details className="group border rounded-lg" open>
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-orange-50/60 dark:bg-orange-950/20">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-700 dark:text-orange-300">Robots & Indexing</span>
                </summary>
                <div className="p-4">
                  <SharedForm
                    fields={robotsFields}
                    initialData={siteConfig || {}}
                    onSubmit={handleSaveSiteConfig}
                    submitText="Lưu Robots"
                    loading={saving}
                    columns={2}
                  />
                </div>
              </details>

              {/* Open Graph */}
              <details className="group border rounded-lg" open>
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-[#e7f0ff] dark:bg-blue-950/20">
                  <Share2 className="h-4 w-4 text-[#1877F2]" />
                  <span className="font-medium text-[#1877F2]">Open Graph (Facebook/LinkedIn)</span>
                </summary>
                <div className="p-4">
                  <SharedForm
                    fields={ogFields}
                    initialData={siteConfig || {}}
                    onSubmit={handleSaveSiteConfig}
                    submitText="Lưu Open Graph"
                    loading={saving}
                    columns={2}
                  />
                </div>
              </details>

              {/* Twitter Card */}
              <details className="group border rounded-lg" open>
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-[#E8F5FD] dark:bg-sky-950/20">
                  <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                  <span className="font-medium text-[#1DA1F2]">Twitter Card</span>
                </summary>
                <div className="p-4">
                  <SharedForm
                    fields={twitterFields}
                    initialData={siteConfig || {}}
                    onSubmit={handleSaveSiteConfig}
                    submitText="Lưu Twitter Card"
                    loading={saving}
                    columns={2}
                  />
                </div>
              </details>

              {/* Liên hệ & Footer */}
              <details className="group border rounded-lg" open>
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-purple-50/60 dark:bg-purple-950/20">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-700 dark:text-purple-300">Liên hệ & Footer</span>
                </summary>
                <div className="p-4">
                  <SharedForm
                    fields={contactFields}
                    initialData={siteConfig || {}}
                    onSubmit={handleSaveSiteConfig}
                    submitText="Lưu Liên hệ & Footer"
                    loading={saving}
                    columns={2}
                  />
                </div>
              </details>
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



        {/* GATE Configuration Tab */}
        <TabsContent value="gate">
          <Card className="border-l-4 border-l-pink-500">
            <CardHeader className="bg-pink-50 dark:bg-pink-950/20">
              <CardTitle className="flex items-center text-pink-700 dark:text-pink-300">
                <Target className="h-5 w-5 mr-2" />
                Cấu hình GATE - Check Gates
              </CardTitle>
              <CardDescription>
                Quản lý các GATE để kiểm tra thẻ. Mỗi gate có một giá trị TypeCheck riêng biệt.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <GateManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Configuration Tab removed */}

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
                    {siteConfig?.thumbnail && (
                      <img
                        src={siteConfig.thumbnail && (siteConfig.thumbnail.startsWith('http') ? siteConfig.thumbnail : (apiClient.getBaseUrl().replace('/api', '') + siteConfig.thumbnail))}
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
                      1 Credits / thẻ
                    </div>
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
    // B sung default cryptoUsdPrices nbfu ch a c8
    const defaults: Record<string, number> = { 'btc': 60000, 'eth': 3000, 'ltc': 70, 'trc20/usdt': 1, 'bep20/usdt': 1, 'erc20/usdt': 1, 'sol/sol': 150, 'polygon/pol': 0.7 }
    setFormData({
      ...config,
      cryptoUsdPrices: { ...defaults, ...(config.cryptoUsdPrices || {}) }
    })
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
        bonus: 0,
        popular: false,
        isActive: true,
        displayOrder: newId
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

      {/* Crypto USD Prices per coin */}
      <div className="space-y-3">
        <Label>Tỷ giá thị trường (USD cho 1 đơn vị coin)</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { key: 'btc', label: 'BTC (USD/BTC)' },
            { key: 'eth', label: 'ETH (USD/ETH)' },
            { key: 'ltc', label: 'LTC (USD/LTC)' },
            { key: 'trc20/usdt', label: 'USDT TRC20 (USD/USDT)' },
            { key: 'bep20/usdt', label: 'USDT BEP20 (USD/USDT)' },
            { key: 'erc20/usdt', label: 'USDT ERC20 (USD/USDT)' },
            { key: 'sol/sol', label: 'SOL (USD/SOL)' },
            { key: 'polygon/pol', label: 'POL (USD/POL)' },
          ].map((c) => (
            <div key={c.key}>
              <Label>{c.label}</Label>
              <Input
                type="number"
                step="0.00000001"
                value={Number((formData.cryptoUsdPrices?.[c.key] ?? 0).toString())}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setFormData(prev => ({
                    ...prev,
                    cryptoUsdPrices: { ...(prev.cryptoUsdPrices || {}), [c.key]: v }
                  }));
                }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Các tỷ giá này dùng để quy đổi số lượng crypto cần thanh toán từ USD.</p>
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
            <div key={pkg.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end p-4 border rounded-lg">
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
              <div>
                <Label>Bonus (%)</Label>
                <Input
                  type="number"
                  step="1"
                  value={pkg.bonus || 0}
                  onChange={(e) => updatePackage(pkg.id, 'bonus', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={pkg.popular}
                  onCheckedChange={(checked) => updatePackage(pkg.id, 'popular', !!checked)}
                />
                <Label>Phổ biến</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={pkg.isActive !== false}
                  onCheckedChange={(checked) => updatePackage(pkg.id, 'isActive', !!checked)}
                />
                <Label>Kích hoạt</Label>
              </div>
              <div>
                <Label>Thứ tự</Label>
                <Input
                  type="number"
                  value={pkg.displayOrder ?? 0}
                  onChange={(e) => updatePackage(pkg.id, 'displayOrder', parseInt(e.target.value) || 0)}
                />
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
