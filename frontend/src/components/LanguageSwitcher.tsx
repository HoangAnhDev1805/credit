'use client';

import { useState } from 'react';
import { useI18n } from './I18nProvider';
import { Button } from './ui/button';
import { ChevronDown, Globe } from 'lucide-react';

const LANGUAGE_META: Record<string, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇺🇸' },
  vi: { name: 'Tiếng Việt', flag: '🇻🇳' }
};

export function LanguageSwitcher() {
  const { language, setLanguage, availableLanguages } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const languages = (availableLanguages && availableLanguages.length > 0 ? availableLanguages : ['en','vi']).map(code => ({
    code,
    name: LANGUAGE_META[code]?.name || code.toUpperCase(),
    flag: LANGUAGE_META[code]?.flag || '🏳️'
  }));

  const currentLang = languages.find((lang) => lang.code === language) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLang.flag} {currentLang.name}</span>
        <span className="sm:hidden">{currentLang.flag}</span>
        <ChevronDown className="h-3 w-3" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="py-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 ${
                    language === lang.code
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                  {language === lang.code && (
                    <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
