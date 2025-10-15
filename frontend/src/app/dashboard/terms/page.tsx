'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/components/I18nProvider'
import { 
  FileText, 
  Shield, 
  AlertTriangle, 
  Users, 
  CreditCard,
  Lock,
  Globe,
  Mail
} from 'lucide-react'

export default function TermsPage() {
  const { t } = useI18n()

  const sections = [
    {
      id: 'acceptance',
      title: 'Acceptance of Terms',
      icon: <FileText className="h-5 w-5" />,
      content: `By accessing and using our credit card checking and generation services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.

These terms constitute a legally binding agreement between you and our company. We reserve the right to modify these terms at any time, and such modifications will be effective immediately upon posting.`
    },
    {
      id: 'services',
      title: 'Description of Services',
      icon: <CreditCard className="h-5 w-5" />,
      content: `Our platform provides the following services:

• Credit card validation and checking services
• Credit card generation for testing purposes only
• API access for developers
• User account management
• Payment processing for credits

All generated credit cards are for testing purposes only and should not be used for actual transactions. Our checking services are provided for educational and development purposes.`
    },
    {
      id: 'usage',
      title: 'Acceptable Use Policy',
      icon: <Shield className="h-5 w-5" />,
      content: `You agree to use our services only for lawful purposes and in accordance with these Terms. You shall not:

• Use the service for any illegal activities or fraud
• Attempt to circumvent security measures
• Share your account credentials with others
• Use generated cards for actual purchases
• Violate any applicable laws or regulations
• Interfere with the proper functioning of the service
• Attempt to gain unauthorized access to our systems

Violation of these terms may result in immediate termination of your account.`
    },
    {
      id: 'privacy',
      title: 'Privacy and Data Protection',
      icon: <Lock className="h-5 w-5" />,
      content: `We are committed to protecting your privacy and personal information:

• We collect only necessary information for service provision
• Your data is encrypted and stored securely
• We do not share your personal information with third parties
• You have the right to access, modify, or delete your data
• We comply with applicable data protection regulations
• Card data is processed securely and not stored permanently

For detailed information about our data practices, please refer to our Privacy Policy.`
    },
    {
      id: 'payments',
      title: 'Payment Terms',
      icon: <CreditCard className="h-5 w-5" />,
      content: `Payment terms for our credit-based system:

• Credits are purchased in advance and used for services
• All payments are processed securely through third-party providers
• Refunds are available within 30 days of purchase
• Unused credits do not expire
• Prices are subject to change with notice
• Payment disputes should be reported within 60 days
• We accept major credit cards, PayPal, and cryptocurrency

Credits are non-transferable between accounts.`
    },
    {
      id: 'liability',
      title: 'Limitation of Liability',
      icon: <AlertTriangle className="h-5 w-5" />,
      content: `To the maximum extent permitted by law:

• Our services are provided "as is" without warranties
• We are not liable for any indirect or consequential damages
• Our total liability is limited to the amount paid for services
• We do not guarantee 100% accuracy of card validation
• Users are responsible for compliance with applicable laws
• We are not responsible for third-party service interruptions

This limitation applies to all claims, whether based on contract, tort, or any other legal theory.`
    },
    {
      id: 'intellectual',
      title: 'Intellectual Property',
      icon: <Globe className="h-5 w-5" />,
      content: `All intellectual property rights in our services belong to us:

• Our software, algorithms, and documentation are proprietary
• You may not copy, modify, or distribute our technology
• User-generated content remains your property
• You grant us license to use your content for service provision
• Trademarks and logos are our exclusive property
• API access does not grant intellectual property rights

Unauthorized use of our intellectual property is prohibited.`
    },
    {
      id: 'termination',
      title: 'Account Termination',
      icon: <Users className="h-5 w-5" />,
      content: `Either party may terminate the service relationship:

• You may close your account at any time
• We may suspend or terminate accounts for violations
• Termination does not affect accrued obligations
• Upon termination, access to services will cease
• Data may be retained as required by law
• Unused credits may be refunded at our discretion

We will provide reasonable notice before termination except in cases of serious violations.`
    },
    {
      id: 'contact',
      title: 'Contact Information',
      icon: <Mail className="h-5 w-5" />,
      content: `For questions about these Terms of Service, please contact us:

Email: legal@example.com
Support: support@example.com
Address: 123 Business Street, City, State 12345

We aim to respond to all inquiries within 48 hours during business days.

Last updated: ${new Date().toLocaleDateString()}`
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" />
          {t('terms.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('terms.description')}
        </p>
      </div>

      {/* Last Updated */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Effective date: {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Version 1.0
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms Sections */}
      <div className="space-y-6">
        {sections.map((section, index) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {section.icon}
                <span>{index + 1}. {section.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {section.content.split('\n\n').map((paragraph, pIndex) => (
                  <div key={pIndex} className="mb-4">
                    {paragraph.split('\n').map((line, lIndex) => (
                      <div key={lIndex}>
                        {line.startsWith('•') ? (
                          <div className="flex items-start space-x-2 mb-1">
                            <span className="text-primary mt-1">•</span>
                            <span>{line.substring(2)}</span>
                          </div>
                        ) : (
                          <p className={line.trim() === '' ? 'mb-2' : 'mb-2'}>
                            {line}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agreement Notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-primary mb-2">Important Notice</h3>
              <p className="text-sm text-muted-foreground">
                By continuing to use our services, you acknowledge that you have read, understood, 
                and agree to be bound by these Terms of Service. If you have any questions or 
                concerns about these terms, please contact our legal team before using our services.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
