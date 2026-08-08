import { NavLink } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/cycles', label: 'Cycles' },
  { to: '/assignments', label: 'Assignments' },
  { to: '/resources', label: 'Resources' },
  { to: '/calendar', label: 'Calendar' },
]

export default function Header() {
  const { isAdmin, toggleLock } = useAdmin()

  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Class of 2026
          </p>
          <h1 className="text-xl font-bold text-slate-900">Senior Portal</h1>
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
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={toggleLock}
            title={isAdmin ? 'Lock admin mode' : 'Unlock admin mode'}
            className={`ml-2 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isAdmin
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span aria-hidden="true">{isAdmin ? '🔓' : '🔒'}</span>
            {isAdmin ? 'Admin' : 'Lock'}
          </button>
        </nav>
      </div>
    </header>
  )
}
