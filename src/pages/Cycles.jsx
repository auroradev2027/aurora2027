import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'

const CYCLE_1 = {
  label: 'Cycle 1',
  days: 'Monday & Wednesday',
  periods: [
    { time: '8:00 am – 9:20 am', course: 'Sociología/Relaciones Internacionales', teacher: 'Alexandra' },
    { time: '9:20 am – 10:40 am', course: 'Trigonometría Avanzada', teacher: 'Melo' },
    { time: '10:40 am – 12:00 pm', course: 'Inglés Conversacional', teacher: 'Heldys' },
    { time: '2:00 pm – 3:20 pm', course: 'Agroempresarismo', teacher: 'Yessenia' },
    { time: '3:35 pm – 5:00 pm', course: 'Primeros Auxilios/Nutrición', teacher: 'Wilfredo' },
  ],
}

const CYCLE_2 = {
  label: 'Cycle 2',
  days: 'Tuesday & Thursday',
  periods: [
    { time: '8:00 am – 9:20 am', course: 'Cálculo', teacher: 'Melo' },
    { time: '9:20 am – 10:40 am', course: 'Educación Física', teacher: 'Yohanny' },
    { time: '10:40 am – 12:00 pm', course: 'Español Avanzado', teacher: 'Lilliana' },
    { time: '2:00 pm – 3:20 pm', course: 'Advanced English', teacher: 'Jessenia' },
    { time: '3:35 pm – 5:00 pm', course: 'Física', teacher: 'Nicole' },
  ],
}

const CYCLES = [CYCLE_1, CYCLE_2]

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateKey(key) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Builds the next `count` Fridays starting from today (includes today if it's a Friday).
function getUpcomingFridays(count) {
  const fridays = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  // Advance to the next Friday (or stay put if today already is one).
  const offset = (5 - cursor.getDay() + 7) % 7
  cursor.setDate(cursor.getDate() + offset)

  for (let i = 0; i < count; i += 1) {
    fridays.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return fridays
}

export default function Cycles() {
  const { isAdmin } = useAdmin()
  const [fridayCycles, setFridayCycles] = useState({}) // { '2026-03-06': 1, ... }
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)

  const loadFridayCycles = useCallback(async () => {
    const { data, error } = await supabase.from('friday_cycles').select('*')
    if (!error) {
      const map = {}
      for (const row of data ?? []) map[row.friday_date] = row.cycle
      setFridayCycles(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadFridayCycles()
  }, [loadFridayCycles])

  const today = useMemo(() => new Date(), [])
  const todayKey = toDateKey(today)
  const todayWeekday = today.getDay() // 0 Sun ... 6 Sat

  const todayStatus = useMemo(() => {
    if (todayWeekday === 1 || todayWeekday === 3) return { cycle: 1, isFriday: false }
    if (todayWeekday === 2 || todayWeekday === 4) return { cycle: 2, isFriday: false }
    if (todayWeekday === 5) {
      const cycle = fridayCycles[todayKey]
      return { cycle: cycle ?? null, isFriday: true }
    }
    return { cycle: null, isFriday: false, isWeekend: true }
  }, [todayWeekday, todayKey, fridayCycles])

  const upcomingFridays = useMemo(() => getUpcomingFridays(10), [])

  async function setFridayCycle(dateKey, cycle) {
    setSavingKey(dateKey)
    const { error } = await supabase
      .from('friday_cycles')
      .upsert({ friday_date: dateKey, cycle }, { onConflict: 'friday_date' })

    setSavingKey(null)
    if (error) {
      alert(`Could not save: ${error.message}`)
      return
    }
    loadFridayCycles()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Daily Class Cycle</h2>
        <p className="mt-1 text-slate-600">
          Mondays and Wednesdays always run Cycle 1. Tuesdays and Thursdays always run
          Cycle 2. Fridays alternate — check the tag below or the schedule further down.
        </p>
      </div>

      <section className="rounded-2xl border border-coral-200 bg-coral-50 p-5 shadow-sm">
        <p className="text-sm font-medium text-coral-700">{formatDateKey(todayKey)}</p>
        <div className="mt-2 flex items-center gap-2">
          {todayStatus.isWeekend ? (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-600">
              No classes today
            </span>
          ) : todayStatus.isFriday && !todayStatus.cycle ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              Friday Cycle not set yet
            </span>
          ) : (
            <span className="rounded-full bg-gold-400 px-3 py-1 text-sm font-semibold text-white">
              {todayStatus.isFriday ? `Friday Cycle ${todayStatus.cycle}` : `Cycle ${todayStatus.cycle}`}
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {CYCLES.map(({ label, days, periods }) => (
          <div key={label} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">{label}</h3>
              <p className="text-xs text-slate-500">{days}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Class</th>
                    <th className="px-4 py-2 font-medium">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((row) => (
                    <tr key={row.time} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-600">{row.time}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.course}</td>
                      <td className="px-4 py-2.5 text-slate-700">{row.teacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <section className="rounded-xl border border-coral-200 bg-coral-50/50 p-5 shadow-sm">
          <h3 className="font-semibold text-coral-900">Manage Friday Cycles</h3>
          <p className="mt-1 text-sm text-coral-700/80">
            Set which cycle each upcoming Friday follows. Changes save immediately.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {upcomingFridays.map((date) => {
                const key = toDateKey(date)
                const current = fridayCycles[key] ?? ''
                return (
                  <li
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <select
                      value={current}
                      disabled={savingKey === key}
                      onChange={(e) => setFridayCycle(key, Number(e.target.value))}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Not set
                      </option>
                      <option value={1}>Cycle 1</option>
                      <option value={2}>Cycle 2</option>
                    </select>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
