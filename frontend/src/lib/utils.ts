import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency
export function formatCurrency(amount: number, currency = '$'): string {
  return `${currency}${amount.toFixed(2)}`
}

// Format number with commas
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

// Format date
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days} ngày trước`
  if (hours > 0) return `${hours} giờ trước`
  if (minutes > 0) return `${minutes} phút trước`
  return 'Vừa xong'
}

// Mask card number
export function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 8) return cardNumber
  const first4 = cardNumber.slice(0, 4)
  const last4 = cardNumber.slice(-4)
  const middle = '*'.repeat(cardNumber.length - 8)
  return `${first4}${middle}${last4}`
}

// Validate card number using Luhn algorithm
export function validateCardNumber(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\D/g, '')
  
  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    return false
  }
  
  let sum = 0
  let isEven = false
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i])
    
    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    
    sum += digit
    isEven = !isEven
  }
  
  return sum % 10 === 0
}

// Get card brand from number
export function getCardBrand(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '')
  
  if (/^4/.test(cleanNumber)) return 'visa'
  if (/^5[1-5]/.test(cleanNumber)) return 'mastercard'
  if (/^3[47]/.test(cleanNumber)) return 'amex'
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover'
  if (/^35/.test(cleanNumber)) return 'jcb'
  if (/^30[0-5]/.test(cleanNumber)) return 'diners'
  
  return 'unknown'
}

// Generate random string
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (fallbackError) {
      document.body.removeChild(textArea)
      return false
    }
  }
}

// Download file
export function downloadFile(content: string, filename: string, type = 'text/plain'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Parse CSV
export function parseCSV(csv: string): string[][] {
  const lines = csv.split('\n')
  const result: string[][] = []
  
  for (const line of lines) {
    if (line.trim()) {
      const row = line.split(',').map(cell => cell.trim())
      result.push(row)
    }
  }
  
  return result
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Validate email
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate password strength
export function validatePassword(password: string): {
  isValid: boolean
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0
  
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('Mật khẩu phải có ít nhất 8 ký tự')
  }
  
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Mật khẩu phải có ít nhất 1 chữ thường')
  }
  
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Mật khẩu phải có ít nhất 1 chữ hoa')
  }
  
  if (/\d/.test(password)) {
    score += 1
  } else {
    feedback.push('Mật khẩu phải có ít nhất 1 số')
  }
  
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1
  } else {
    feedback.push('Mật khẩu phải có ít nhất 1 ký tự đặc biệt')
  }
  
  return {
    isValid: score >= 4,
    score,
    feedback
  }
}
