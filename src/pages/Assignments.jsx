import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'
import { useLanguage } from '../context/LanguageContext'
import { getLocale } from '../lib/translations'

const NAME_STORAGE_KEY = 'aurora_student_name'

const GROUPS = [
  { key: 'roque', labelKey: 'assignments.groupRoque' },
  { key: 'betances', labelKey: 'assignments.groupBetances' },
]

const emptyForm = {
  class_name: '',
  title: '',
  due_date: '',
  class_group: 'roque',
}

const emptyEditForm = {
  title: '',
  class_name: '',
  due_date: '',
  description: '',
  class_group: 'roque',
}

function formatDate(dateStr, locale) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Uploads a file to the "assignments" storage bucket and returns its public URL.
async function uploadAssignmentFile(file) {
  const ext = file.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('assignments')
    .upload(path, file, { upsert: false })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('assignments').getPublicUrl(path)
  return data.publicUrl
}

function getFileName(url) {
  if (!url) return ''
  try {
    const decoded = decodeURIComponent(url.split('/').pop() ?? '')
    return decoded.replace(/^\d+-[a-z0-9]+\./, '')
  } catch {
    return 'attached file'
  }
}

function readStoredName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function namesMatch(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// Small modal asking for the visitor's first name. Used both for the
// "who are you" prompt on entering the tab and whenever a name is needed
// on demand (marking done / asking for help) but none is stored yet.
function NamePromptModal({ t, initialValue, onSubmit, onClose, dismissable }) {
  const [value, setValue] = useState(initialValue ?? '')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{t('assignments.nameModalTitle')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('assignments.nameModalSubtitle')}</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            autoFocus
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('assignments.namePlaceholder')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              type="submit"
              className="flex-1 rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700"
            >
              {t('assignments.nameSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Assignments() {
  const { isAdmin } = useAdmin()
  const { t, lang } = useLanguage()
  const locale = getLocale(lang)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const [selected, setSelected] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editFile, setEditFile] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Per-person completion tracking (no accounts — just a first name).
  const [studentName, setStudentName] = useState(readStoredName)
  const [nameModal, setNameModal] = useState({ open: false, dismissable: false, onSubmit: null })
  const [completions, setCompletions] = useState([])
  const [helpRequests, setHelpRequests] = useState([])
  const [busyAssignmentId, setBusyAssignmentId] = useState(null)

  useEffect(() => {
    if (!readStoredName()) {
      setNameModal({
        open: true,
        dismissable: false,
        onSubmit: (name) => commitName(name),
      })
    }
  }, [])

  function commitName(name) {
    try {
      localStorage.setItem(NAME_STORAGE_KEY, name)
    } catch {
      // ignore storage errors
    }
    setStudentName(name)
    setNameModal({ open: false, dismissable: false, onSubmit: null })
  }

  function promptForName(onSubmit) {
    setNameModal({ open: true, dismissable: true, onSubmit })
  }

  function openChangeName() {
    setNameModal({
      open: true,
      dismissable: true,
      onSubmit: (name) => commitName(name),
    })
  }

  const loadAssignments = useCallback(async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('due_date', { ascending: true })

    if (!error) setAssignments(data ?? [])
    setLoading(false)
  }, [])

  const loadCompletions = useCallback(async () => {
    const { data, error } = await supabase.from('assignment_completions').select('*')
    if (!error) setCompletions(data ?? [])
  }, [])

  const loadHelpRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('assignment_help_requests')
      .select('*, assignments(title, class_name, class_group)')
      .order('created_at', { ascending: false })
    if (!error) setHelpRequests(data ?? [])
  }, [])

  useEffect(() => {
    loadAssignments()
    loadCompletions()
    loadHelpRequests()
  }, [loadAssignments, loadCompletions, loadHelpRequests])

  useEffect(() => {
    if (!selected) return
    const fresh = assignments.find((a) => a.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [assignments, selected?.id])

  const completionsByAssignment = useMemo(() => {
    const map = {}
    for (const row of completions) {
      if (!map[row.assignment_id]) map[row.assignment_id] = []
      map[row.assignment_id].push(row)
    }
    return map
  }, [completions])

  const groupedByClassGroup = useMemo(() => {
    const byGroup = { roque: {}, betances: {} }
    for (const item of assignments) {
      const groupKey = byGroup[item.class_group] ? item.class_group : 'roque'
      if (!byGroup[groupKey][item.class_name]) byGroup[groupKey][item.class_name] = []
      byGroup[groupKey][item.class_name].push(item)
    }
    return byGroup
  }, [assignments])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const { error } = await supabase.from('assignments').insert({
      class_name: form.class_name.trim(),
      title: form.title.trim(),
      due_date: form.due_date,
      class_group: form.class_group,
    })

    setSubmitting(false)
    if (error) {
      alert(`Could not add assignment: ${error.message}`)
      return
    }

    setForm(emptyForm)
    loadAssignments()
  }

  async function handleDelete(item) {
    if (!confirm(t('assignments.deleteConfirm', { name: item.title }))) return

    const { error } = await supabase.from('assignments').delete().eq('id', item.id)
    if (error) {
      alert(`Could not delete: ${error.message}`)
      return
    }
    if (selected?.id === item.id) closeModal()
    loadAssignments()
  }

  function openModal(item) {
    setSelected(item)
    setIsEditing(false)
  }

  function closeModal() {
    setSelected(null)
    setIsEditing(false)
    setEditFile(null)
  }

  function startEditing(item) {
    setEditForm({
      title: item.title ?? '',
      class_name: item.class_name ?? '',
      due_date: item.due_date ?? '',
      description: item.description ?? '',
      class_group: item.class_group ?? 'roque',
    })
    setEditFile(null)
    setIsEditing(true)
  }

  async function handleEditSave(e) {
    e.preventDefault()
    setSavingEdit(true)

    try {
      let file_url = selected.file_url ?? null
      if (editFile) {
        file_url = await uploadAssignmentFile(editFile)
      }

      const { error } = await supabase
        .from('assignments')
        .update({
          title: editForm.title.trim(),
          class_name: editForm.class_name.trim(),
          due_date: editForm.due_date,
          description: editForm.description.trim() || null,
          class_group: editForm.class_group,
          file_url,
        })
        .eq('id', selected.id)

      if (error) throw error

      setIsEditing(false)
      setEditFile(null)
      loadAssignments()
    } catch (err) {
      alert(`Could not save changes: ${err.message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  // ─── Per-person "mark done" (anyone, tracked by first name) ─────────────

  function findCompletion(assignmentId, name) {
    return (completionsByAssignment[assignmentId] ?? []).find((row) => namesMatch(row.first_name, name))
  }

  async function toggleMyCompletion(assignmentId) {
    if (!studentName) {
      promptForName((name) => {
        commitName(name)
        performToggleCompletion(assignmentId, name)
      })
      return
    }
    performToggleCompletion(assignmentId, studentName)
  }

  async function performToggleCompletion(assignmentId, name) {
    setBusyAssignmentId(assignmentId)
    const existing = findCompletion(assignmentId, name)

    if (existing) {
      const { error } = await supabase.from('assignment_completions').delete().eq('id', existing.id)
      if (error) alert(`Could not update: ${error.message}`)
    } else {
      const { error } = await supabase
        .from('assignment_completions')
        .insert({ assignment_id: assignmentId, first_name: name })
      if (error) alert(`Could not update: ${error.message}`)
    }

    setBusyAssignmentId(null)
    loadCompletions()
  }

  // ─── Help requests ────────────────────────────────────────────────────────

  function findHelpRequest(assignmentId, name) {
    return helpRequests.find(
      (row) => row.assignment_id === assignmentId && namesMatch(row.first_name, name),
    )
  }

  async function toggleMyHelpRequest(assignmentId) {
    if (!studentName) {
      promptForName((name) => {
        commitName(name)
        performToggleHelp(assignmentId, name)
      })
      return
    }
    performToggleHelp(assignmentId, studentName)
  }

  async function performToggleHelp(assignmentId, name) {
    setBusyAssignmentId(assignmentId)
    const existing = findHelpRequest(assignmentId, name)

    if (existing) {
      const { error } = await supabase.from('assignment_help_requests').delete().eq('id', existing.id)
      if (error) alert(`Could not update: ${error.message}`)
    } else {
      const { error } = await supabase
        .from('assignment_help_requests')
        .insert({ assignment_id: assignmentId, first_name: name })
      if (error) alert(`Could not update: ${error.message}`)
    }

    setBusyAssignmentId(null)
    loadHelpRequests()
  }

  async function resolveHelpRequest(id) {
    const { error } = await supabase.from('assignment_help_requests').delete().eq('id', id)
    if (error) {
      alert(`Could not update: ${error.message}`)
      return
    }
    loadHelpRequests()
  }

  function renderAssignmentList(items) {
    return (
      <ul className="space-y-2">
        {items.map((item) => {
          const itemCompletions = completionsByAssignment[item.id] ?? []
          const myCompletion = studentName ? findCompletion(item.id, studentName) : null
          const myHelp = studentName ? findHelpRequest(item.id, studentName) : null
          const isBusy = busyAssignmentId === item.id

          return (
            <li
              key={item.id}
              onClick={() => openModal(item)}
              className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-coral-300 hover:shadow-md"
            >
              <div>
                <p className={`font-medium ${myCompletion ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {item.title}
                </p>
                <p className="text-sm text-slate-500">
                  {t('assignments.due')} {formatDate(item.due_date, locale)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {studentName ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      myCompletion ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {myCompletion ? t('assignments.doneTag') : t('assignments.pendingTag')}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {t('assignments.peopleCompleted', { count: itemCompletions.length })}
                  </span>
                )}

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleMyCompletion(item.id)
                  }}
                  className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {myCompletion ? t('assignments.markNotDone') : t('assignments.markDone')}
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleMyHelpRequest(item.id)
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                    myHelp
                      ? 'border-coral-300 bg-coral-50 text-coral-700 hover:bg-coral-100'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {myHelp ? t('assignments.cancelHelp') : t('assignments.help')}
                </button>

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openModal(item)
                        startEditing(item)
                      }}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item)
                      }}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      {t('common.delete')}
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  function renderGroupSection(groupKey) {
    const grouped = groupedByClassGroup[groupKey]
    const classNames = Object.keys(grouped)
    if (classNames.length === 0) return null

    return (
      <section key={groupKey} className="space-y-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-slate-900">
            {t(`assignments.group${groupKey === 'roque' ? 'Roque' : 'Betances'}`)}
          </h3>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="space-y-6">
          {classNames.map((className) => (
            <div key={className}>
              <h4 className="mb-3 text-lg font-semibold text-slate-900">{className}</h4>
              {renderAssignmentList(grouped[className])}
            </div>
          ))}
        </div>
      </section>
    )
  }

  const hasAnyAssignments = assignments.length > 0

  return (
    <div className="space-y-8">
      {nameModal.open && (
        <NamePromptModal
          t={t}
          initialValue={studentName}
          dismissable={nameModal.dismissable}
          onSubmit={(name) => nameModal.onSubmit?.(name)}
          onClose={() => setNameModal({ open: false, dismissable: false, onSubmit: null })}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{t('assignments.heading')}</h2>
          <p className="mt-1 text-slate-600">{t('assignments.subheading')}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          {studentName && <p className="font-medium text-slate-700">{studentName}</p>}
          <button type="button" onClick={openChangeName} className="text-coral-600 hover:text-coral-800">
            {t('assignments.changeName')}
          </button>
        </div>
      </div>

      {!studentName && (
        <p className="text-sm text-slate-500">{t('assignments.enterNameHint')}</p>
      )}

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-coral-200 bg-coral-50/50 p-5 shadow-sm"
        >
          <h3 className="font-semibold text-coral-900">{t('assignments.addHeading')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              required
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              placeholder={t('assignments.classNamePlaceholder')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('assignments.titlePlaceholder')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={form.class_group}
              onChange={(e) => setForm({ ...form, class_group: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {GROUPS.map((group) => (
                <option key={group.key} value={group.key}>
                  {t(group.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700 disabled:opacity-50"
          >
            {submitting ? t('assignments.adding') : t('assignments.add')}
          </button>
          <p className="mt-2 text-xs text-coral-700/70">{t('assignments.addNote')}</p>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">{t('assignments.loading')}</p>
      ) : !hasAnyAssignments ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          {t('assignments.none')}
          {isAdmin ? t('assignments.useFormAbove') : ''}
        </div>
      ) : (
        <div className="space-y-10">
          {renderGroupSection('roque')}
          {renderGroupSection('betances')}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">{t('assignments.helpSectionHeading')}</h3>
        <p className="mt-1 text-sm text-slate-600">{t('assignments.helpSectionSubheading')}</p>

        {helpRequests.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t('assignments.helpNone')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {helpRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-coral-200 bg-coral-50/50 px-4 py-2.5"
              >
                <p className="text-sm text-slate-800">
                  <span className="font-semibold text-coral-800">{request.first_name}</span>{' '}
                  {t('assignments.helpAsking')}{' '}
                  <span className="font-semibold">
                    {request.assignments?.title ?? '—'}
                  </span>
                  {request.assignments?.class_name ? (
                    <span className="text-slate-500"> ({request.assignments.class_name})</span>
                  ) : null}
                </p>
                {(isAdmin || (studentName && namesMatch(studentName, request.first_name))) && (
                  <button
                    type="button"
                    onClick={() => resolveHelpRequest(request.id)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t('assignments.resolve')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!isEditing ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{selected.title}</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={t('common.close')}
                  >
                    ✕
                  </button>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-slate-500">{t('assignments.class')}</dt>
                    <dd className="text-slate-900">{selected.class_name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{t('assignments.groupLabel')}</dt>
                    <dd className="text-slate-900">
                      {t(
                        `assignments.group${
                          (selected.class_group ?? 'roque') === 'roque' ? 'Roque' : 'Betances'
                        }`,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{t('assignments.dueDate')}</dt>
                    <dd className="text-slate-900">{formatDate(selected.due_date, locale)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{t('assignments.completedBy')}</dt>
                    <dd className="text-slate-900">
                      {(completionsByAssignment[selected.id] ?? []).length === 0 ? (
                        <span className="text-slate-400">{t('assignments.noOneYet')}</span>
                      ) : (
                        <span>
                          {(completionsByAssignment[selected.id] ?? [])
                            .map((row) => row.first_name)
                            .join(', ')}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{t('assignments.description')}</dt>
                    <dd className="whitespace-pre-wrap text-slate-900">
                      {selected.description ? selected.description : (
                        <span className="text-slate-400">{t('assignments.noDescription')}</span>
                      )}
                    </dd>
                  </div>
                  {selected.file_url && (
                    <div>
                      <dt className="font-medium text-slate-500">{t('assignments.attachedFile')}</dt>
                      <dd className="mt-1 flex flex-wrap gap-2">
                        <a
                          href={selected.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-coral-700 hover:bg-slate-200"
                        >
                          {t('assignments.open')} {getFileName(selected.file_url)}
                        </a>
                        <a
                          href={selected.file_url}
                          download
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-coral-700 hover:bg-slate-200"
                        >
                          {t('assignments.download')}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>

                {isAdmin && (
                  <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => startEditing(selected)}
                      className="rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selected)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{t('assignments.editHeading')}</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={t('common.close')}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleEditSave} className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">{t('assignments.title')}</label>
                    <input
                      required
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">{t('assignments.class')}</label>
                    <input
                      required
                      value={editForm.class_name}
                      onChange={(e) => setEditForm({ ...editForm, class_name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">{t('assignments.groupLabel')}</label>
                    <select
                      value={editForm.class_group}
                      onChange={(e) => setEditForm({ ...editForm, class_group: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {GROUPS.map((group) => (
                        <option key={group.key} value={group.key}>
                          {t(group.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">{t('assignments.dueDate')}</label>
                    <input
                      required
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">{t('assignments.description')}</label>
                    <textarea
                      rows={4}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder={t('assignments.descriptionPlaceholder')}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      {selected.file_url ? t('assignments.replaceFile') : t('assignments.attachFile')}
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                      className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-coral-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-coral-700"
                    />
                    {selected.file_url && !editFile && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t('assignments.currentFile')} {getFileName(selected.file_url)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="flex-1 rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700 disabled:opacity-50"
                    >
                      {savingEdit ? t('common.saving') : t('assignments.saveChanges')}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
