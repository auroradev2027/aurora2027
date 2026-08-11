import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'
import { useLanguage } from '../context/LanguageContext'
import { getLocale } from '../lib/translations'

const GROUP_STORAGE_KEY = 'aurora_cycle_group'

// Times are universal (numeric), so they aren't translated — course names and
// teacher names come from the translation dictionary / are proper nouns.

// ─── ROQUÉ DE DUPREY ─── confirmed schedule ────────────────────────────────
const ROQUE_CYCLE_1_TIMES = [
  '8:00 am – 9:20 am',
  '9:20 am – 10:40 am',
  '10:40 am – 12:00 pm',
  '2:00 pm – 3:20 pm',
  '3:35 pm – 5:00 pm',
]
const ROQUE_CYCLE_1_COURSE_KEYS = ['calc', 'pe', 'spanishAdv', 'englishAdv', 'physics']
const ROQUE_CYCLE_1_TEACHERS = ['Melo', 'Yohanny', 'Lilliana', 'Jessenia', 'Nicole']

const ROQUE_CYCLE_2_TIMES = ROQUE_CYCLE_1_TIMES
const ROQUE_CYCLE_2_COURSE_KEYS = ['socio', 'trig', 'englishConv', 'agro', 'firstAid']
const ROQUE_CYCLE_2_TEACHERS = ['Alexandra', 'Melo', 'Heldys', 'Yessenia', 'Wilfredo']

// ─── BETANCES ─── confirmed schedule ───────────────────────────────────────
const BETANCES_CYCLE_1_TIMES = ROQUE_CYCLE_1_TIMES
const BETANCES_CYCLE_1_COURSE_KEYS = ['englishConv', 'pe', 'englishAdv', 'calc', 'physics']
const BETANCES_CYCLE_1_TEACHERS = ['Heldys', 'Yohanny', 'Jessenia', 'Melo', 'Nicole']

const BETANCES_CYCLE_2_TIMES = ROQUE_CYCLE_2_TIMES
const BETANCES_CYCLE_2_COURSE_KEYS = ['spanishAdv', 'trig', 'socio', 'agro', 'firstAid']
const BETANCES_CYCLE_2_TEACHERS = ['Lilliana', 'Melo', 'Alexandra', 'Yessenia', 'Wilfredo']

const GROUPS = [
  {
    key: 'roque',
    labelKey: 'cycles.groupRoque',
    cycle1: { times: ROQUE_CYCLE_1_TIMES, courseKeys: ROQUE_CYCLE_1_COURSE_KEYS, teachers: ROQUE_CYCLE_1_TEACHERS },
    cycle2: { times: ROQUE_CYCLE_2_TIMES, courseKeys: ROQUE_CYCLE_2_COURSE_KEYS, teachers: ROQUE_CYCLE_2_TEACHERS },
  },
  {
    key: 'betances',
    labelKey: 'cycles.groupBetances',
    cycle1: {
      times: BETANCES_CYCLE_1_TIMES,
      courseKeys: BETANCES_CYCLE_1_COURSE_KEYS,
      teachers: BETANCES_CYCLE_1_TEACHERS,
    },
    cycle2: {
      times: BETANCES_CYCLE_2_TIMES,
      courseKeys: BETANCES_CYCLE_2_COURSE_KEYS,
      teachers: BETANCES_CYCLE_2_TEACHERS,
    },
  },
]

