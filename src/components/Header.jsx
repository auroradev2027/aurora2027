import { NavLink } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { useLanguage } from '../context/LanguageContext'

export default function Header() {
  const { isAdmin, toggleLock } = useAdmin()
  const { lang, toggleLang, t } = useLanguage()

  const navLinks = [
    { to: '/', label: t('header.dashboard') },
    { to: '/cycles', label: t('header.cycles') },
    { to: '/assignments', label: t('header.assignments') },
    { to: '/resources', label: t('header.resources') },
    { to: '/calendar', label: t('header.calendar') },
  ]

  return (
    <header className="border-b-2 border-gold-400 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Class of 2027 logo"
            className="h-11 w-11 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-coral-600">
              {t('header.classOf')}
            </p>
            <h1 className="text-xl font-bold text-slate-900">{t('header.portalName')}</h1>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-coral-100 text-coral-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={toggleLang}
            title={lang === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
            className="ml-1 flex items-center gap-1 rounded-lg border border-gold-300 bg-gold-50 px-3 py-2 text-sm font-semibold text-gold-800 hover:bg-gold-100"
          >
            <span className={lang === 'en' ? 'text-gold-900' : 'text-gold-500'}>EN</span>
            <span aria-hidden="true">/</span>
            <span className={lang === 'es' ? 'text-gold-900' : 'text-gold-500'}>ES</span>
          </button>

          <button
            type="button"
            onClick={toggleLock}
            title={isAdmin ? t('header.lockTitle') : t('header.unlockTitle')}
            className={`ml-1 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isAdmin
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span aria-hidden="true">{isAdmin ? '🔓' : '🔒'}</span>
            {isAdmin ? t('header.admin') : t('header.lock')}
          </button>
        </nav>
      </div>
    </header>
  )
}
