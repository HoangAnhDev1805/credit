import { useState, useEffect } from 'react';
import i18n from '../i18n';

export function useI18n() {
  const [currentLanguage, setCurrentLanguage] = useState(i18n.getCurrentLanguage());

  useEffect(() => {
    const handleLanguageChange = (event) => {
      setCurrentLanguage(event.detail);
    };

    window.addEventListener('languageChanged', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);

  const t = (key, params = {}) => {
    return i18n.t(key, params);
  };

  const changeLanguage = (lang) => {
    i18n.setLanguage(lang);
  };

  return {
    t,
    currentLanguage,
    changeLanguage
  };
}
