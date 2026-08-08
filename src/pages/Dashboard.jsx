import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'

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

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Dashboard() {
  const { isAdmin } = useAdmin()
  const [countdown, setCountdown] = useState(getCountdown)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('status', 'pending')
      .order('proposed_date', { ascending: true })

    if (!error) setRequests(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRequests()
    const timer = setInterval(() => setCountdown(getCountdown()), 60000)
    return () => clearInterval(timer)
  }, [loadRequests])

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
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-200">
          Graduation Countdown
        </p>
        <p className="mt-2 text-4xl font-bold">{countdown.days} days</p>
        <p className="mt-1 text-indigo-100">
          {countdown.hours} hours · {countdown.minutes} minutes until June 12, 2026
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Pending Calendar Requests</h2>
          {!isAdmin && (
            <span className="text-xs text-slate-500">View only — VP approval required</span>
          )}
        </div>

        {loading ? (
          <p className="text-slate-500">Loading requests...</p>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No pending requests. Submit one from the Calendar page.
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
                      {formatDate(req.proposed_date)} · Requested by {req.requester_name}
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
                        ✅ Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionId === req.id}
                        onClick={() => handleReject(req.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        ❌ Reject
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
