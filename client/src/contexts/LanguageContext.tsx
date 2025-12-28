import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, isRTL, type LanguageCode } from '@/lib/i18n';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  isRTL: boolean;
  languages: typeof languages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<LanguageCode>(
    (i18n.language as LanguageCode) || 'en'
  );

  const setLanguage = (lang: LanguageCode) => {
    i18n.changeLanguage(lang);
    setLanguageState(lang);
    localStorage.setItem('i18nextLng', lang);
  };

  useEffect(() => {
    const currentLang = (i18n.language?.split('-')[0] as LanguageCode) || 'en';
    const validLang = languages.find(l => l.code === currentLang) ? currentLang : 'en';
    setLanguageState(validLang);
  }, [i18n.language]);

  useEffect(() => {
    // Only set the language attribute, not the direction
    // Navigation and layout stay LTR, only content text uses RTL where needed
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isRTL: isRTL(language),
        languages,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
