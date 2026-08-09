import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const emptyRequest = {
  proposed_title: '',
  proposed_date: '',
  proposed_description: '',
  requester_name: '',
}

const emptyNewEvent = {
  title: '',
  description: '',
}

const emptyEditEvent = {
  title: '',
  description: '',
}

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

export default function Calendar() {
  const { isAdmin } = useAdmin()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyRequest)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  // Day modal state
  const [selectedDateKey, setSelectedDateKey] = useState(null)
  const [addingEvent, setAddingEvent] = useState(false)
  const [newEvent, setNewEvent] = useState(emptyNewEvent)
  const [savingNewEvent, setSavingNewEvent] = useState(false)
  const [editingEventId, setEditingEventId] = useState(null)
  const [editEvent, setEditEvent] = useState(emptyEditEvent)
  const [savingEditEvent, setSavingEditEvent] = useState(false)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const loadEvents = useCallback(async () => {
    const start = toDateKey(new Date(year, month, 1))
    const end = toDateKey(new Date(year, month + 1, 0))

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', start)
      .lte('event_date', end)
      .order('event_date', { ascending: true })

    if (!error) setEvents(data ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    setLoading(true)
    loadEvents()
  }, [loadEvents])

  const eventsByDate = useMemo(() => {
    return events.reduce((acc, event) => {
      if (!acc[event.event_date]) acc[event.event_date] = []
      acc[event.event_date].push(event)
      return acc
    }, {})
  }, [events])

  const selectedDayEvents = selectedDateKey ? eventsByDate[selectedDateKey] ?? [] : []

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []

    for (let i = 0; i < firstDay; i += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day))
    }
    return cells
  }, [year, month])

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.from('edit_requests').insert({
      proposed_title: form.proposed_title.trim(),
      proposed_date: form.proposed_date,
      proposed_description: form.proposed_description.trim(),
      requester_name: form.requester_name.trim(),
      status: 'pending',
    })

    setSubmitting(false)
    if (error) {
      setMessage(`Could not submit: ${error.message}`)
      return
    }

    setForm(emptyRequest)
    setMessage('Request submitted! It will appear on the Dashboard for VP approval.')
  }

  function openDayModal(dateKey) {
    setSelectedDateKey(dateKey)
    setAddingEvent(false)
    setNewEvent(emptyNewEvent)
    setEditingEventId(null)
  }

  function closeDayModal() {
    setSelectedDateKey(null)
    setAddingEvent(false)
    setNewEvent(emptyNewEvent)
    setEditingEventId(null)
  }

  async function handleAddEvent(e) {
    e.preventDefault()
    if (!selectedDateKey) return
    setSavingNewEvent(true)

    const { error } = await supabase.from('calendar_events').insert({
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || null,
      event_date: selectedDateKey,
    })

    setSavingNewEvent(false)
    if (error) {
      alert(`Could not add event: ${error.message}`)
      return
    }

    setNewEvent(emptyNewEvent)
    // Keep the "add event" form open so admins can add several events to the
    // same day back-to-back without the day modal closing or re-clicking "+ Add Event".
    loadEvents()
  }

  function startEditEvent(event) {
    setEditingEventId(event.id)
    setEditEvent({ title: event.title ?? '', description: event.description ?? '' })
  }

  async function handleSaveEditEvent(e) {
    e.preventDefault()
    setSavingEditEvent(true)

    const { error } = await supabase
      .from('calendar_events')
      .update({
        title: editEvent.title.trim(),
        description: editEvent.description.trim() || null,
      })
      .eq('id', editingEventId)

    setSavingEditEvent(false)
    if (error) {
      alert(`Could not save event: ${error.message}`)
      return
    }

    setEditingEventId(null)
    loadEvents()
  }

  async function handleDeleteEvent(event) {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return

    const { error } = await supabase.from('calendar_events').delete().eq('id', event.id)
    if (error) {
      alert(`Could not delete event: ${error.message}`)
      return
    }
    loadEvents()
  }

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Calendar & Requests</h2>
        <p className="mt-1 text-slate-600">
          Click any day to see full event details. Anyone can view; admins can add, edit, or
          remove events directly from that day.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            ← Prev
          </button>
          <h3 className="text-lg font-semibold text-slate-900">{monthLabel}</h3>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Next →
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading calendar...</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-20 rounded-lg bg-slate-50" />
                }

                const key = toDateKey(date)
                const dayEvents = eventsByDate[key] ?? []
                const isToday = key === toDateKey(new Date())

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => openDayModal(key)}
                    className={`min-h-20 rounded-lg border p-1.5 text-left transition hover:border-indigo-300 hover:shadow-sm ${
                      isToday ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 bg-white'
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${
                        isToday ? 'text-indigo-700' : 'text-slate-700'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <ul className="mt-1 space-y-0.5">
                      {dayEvents.map((event) => (
                        <li
                          key={event.id}
                          title={event.description ?? ''}
                          className="truncate rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-medium text-indigo-800"
                        >
                          {event.title}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Request a Calendar Edit</h3>
        <p className="mt-1 text-sm text-slate-600">
          Anyone can submit a request. Approved events appear on the calendar above.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            value={form.proposed_title}
            onChange={(e) => setForm({ ...form, proposed_title: e.target.value })}
            placeholder="Event title"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="date"
            value={form.proposed_date}
            onChange={(e) => setForm({ ...form, proposed_date: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={form.requester_name}
            onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
            placeholder="Your name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={form.proposed_description}
            onChange={(e) => setForm({ ...form, proposed_description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
          </div>
        </form>
      </section>

      {selectedDateKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeDayModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {formatDateKey(selectedDateKey)}
              </h2>
              <button
                type="button"
                onClick={closeDayModal}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-slate-500">No events on this day yet.</p>
              ) : (
                selectedDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    {editingEventId === event.id ? (
                      <form onSubmit={handleSaveEditEvent} className="space-y-2">
                        <input
                          required
                          value={editEvent.title}
                          onChange={(e) =>
                            setEditEvent({ ...editEvent, title: e.target.value })
                          }
                          placeholder="Event title"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <textarea
                          value={editEvent.description}
                          onChange={(e) =>
                            setEditEvent({ ...editEvent, description: e.target.value })
                          }
                          placeholder="Description"
                          rows={2}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingEventId(null)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingEditEvent}
                            className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {savingEditEvent ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-900">{event.title}</p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                          {event.description ? event.description : (
                            <span className="text-slate-400">No description added.</span>
                          )}
                        </p>
                        {isAdmin && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditEvent(event)}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(event)}
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {isAdmin && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                {!addingEvent ? (
                  <button
                    type="button"
                    onClick={() => setAddingEvent(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    + Add Event
                  </button>
                ) : (
                  <form onSubmit={handleAddEvent} className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">New event</p>
                    <input
                      required
                      autoFocus
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      placeholder="Event title"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={newEvent.description}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, description: e.target.value })
                      }
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingEvent(false)
                          setNewEvent(emptyNewEvent)
                        }}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingNewEvent}
                        className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingNewEvent ? 'Adding...' : 'Add Event'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
