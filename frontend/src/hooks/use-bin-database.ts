import { useEffect, useState } from 'react'
import { loadBinDatabase, isBinDatabaseLoaded, getBinDatabaseStats } from '@/lib/binDatabase'

/**
 * Hook to load and manage BIN database
 */
export function useBinDatabase() {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // Check if already loaded
    if (isBinDatabaseLoaded()) {
      setLoaded(true)
      return
    }
    
    // Load database
    const loadDatabase = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('[useBinDatabase] Fetching databin.txt...')
        const response = await fetch('/databin.txt')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const text = await response.text()
        console.log('[useBinDatabase] Parsing BIN database...')
        
        loadBinDatabase(text)
        
        const stats = getBinDatabaseStats()
        console.log('[useBinDatabase] Loaded successfully:', stats)
        
        setLoaded(true)
      } catch (err: any) {
        console.error('[useBinDatabase] Failed to load:', err)
        setError(err.message || 'Failed to load BIN database')
      } finally {
        setLoading(false)
      }
    }
    
    loadDatabase()
  }, [])
  
  return { loading, loaded, error }
}
