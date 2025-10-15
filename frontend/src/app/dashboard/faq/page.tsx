'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/components/I18nProvider'
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Search,
  CreditCard,
  DollarSign,
  Shield,
  Zap,
  Users,
  Settings
} from 'lucide-react'

interface FAQItem {
  id: string
  category: string
  question: string
  answer: string
  icon: React.ReactNode
}

export default function FAQPage() {
  const { t } = useI18n()
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const faqItems: FAQItem[] = [
    {
      id: '1',
      category: 'general',
      question: 'What is this credit card checking service?',
      answer: 'Our service provides credit card validation and generation tools for developers and businesses. We offer real-time card checking, BIN lookup, and test card generation for development purposes. All services are designed for legitimate testing and validation needs.',
      icon: <CreditCard className="h-5 w-5" />
    },
    {
      id: '2',
      category: 'general',
      question: 'Is it legal to use this service?',
      answer: 'Yes, our service is completely legal when used for legitimate purposes such as testing payment systems, validating card formats, and educational purposes. We do not support or condone any illegal activities. All generated cards are for testing only and cannot be used for actual purchases.',
      icon: <Shield className="h-5 w-5" />
    },
    {
      id: '3',
      category: 'pricing',
      question: 'How does the credit system work?',
      answer: 'Our platform uses a credit-based system where you purchase credits to use our services. Each card check or generation consumes a certain number of credits. Credits never expire and can be used at your own pace. You can purchase credits in various packages to suit your needs.',
      icon: <DollarSign className="h-5 w-5" />
    },
    {
      id: '4',
      category: 'pricing',
      question: 'What payment methods do you accept?',
      answer: 'We accept major credit cards (Visa, Mastercard, American Express), PayPal, and various cryptocurrencies including Bitcoin, Ethereum, and USDT. All payments are processed securely through industry-standard payment processors.',
      icon: <DollarSign className="h-5 w-5" />
    },
    {
      id: '5',
      category: 'technical',
      question: 'What card format should I use for checking?',
      answer: 'Our system uses the format: XXXXXXXXXXXXXXXX|MM|YYYY|CVV where X is the 16-digit card number, MM is the expiry month, YYYY is the expiry year, and CVV is the security code. This format ensures accurate validation and processing.',
      icon: <CreditCard className="h-5 w-5" />
    },
    {
      id: '6',
      category: 'technical',
      question: 'Do you provide an API?',
      answer: 'Yes, we offer a comprehensive REST API for developers. Our API supports card checking, generation, and account management. We provide detailed documentation, code examples in multiple languages, and dedicated support for API users.',
      icon: <Zap className="h-5 w-5" />
    },
    {
      id: '7',
      category: 'technical',
      question: 'What is the rate limit for API requests?',
      answer: 'API rate limits depend on your subscription plan. Free accounts have a limit of 100 requests per hour, while premium accounts can make up to 10,000 requests per hour. Enterprise customers can request custom rate limits based on their needs.',
      icon: <Zap className="h-5 w-5" />
    },
    {
      id: '8',
      category: 'account',
      question: 'How do I create an account?',
      answer: 'Creating an account is simple and free. Click the "Register" button, provide your email address, choose a secure password, and verify your email. Once verified, you can start using our services immediately with free starter credits.',
      icon: <Users className="h-5 w-5" />
    },
    {
      id: '9',
      category: 'account',
      question: 'Can I change my account information?',
      answer: 'Yes, you can update your account information anytime from the Settings page. You can change your username, email address, password, and profile information. Some changes may require email verification for security purposes.',
      icon: <Settings className="h-5 w-5" />
    },
    {
      id: '10',
      category: 'account',
      question: 'How do I delete my account?',
      answer: 'To delete your account, go to Settings > Account > Delete Account. This action is permanent and will remove all your data, transaction history, and remaining credits. Please contact support if you need assistance with account deletion.',
      icon: <Users className="h-5 w-5" />
    },
    {
      id: '11',
      category: 'security',
      question: 'How secure is my data?',
      answer: 'We take security very seriously. All data is encrypted in transit and at rest using industry-standard encryption. We do not store actual credit card numbers permanently, and all sensitive operations are logged and monitored. We comply with PCI DSS standards.',
      icon: <Shield className="h-5 w-5" />
    },
    {
      id: '12',
      category: 'security',
      question: 'Do you store credit card information?',
      answer: 'No, we do not store actual credit card information. Our checking service validates cards in real-time and only stores validation results. Generated test cards are created algorithmically and are not linked to any real accounts or financial institutions.',
      icon: <Shield className="h-5 w-5" />
    }
  ]

  const categories = [
    { id: 'all', name: 'All Questions', icon: <HelpCircle className="h-4 w-4" /> },
    { id: 'general', name: 'General', icon: <HelpCircle className="h-4 w-4" /> },
    { id: 'pricing', name: 'Pricing & Credits', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'technical', name: 'Technical', icon: <Zap className="h-4 w-4" /> },
    { id: 'account', name: 'Account', icon: <Users className="h-4 w-4" /> },
    { id: 'security', name: 'Security', icon: <Shield className="h-4 w-4" /> }
  ]

  const filteredFAQs = faqItems.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-primary" />
          {t('faq.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('faq.description')}
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('faq.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.icon}
                  <span className="ml-2">{category.name}</span>
                  <span className="ml-auto text-xs">
                    {category.id === 'all' 
                      ? faqItems.length 
                      : faqItems.filter(item => item.category === category.id).length
                    }
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* FAQ Items */}
        <div className="lg:col-span-3 space-y-4">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((item) => (
              <Card key={item.id}>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpanded(item.id)}
                >
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.question}</span>
                    </div>
                    {expandedItems.includes(item.id) ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </CardTitle>
                </CardHeader>
                {expandedItems.includes(item.id) && (
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {item.answer}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No questions found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or browse different categories.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Contact Support */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Still have questions?</h3>
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <Button>
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
