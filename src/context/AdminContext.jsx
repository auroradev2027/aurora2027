import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ADMIN_PIN = 'ClassOf2026'
const STORAGE_KEY = 'class2026_admin_expiry'
const SESSION_MS = 60 * 60 * 1000

const AdminContext = createContext(null)

function readStoredAdmin() {
  const expiry = localStorage.getItem(STORAGE_KEY)
  if (!expiry) return false
  if (Date.now() > Number(expiry)) {
    localStorage.removeItem(STORAGE_KEY)
    return false
  }
  return true
}

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(readStoredAdmin)
  const [showPinModal, setShowPinModal] = useState(false)

  const unlock = useCallback((pin) => {
    if (pin !== ADMIN_PIN) return false
    localStorage.setItem(STORAGE_KEY, String(Date.now() + SESSION_MS))
    setIsAdmin(true)
    setShowPinModal(false)
    return true
  }, [])

  const lock = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setIsAdmin(false)
    setShowPinModal(false)
  }, [])

  const toggleLock = useCallback(() => {
    if (isAdmin) {
      lock()
    } else {
      setShowPinModal(true)
    }
  }, [isAdmin, lock])

  const value = useMemo(
    () => ({
      isAdmin,
      showPinModal,
      setShowPinModal,
      unlock,
      lock,
      toggleLock,
    }),
    [isAdmin, showPinModal, unlock, lock, toggleLock],
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider')
  }
  return context
}
