'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/I18nProvider'
import { useToast } from '@/hooks/use-toast'
import { 
  Code, 
  Copy, 
  Key, 
  Globe, 
  Shield, 
  Zap,
  CheckCircle,
  AlertCircle,
  Book
} from 'lucide-react'

export default function ApiDocsPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(id)
      setTimeout(() => setCopiedCode(null), 2000)
      toast({
        title: t('common.success'),
        description: 'Code copied to clipboard'
      })
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Failed to copy code',
        variant: "destructive"
      })
    }
  }

  const endpoints = [
    {
      method: 'POST',
      path: '/api/auth/login',
      title: 'Login',
      description: 'Authenticate to get a JWT token',
      requestBody: {
        login: 'string (required) - username or email',
        password: 'string (required)'
      },
      response: {
        token: 'string - Bearer token',
        refreshToken: 'string'
      }
    },
    {
      method: 'POST',
      path: '/api/checker/start',
      title: 'Start card checking session',
      description: 'Submit a list of cards to check. Returns a sessionId to poll results. Billing is per-successfully-checked card in credits.',
      requestBody: {
        cards: 'array|string (required) - Array of objects {cardNumber, expiryMonth, expiryYear, cvv} or text lines cc|mm|yy|cvv',
        checkType: 'number (optional) - 1=Live, 2=Charge'
      },
      response: {
        sessionId: 'string',
        pricePerCard: 'number - credits per card based on pricing tiers',
        total: 'number - total cards received'
      }
    },
    {
      method: 'GET',
      path: '/api/checker/status/:sessionId',
      title: 'Get session status',
      description: 'Poll progress and latest results for a session',
      response: {
        session: '{ status, progress, live, die, unknown, pricePerCard, billedAmount }',
        results: 'array - latest items { card, status, response }'
      }
    },
    {
      method: 'POST',
      path: '/api/cards/generate',
      title: 'Generate Credit Cards (test tool)',
      description: 'Generate valid-format cards for testing UI only',
      requestBody: {
        bin: 'string (required) - 6-8 digit BIN',
        quantity: 'number (required) - Number of cards (1-100)',
        month: 'string (optional) - Expiry month',
        year: 'string (optional) - Expiry year'
      }
    }
  ]

  const codeExamples = {
    javascript: `// JavaScript/Node.js Example - start a checking session
const response = await fetch('https://checkcc.live/api/checker/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    cards: [
      { cardNumber: '4532123456789012', expiryMonth: '12', expiryYear: '2025', cvv: '123' }
    ],
    checkType: 1
  })
});

const data = await response.json();
console.log(data);`,

    python: `# Python Example - poll session status
import requests

session_id = "YOUR_SESSION_ID"
url = f"https://checkcc.live/api/checker/status/{session_id}"
headers = {
    "Authorization": "Bearer YOUR_JWT_TOKEN"
}
response = requests.get(url, headers=headers)
result = response.json()
print(result)`,

    curl: `# cURL Example
curl -X POST https://api.example.com/api/cards/check \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "card": "4532123456789012|12|2025|123"
  }'`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Book className="h-8 w-8 text-primary" />
          {t('apiDocs.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('apiDocs.description')}
        </p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Start
          </CardTitle>
          <CardDescription>
            Get started with our API in minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Key className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">1. Get API Key</div>
                <div className="text-sm text-muted-foreground">Register and get your API key</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Code className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">2. Make Request</div>
                <div className="text-sm text-muted-foreground">Send HTTP requests to our endpoints</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">3. Get Results</div>
                <div className="text-sm text-muted-foreground">Receive JSON responses</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All API requests require authentication using Bearer tokens. Include your API key in the Authorization header.
          </p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            Authorization: Bearer YOUR_API_KEY
          </div>
        </CardContent>
      </Card>

      {/* Base URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Base URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            https://checkcc.live/api
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">API Endpoints</h2>
        {endpoints.map((endpoint, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={endpoint.method === 'GET' ? 'default' : 'secondary'}>
                  {endpoint.method}
                </Badge>
                <code className="text-sm">{endpoint.path}</code>
              </CardTitle>
              <CardDescription>{endpoint.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{endpoint.title}</h4>
                <p className="text-sm text-muted-foreground">{endpoint.description}</p>
              </div>
              
              {endpoint.requestBody && (
                <div>
                  <h4 className="font-medium mb-2">Request Body</h4>
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    <pre>{JSON.stringify(endpoint.requestBody, null, 2)}</pre>
                  </div>
                </div>
              )}
              
              {endpoint.response && (
                <div>
                  <h4 className="font-medium mb-2">Response</h4>
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    <pre>{JSON.stringify(endpoint.response, null, 2)}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Code Examples */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Code Examples</h2>
        {Object.entries(codeExamples).map(([language, code]) => (
          <Card key={language}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="capitalize">{language}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyCode(code, language)}
                >
                  {copiedCode === language ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{code}</code>
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 border rounded">
              <code>400</code>
              <span className="text-sm">Bad Request - Invalid parameters</span>
            </div>
            <div className="flex justify-between items-center p-2 border rounded">
              <code>401</code>
              <span className="text-sm">Unauthorized - Invalid API key</span>
            </div>
            <div className="flex justify-between items-center p-2 border rounded">
              <code>429</code>
              <span className="text-sm">Too Many Requests - Rate limit exceeded</span>
            </div>
            <div className="flex justify-between items-center p-2 border rounded">
              <code>500</code>
              <span className="text-sm">Internal Server Error</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
