import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { I18nProvider } from '@/components/I18nProvider'
import DynamicHead from '@/components/DynamicHead'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Credit Card Checker - Hệ thống kiểm tra thẻ tín dụng',
  description: 'Hệ thống kiểm tra và quản lý thẻ tín dụng chuyên nghiệp với tính năng bảo mật cao',
  keywords: 'credit card, checker, validation, security, payment',
  authors: [{ name: 'Credit Card Checker Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'noindex, nofollow', // chặn index trên môi trường này
  icons: {
    // Dùng data URI mặc định để tránh 404; DynamicHead sẽ cập nhật icon thật sau khi tải cấu hình
    icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2J4LkAAAAASUVORK5CYII=',
    shortcut: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2J4LkAAAAASUVORK5CYII=',
    apple: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2J4LkAAAAASUVORK5CYII=',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="shortcut icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <DynamicHead />
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
