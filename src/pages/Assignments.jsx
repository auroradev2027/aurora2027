import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'

const emptyForm = {
  class_name: '',
  title: '',
  due_date: '',
  is_completed: false,
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Assignments() {
  const { isAdmin } = useAdmin()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const loadAssignments = useCallback(async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('due_date', { ascending: true })

    if (!error) setAssignments(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  const grouped = useMemo(() => {
    return assignments.reduce((acc, item) => {
      if (!acc[item.class_name]) acc[item.class_name] = []
      acc[item.class_name].push(item)
      return acc
    }, {})
  }, [assignments])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const { error } = await supabase.from('assignments').insert({
      class_name: form.class_name.trim(),
      title: form.title.trim(),
      due_date: form.due_date,
      is_completed: form.is_completed,
    })

    setSubmitting(false)
    if (error) {
      alert(`Could not add assignment: ${error.message}`)
      return
    }

    setForm(emptyForm)
    loadAssignments()
  }

  async function toggleComplete(id, current) {
    const { error } = await supabase
      .from('assignments')
      .update({ is_completed: !current })
      .eq('id', id)

    if (error) {
      alert(`Could not update: ${error.message}`)
      return
    }
    loadAssignments()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Assignments</h2>
        <p className="mt-1 text-slate-600">All class assignments, grouped by course.</p>
      </div>

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm"
        >
          <h3 className="font-semibold text-indigo-900">Add Assignment</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              required
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              placeholder="Class name (e.g. AP Calculus)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Assignment title"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_completed}
                onChange={(e) => setForm({ ...form, is_completed: e.target.checked })}
              />
              Mark as completed
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Assignment'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading assignments...</p>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No assignments yet.
          {isAdmin ? ' Use the form above to add one.' : ''}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([className, items]) => (
            <section key={className}>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">{className}</h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div>
                      <p
                        className={`font-medium ${
                          item.is_completed ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-sm text-slate-500">Due {formatDate(item.due_date)}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.is_completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.is_completed ? 'Done' : 'Pending'}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleComplete(item.id, item.is_completed)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Toggle status
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