function readStoredGroup() {
  try {
    const stored = localStorage.getItem(GROUP_STORAGE_KEY)
    return GROUPS.some((g) => g.key === stored) ? stored : 'roque'
  } catch {
    return 'roque'
  }
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateKey(key, locale) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
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
  const offset = (5 - cursor.getDay() + 7) % 7
  cursor.setDate(cursor.getDate() + offset)

  for (let i = 0; i < count; i += 1) {
    fridays.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return fridays
}

// Key used in the in-memory friday-cycle map: date + group, since each group
// can run a different cycle on the same Friday.
function fridayMapKey(dateKey, groupKey) {
  return `${dateKey}|${groupKey}`
}

export default function Cycles() {
  const { isAdmin } = useAdmin()
  const { t, lang } = useLanguage()
  const locale = getLocale(lang)
  const [fridayCycles, setFridayCycles] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(readStoredGroup)

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, selectedGroup)
    } catch {
      // ignore storage errors (private browsing, etc.)
    }
  }, [selectedGroup])

  const loadFridayCycles = useCallback(async () => {
    const { data, error } = await supabase.from('friday_cycles').select('*')
    if (!error) {
      const map = {}
      for (const row of data ?? []) {
        const groupKey = row.class_group ?? 'roque'
        map[fridayMapKey(row.friday_date, groupKey)] = row.cycle
      }
      setFridayCycles(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadFridayCycles()
  }, [loadFridayCycles])

  const today = useMemo(() => new Date(), [])
  const todayKey = toDateKey(today)
  const todayWeekday = today.getDay()

  const todayStatus = useMemo(() => {
    if (todayWeekday === 1 || todayWeekday === 3) return { cycle: 1, isFriday: false }
    if (todayWeekday === 2 || todayWeekday === 4) return { cycle: 2, isFriday: false }
    if (todayWeekday === 5) {
      const cycle = fridayCycles[fridayMapKey(todayKey, selectedGroup)]
      return { cycle: cycle ?? null, isFriday: true }
    }
    return { cycle: null, isFriday: false, isWeekend: true }
  }, [todayWeekday, todayKey, fridayCycles, selectedGroup])

  const upcomingFridays = useMemo(() => getUpcomingFridays(10), [])

  const activeGroup = useMemo(
    () => GROUPS.find((g) => g.key === selectedGroup) ?? GROUPS[0],
    [selectedGroup],
  )

  const cycles = useMemo(
    () => [
      {
        key: 'cycle1',
        label: t('cycles.cycle1Label'),
        days: t('cycles.cycle1Days'),
        periods: activeGroup.cycle1.courseKeys.map((courseKey, i) => ({
          time: activeGroup.cycle1.times[i],
          course: t(`cycles.courses.${courseKey}`),
          teacher: activeGroup.cycle1.teachers[i],
        })),
      },
      {
        key: 'cycle2',
        label: t('cycles.cycle2Label'),
        days: t('cycles.cycle2Days'),
        periods: activeGroup.cycle2.courseKeys.map((courseKey, i) => ({
          time: activeGroup.cycle2.times[i],
          course: t(`cycles.courses.${courseKey}`),
          teacher: activeGroup.cycle2.teachers[i],
        })),
      },
    ],
    [t, activeGroup],
  )

  async function setFridayCycle(dateKey, cycle) {
    const key = fridayMapKey(dateKey, selectedGroup)
    setSavingKey(key)
    const { error } = await supabase
      .from('friday_cycles')
      .upsert(
        { friday_date: dateKey, cycle, class_group: selectedGroup },
        { onConflict: 'friday_date,class_group' },
      )

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
        <h2 className="text-2xl font-semibold text-slate-900">{t('cycles.heading')}</h2>
        <p className="mt-1 text-slate-600">{t('cycles.subheading')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">{t('cycles.selectGroup')}</span>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {GROUPS.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => setSelectedGroup(group.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                selectedGroup === group.key
                  ? 'bg-coral-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t(group.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-coral-200 bg-coral-50 p-5 shadow-sm">
        <p className="text-sm font-medium text-coral-700">{formatDateKey(todayKey, locale)}</p>
        <div className="mt-2 flex items-center gap-2">
          {todayStatus.isWeekend ? (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-600">
              {t('cycles.noClasses')}
            </span>
          ) : todayStatus.isFriday && !todayStatus.cycle ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              {t('cycles.fridayNotSet')}
            </span>
          ) : (
            <span className="rounded-full bg-gold-400 px-3 py-1 text-sm font-semibold text-white">
              {todayStatus.isFriday
                ? `${t('cycles.fridayCycle')} ${todayStatus.cycle}`
                : `${t('cycles.cycle')} ${todayStatus.cycle}`}
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {cycles.map(({ key, label, days, periods }) => (
          <div key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">{label}</h3>
              <p className="text-xs text-slate-500">{days}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="px-4 py-2 font-medium">{t('cycles.time')}</th>
                    <th className="px-4 py-2 font-medium">{t('cycles.classCol')}</th>
                    <th className="px-4 py-2 font-medium">{t('cycles.teacher')}</th>
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
          <h3 className="font-semibold text-coral-900">
            {t('cycles.manageHeading')} — {t(activeGroup.labelKey)}
          </h3>
          <p className="mt-1 text-sm text-coral-700/80">{t('cycles.manageSubheading')}</p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {upcomingFridays.map((date) => {
                const dateKey = toDateKey(date)
                const mapKey = fridayMapKey(dateKey, selectedGroup)
                const current = fridayCycles[mapKey] ?? ''
                return (
                  <li
                    key={mapKey}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {date.toLocaleDateString(locale, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <select
                      value={current}
                      disabled={savingKey === mapKey}
                      onChange={(e) => setFridayCycle(dateKey, Number(e.target.value))}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:opacity-50"
                    >
                      <option value="" disabled>
                        {t('common.notSet')}
                      </option>
                      <option value={1}>{t('cycles.cycle1Label')}</option>
                      <option value={2}>{t('cycles.cycle2Label')}</option>
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
