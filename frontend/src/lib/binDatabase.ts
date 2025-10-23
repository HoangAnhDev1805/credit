// BIN Database lookup utility
// Parses databin.txt and provides BIN matching functionality

export interface BinInfo {
  bin: string
  type: 'CREDIT' | 'DEBIT' | 'UNKNOWN'
  typeCheck: number // 1 = CREDIT, 2 = DEBIT
  level: string
  bank: string
  country: string
}

// Cached BIN database
let binDatabase: Map<string, BinInfo> | null = null
let binDataRaw: string | null = null

/**
 * Load and parse BIN database from databin.txt content
 */
export function loadBinDatabase(databinContent: string): void {
  binDataRaw = databinContent
  binDatabase = new Map()
  
  const lines = databinContent.split('\n')
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    try {
      // Format: 400000 - TYPE:  CREDIT  | LEVEL:  TRADITIONAL  | BANK: xxx - COUNTRY
      // Extract BIN
      const binMatch = line.match(/^(\d{6})/)
      if (!binMatch) continue
      const bin = binMatch[1]
      
      // Extract TYPE
      const typeMatch = line.match(/TYPE:\s*(\w+)/)
      const type = typeMatch ? typeMatch[1].toUpperCase() : 'UNKNOWN'
      
      // Extract LEVEL
      const levelMatch = line.match(/LEVEL:\s*([^|]+)\|/)
      const level = levelMatch ? levelMatch[1].trim() : 'UNKNOWN'
      
      // Extract BANK and COUNTRY (after last |)
      const bankCountryMatch = line.match(/BANK:\s*(.+)$/)
      let bank = 'UNKNOWN'
      let country = 'UNKNOWN'
      
      if (bankCountryMatch) {
        const bankCountryFull = bankCountryMatch[1].trim()
        // Decode HTML entities
        const decoded = bankCountryFull
          .replace(/&amp;/g, '&')
          .replace(/&#039;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
        
        // Split by last " - " to separate bank and country
        const lastDashIndex = decoded.lastIndexOf(' - ')
        if (lastDashIndex !== -1) {
          bank = decoded.substring(0, lastDashIndex).trim()
          country = decoded.substring(lastDashIndex + 3).trim()
        } else {
          bank = decoded
        }
      }
      
      binDatabase.set(bin, {
        bin,
        type: type as 'CREDIT' | 'DEBIT',
        typeCheck: type === 'CREDIT' ? 1 : type === 'DEBIT' ? 2 : 0,
        level: level === '------' ? 'UNKNOWN' : level,
        bank: bank || 'UNKNOWN',
        country: country || 'UNKNOWN'
      })
    } catch (err) {
      // Skip malformed lines
      continue
    }
  }
  
  // Loaded successfully
}

/**
 * Get BIN info for a card number (first 6 digits)
 */
export function getBinInfo(cardNumber: string): BinInfo | null {
  if (!binDatabase) {
    return null
  }
  
  const bin = cardNumber.replace(/\D/g, '').substring(0, 6)
  
  if (bin.length < 6) return null
  
  return binDatabase.get(bin) || null
}

/**
 * Enrich card data with BIN info (only fill missing fields)
 * Returns empty string "" if BIN not found, instead of "UNKNOWN"
 */
export function enrichCardWithBin(card: any): any {
  const binInfo = getBinInfo(card.cardNumber || card.fullCard || card.card || '')
  
  // If no BIN info found, return card with empty strings for missing fields
  if (!binInfo) {
    return {
      ...card,
      type: card.type || '',
      typeCheck: card.typeCheck || 0,
      level: card.level || '',
      bank: card.bank || '',
      country: card.country || '',
      bin: card.bin || ''
    }
  }
  
  return {
    ...card,
    // Only update if missing or unknown, otherwise keep original
    // If original is empty/null/UNKNOWN and BIN has data → use BIN
    // If original has data → keep original
    // If both empty → empty string (not "UNKNOWN")
    type: card.type && card.type !== 'UNKNOWN' ? card.type : (binInfo.type || ''),
    typeCheck: card.typeCheck ? card.typeCheck : (binInfo.typeCheck || 0),
    level: card.level && card.level !== 'UNKNOWN' && card.level !== '------' ? card.level : (binInfo.level || ''),
    bank: card.bank && card.bank !== 'UNKNOWN' ? card.bank : (binInfo.bank || ''),
    country: card.country && card.country !== 'UNKNOWN' ? card.country : (binInfo.country || ''),
    bin: card.bin || binInfo.bin || ''
  }
}

/**
 * Check if BIN database is loaded
 */
export function isBinDatabaseLoaded(): boolean {
  return binDatabase !== null && binDatabase.size > 0
}

/**
 * Get database stats
 */
export function getBinDatabaseStats() {
  return {
    loaded: isBinDatabaseLoaded(),
    count: binDatabase?.size || 0
  }
}
