import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/lib/auth'

type SocketEventHandler = (data: any) => void

interface UseSocketOptions {
  enabled?: boolean
  debug?: boolean
}

export function useSocket(options: UseSocketOptions = {}) {
  const { enabled = true, debug = false } = options
  const { token, user } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [endpoint, setEndpoint] = useState<string | null>(process.env.NEXT_PUBLIC_SOCKET_URL || null)

  // Load endpoint from public config if not set by env
  useEffect(() => {
    if (!enabled) return
    if (endpoint) return
    ;(async () => {
      try {
        const resp = await fetch('/api/config/public', { credentials: 'include' })
        if (resp.ok) {
          const js = await resp.json()
          const ep = js?.data?.general?.socket_url
          if (ep && typeof ep === 'string') setEndpoint(ep)
          else if (typeof window !== 'undefined') setEndpoint(window.location.origin)
        } else if (typeof window !== 'undefined') {
          setEndpoint(window.location.origin)
        }
      } catch {
        if (typeof window !== 'undefined') setEndpoint(window.location.origin)
      }
    })()
  }, [enabled, endpoint])

  // Lazy connect when endpoint available
  useEffect(() => {
    if (!enabled || !token) return
    if (!endpoint) return

    try {
      const s = io(endpoint, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: { token, userId: user?.id },
        query: { userId: user?.id }
      })

      socketRef.current = s
      s.on('connect', () => { setConnected(true); if (debug) console.log('[Socket] connected', s.id) })
      s.on('disconnect', () => { setConnected(false); if (debug) console.log('[Socket] disconnected') })

      return () => { try { s.disconnect() } catch {} }
    } catch (e) {
      if (debug) console.warn('[Socket] init error:', e)
    }
  }, [enabled, token, user?.id, debug, endpoint])

  const on = useCallback((event: string, handler: SocketEventHandler) => {
    const s = socketRef.current
    if (!s) return () => {}
    s.on(event, handler)
    return () => { try { s.off(event, handler) } catch {} }
  }, [])

  const emit = useCallback((event: string, data?: any) => {
    const s = socketRef.current
    if (!s) return
    try { s.emit(event, data) } catch (e) { if (debug) console.warn('[Socket emit]', e) }
  }, [debug])

  const isConnected = useCallback(() => connected, [connected])

  return { on, emit, isConnected, socket: socketRef.current }
}

