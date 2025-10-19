import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth'

type SocketEventHandler = (data: any) => void

interface UseSocketOptions {
  enabled?: boolean
  debug?: boolean
}

/**
 * Custom hook để manage Socket.IO connection
 * Fallback gracefully nếu Socket.IO không available
 * Không gây lỗi nếu connection fail
 * 
 * Hiện tại là stub implementation - có thể integrate Socket.IO sau
 */
export function useSocket(options: UseSocketOptions = {}) {
  const { enabled = true, debug = false } = options
  const { token } = useAuthStore()
  const listenersRef = useRef<Map<string, Set<SocketEventHandler>>>(new Map())
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Setup polling fallback nếu Socket.IO không available
  useEffect(() => {
    if (!enabled || !token) return

    // Polling fallback - check user balance mỗi 30 giây
    const pollData = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.data?.user) {
            // Trigger balance-changed event nếu có listeners
            const balanceListeners = listenersRef.current.get('user:balance-changed')
            if (balanceListeners && balanceListeners.size > 0) {
              balanceListeners.forEach(handler => {
                try {
                  handler(data.data.user)
                } catch (err) {
                  console.error('[Socket] Error in balance listener:', err)
                }
              })
            }
          }
        }
      } catch (error) {
        if (debug) console.warn('[Socket Polling] Error:', error)
      }
    }

    // Poll mỗi 30 giây
    pollIntervalRef.current = setInterval(pollData, 30000)

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [enabled, token, debug])

  // Subscribe to an event
  const on = useCallback((event: string, handler: SocketEventHandler) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set())
    }

    listenersRef.current.get(event)?.add(handler)

    // Return unsubscribe function
    return () => {
      listenersRef.current.get(event)?.delete(handler)
    }
  }, [])

  // Emit an event (fallback không hoạt động vì không có backend Socket.IO)
  const emit = useCallback((event: string, data?: any) => {
    if (debug) console.log(`[Socket Emit - Fallback] ${event}:`, data)
    // Fallback: không emit được, chỉ log
  }, [debug])

  // Get connection status
  const isConnected = useCallback(() => {
    return true // Fallback luôn return true vì dùng polling
  }, [])

  return {
    on,
    emit,
    isConnected,
    socket: null
  }
}

