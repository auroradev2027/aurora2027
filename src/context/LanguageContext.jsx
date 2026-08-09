import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { translations } from '../lib/translations'

const STORAGE_KEY = 'portal_language'
const LanguageContext = createContext(null)

function readStoredLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'es' ? 'es' : 'en'
}

function lookup(dict, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), dict)
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readStoredLang)

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'en' ? 'es' : 'en'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  // t('assignments.heading') looks up that path in the current language.
  // Pass vars to fill in {placeholders}, e.g. t('assignments.deleteConfirm', { name: title }).
  const t = useCallback(
    (path, vars) => {
      const value = lookup(translations[lang], path)
      if (value == null) return path
      if (typeof value !== 'string') return value
      if (!vars) return value
      return Object.entries(vars).reduce(
        (str, [key, val]) => str.replaceAll(`{${key}}`, val),
        value,
      )
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, toggleLang, t }), [lang, toggleLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
