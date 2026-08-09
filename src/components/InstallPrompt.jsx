import { useEffect, useState } from 'react'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if (isStandalone() || !isMobile()) return

    setIos(isIOS())

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    // iOS Safari has no beforeinstallprompt event, so show our instructions.
    if (isIOS()) setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!show || isStandalone()) return null

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShow(false)
  }

  return (
    <div className="fixed inset-x-3 bottom-4 z-[100] mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Install Aurora Portal</p>
          {ios ? (
            <p className="mt-1 text-sm leading-5 text-gray-600">
              Tap <strong>Share</strong> in Safari, then choose <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-5 text-gray-600">
              Add the portal to your home screen for quick access like a normal app.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {!ios && (
          <button
            onClick={install}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            Install app
          </button>
        )}
        <button
          onClick={() => setShow(false)}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
