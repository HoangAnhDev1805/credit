// i18n configuration
class I18n {
  constructor() {
    this.currentLanguage = 'en'; // Default language
    this.translations = {};
    this.loadTranslations();

    // Initialize language from localStorage only on client side
    if (typeof window !== 'undefined') {
      this.currentLanguage = localStorage.getItem('language') || 'en';
    }
  }

  async loadTranslations() {
    try {
      const [en, vi] = await Promise.all([
        import('./locales/en.js'),
        import('./locales/vi.js')
      ]);
      
      this.translations = {
        en: en.default,
        vi: vi.default
      };
    } catch (error) {
      console.error('Failed to load translations:', error);
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang;

    // Only use localStorage on client side
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
      this.updatePageContent();
      // Trigger custom event for components to update
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
    }
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations[this.currentLanguage];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    if (!value) {
      // Fallback to English
      value = this.translations['en'];
      for (const k of keys) {
        value = value?.[k];
      }
    }
    
    if (!value) {
      return key; // Return key if translation not found
    }
    
    // Replace parameters
    return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
      return params[param] || match;
    });
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  updatePageContent() {
    // Only update DOM on client side
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Update all elements with data-i18n attribute
      document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = this.t(key);
      });

      // Update all elements with data-i18n-placeholder attribute
      document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = this.t(key);
      });

      // Update all elements with data-i18n-title attribute
      document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = this.t(key);
      });
    }
  }
}

// Create global instance
const i18n = new I18n();

// Make it globally available
window.i18n = i18n;

export default i18n;
