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
  // Endpoint (domain) and optional path for Socket.IO
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const socketPath = (process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io') as string

  // Load endpoint from public config if not set by env
  useEffect(() => {
    if (!enabled) return
    
    // In production behind reverse proxy, always use current origin
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/$/, '')
      setEndpoint(origin)
      return
    }
    
    // Fallback for SSR
    setEndpoint('')
  }, [enabled])

  // Lazy connect when endpoint available
  useEffect(() => {
    if (!enabled) return
    if (!endpoint) return

    try {
      const s = io(endpoint, {
        // Use WebSocket for realtime connection
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        withCredentials: true,
        auth: token ? { token, userId: user?.id } : {},
        query: user?.id ? { userId: user.id } : {},
        path: socketPath,
        upgrade: false,
        autoConnect: true
      })

      socketRef.current = s
      
      s.on('connect', () => { 
        setConnected(true)
      })
      
      s.on('disconnect', () => { 
        setConnected(false)
      })
      
      s.on('connect_error', () => {
        // Silent fail
      })

      return () => { 
        try { 
          s.removeAllListeners()
          s.disconnect() 
        } catch {} 
      }
    } catch (e) {
      // Silent fail
    }
  }, [enabled, token, user?.id, debug, endpoint, socketPath])

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

  return { on, emit, isConnected, socket: socketRef.current, connected }
}

