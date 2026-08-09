import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import { useLanguage } from '../context/LanguageContext'

export default function AdminPinModal() {
  const { showPinModal, setShowPinModal, unlock } = useAdmin()
  const { t } = useLanguage()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  if (!showPinModal) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (unlock(pin)) {
      setPin('')
      setError('')
      return
    }
    setError(t('adminModal.error'))
    setPin('')
  }

  function handleClose() {
    setShowPinModal(false)
    setPin('')
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{t('adminModal.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('adminModal.subtitle')}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={t('adminModal.placeholder')}
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-coral-500 focus:outline-none focus:ring-2 focus:ring-coral-200"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700"
            >
              {t('adminModal.unlock')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
