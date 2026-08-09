import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'
import { useLanguage } from '../context/LanguageContext'
import { getLocale } from '../lib/translations'

const GRADUATION_DATE = new Date('2026-06-12T00:00:00')

function getCountdown() {
  const now = new Date()
  const diff = GRADUATION_DATE.getTime() - now.getTime()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0 }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  return { days, hours, minutes }
}

function formatDate(dateStr, locale) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const emptyReminder = { message: '', is_urgent: false }

export default function Dashboard() {
  const { isAdmin } = useAdmin()
  const { t, lang } = useLanguage()
  const locale = getLocale(lang)
  const [countdown, setCountdown] = useState(getCountdown)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)

  // Important reminders
  const [reminders, setReminders] = useState([])
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [newReminder, setNewReminder] = useState(emptyReminder)
  const [postingReminder, setPostingReminder] = useState(false)
  const [editingReminderId, setEditingReminderId] = useState(null)
  const [editReminder, setEditReminder] = useState(emptyReminder)
  const [savingReminderEdit, setSavingReminderEdit] = useState(false)

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('status', 'pending')
      .order('proposed_date', { ascending: true })

    if (!error) setRequests(data ?? [])
    setLoading(false)
  }, [])

  const loadReminders = useCallback(async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setReminders(data ?? [])
    setRemindersLoading(false)
  }, [])

  useEffect(() => {
    loadRequests()
    loadReminders()
    const timer = setInterval(() => setCountdown(getCountdown()), 60000)
    return () => clearInterval(timer)
  }, [loadRequests, loadReminders])

  async function handlePostReminder(e) {
    e.preventDefault()
    if (!newReminder.message.trim()) return
    setPostingReminder(true)

    const { error } = await supabase.from('reminders').insert({
      message: newReminder.message.trim(),
      is_urgent: newReminder.is_urgent,
    })

    setPostingReminder(false)
    if (error) {
      alert(`Could not post reminder: ${error.message}`)
      return
    }

    setNewReminder(emptyReminder)
    loadReminders()
  }

  function startEditReminder(reminder) {
    setEditingReminderId(reminder.id)
    setEditReminder({ message: reminder.message, is_urgent: reminder.is_urgent })
  }

  async function handleSaveReminderEdit(e) {
    e.preventDefault()
    setSavingReminderEdit(true)

    const { error } = await supabase
      .from('reminders')
      .update({
        message: editReminder.message.trim(),
        is_urgent: editReminder.is_urgent,
      })
      .eq('id', editingReminderId)

    setSavingReminderEdit(false)
    if (error) {
      alert(`Could not save reminder: ${error.message}`)
      return
    }

    setEditingReminderId(null)
    loadReminders()
  }

  async function handleDeleteReminder(reminder) {
    if (!confirm(t('dashboard.deleteReminderConfirm'))) return

    const { error } = await supabase.from('reminders').delete().eq('id', reminder.id)
    if (error) {
      alert(`Could not delete: ${error.message}`)
      return
    }
    loadReminders()
  }

  async function handleApprove(request) {
    setActionId(request.id)
    const { error: insertError } = await supabase.from('calendar_events').insert({
      title: request.proposed_title,
      event_date: request.proposed_date,
      description: request.proposed_description,
    })

    if (insertError) {
      alert(`Could not approve: ${insertError.message}`)
      setActionId(null)
      return
    }

    const { error: deleteError } = await supabase
      .from('edit_requests')
      .delete()
      .eq('id', request.id)

    if (deleteError) {
      alert(`Approved event but could not remove request: ${deleteError.message}`)
    }

    setActionId(null)
    loadRequests()
  }

  async function handleReject(id) {
    setActionId(id)
    const { error } = await supabase.from('edit_requests').delete().eq('id', id)
    if (error) alert(`Could not reject: ${error.message}`)
    setActionId(null)
    loadRequests()
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-coral-500 to-gold-500 p-8 text-white shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wide text-coral-50">
          {t('dashboard.countdownLabel')}
        </p>
        <p className="mt-2 text-4xl font-bold">
          {countdown.days} {t('dashboard.days')}
        </p>
        <p className="mt-1 text-coral-100">
          {countdown.hours} {t('dashboard.hours')} · {countdown.minutes} {t('dashboard.minutes')}{' '}
          {t('dashboard.until')}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">{t('dashboard.remindersHeading')}</h2>

        {isAdmin && (
          <form
            onSubmit={handlePostReminder}
            className="mt-3 rounded-xl border border-coral-200 bg-coral-50/50 p-4 shadow-sm"
          >
            <textarea
              required
              value={newReminder.message}
              onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
              placeholder={t('dashboard.remindersPlaceholder')}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newReminder.is_urgent}
                  onChange={(e) =>
                    setNewReminder({ ...newReminder, is_urgent: e.target.checked })
                  }
                />
                {t('dashboard.markUrgent')}
              </label>
              <button
                type="submit"
                disabled={postingReminder}
                className="rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700 disabled:opacity-50"
              >
                {postingReminder ? t('dashboard.posting') : t('dashboard.postReminder')}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4">
          {remindersLoading ? (
            <p className="text-slate-500">{t('dashboard.loadingReminders')}</p>
          ) : reminders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
              {t('dashboard.noReminders')}
            </div>
          ) : (
            <ul className="space-y-2">
              {reminders.map((reminder) => (
                <li
                  key={reminder.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    reminder.is_urgent
                      ? 'border-coral-300 bg-coral-50'
                      : 'border-gold-200 bg-gold-50'
                  }`}
                >
                  {editingReminderId === reminder.id ? (
                    <form onSubmit={handleSaveReminderEdit} className="space-y-2">
                      <textarea
                        required
                        value={editReminder.message}
                        onChange={(e) =>
                          setEditReminder({ ...editReminder, message: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editReminder.is_urgent}
                          onChange={(e) =>
                            setEditReminder({ ...editReminder, is_urgent: e.target.checked })
                          }
                        />
                        {t('dashboard.markUrgent')}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingReminderId(null)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={savingReminderEdit}
                          className="flex-1 rounded-lg bg-coral-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-coral-700 disabled:opacity-50"
                        >
                          {savingReminderEdit ? t('common.saving') : t('common.save')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            reminder.is_urgent
                              ? 'bg-coral-600 text-white'
                              : 'bg-gold-400 text-white'
                          }`}
                        >
                          {reminder.is_urgent ? t('dashboard.urgentTag') : t('dashboard.reminderTag')}
                        </span>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {reminder.message}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => startEditReminder(reminder)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(reminder)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{t('dashboard.pendingHeading')}</h2>
          {!isAdmin && (
            <span className="text-xs text-slate-500">{t('dashboard.viewOnlyNote')}</span>
          )}
        </div>

        {loading ? (
          <p className="text-slate-500">{t('dashboard.loadingRequests')}</p>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            {t('dashboard.noRequests')}
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => (
              <li
                key={req.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{req.proposed_title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(req.proposed_date, locale)} · {t('dashboard.requestedBy')}{' '}
                      {req.requester_name}
                    </p>
                    {req.proposed_description && (
                      <p className="mt-2 text-sm text-slate-700">{req.proposed_description}</p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={actionId === req.id}
                        onClick={() => handleApprove(req)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ✅ {t('dashboard.approve')}
                      </button>
                      <button
                        type="button"
                        disabled={actionId === req.id}
                        onClick={() => handleReject(req.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        ❌ {t('dashboard.reject')}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
