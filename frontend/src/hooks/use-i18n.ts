// Simple i18n hook for translations
export function useI18n() {
  const t = (key: string) => {
    // Simple translation mapping
    const translations: Record<string, string> = {
      'common.error': 'Error',
      'common.success': 'Success',
      'checker.messages.copied': 'Copied',
      'checker.messages.noCards': 'No cards to check',
      'checker.messages.checkingStarted': 'Checking started',
      'checker.stats.lines': 'lines',
      'checker.stats.cards': 'cards'
    }
    
    return translations[key] || key
  }
  
  return { t }
}
