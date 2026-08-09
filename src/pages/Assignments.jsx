import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'
import { useLanguage } from '../context/LanguageContext'
import { getLocale } from '../lib/translations'

const emptyForm = {
  class_name: '',
  title: '',
  due_date: '',
  is_completed: false,
}

const emptyEditForm = {
  title: '',
  class_name: '',
  due_date: '',
  description: '',
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

  useEffect(() => {
    if (!selected) return
    const fresh = assignments.find((a) => a.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [assignments, selected?.id])

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{t('assignments.heading')}</h2>
        <p className="mt-1 text-slate-600">{t('assignments.subheading')}</p>
      </div>

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
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_completed}
                onChange={(e) => setForm({ ...form, is_completed: e.target.checked })}
              />
              {t('assignments.markCompleted')}
            </label>
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
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          {t('assignments.none')}
          {isAdmin ? t('assignments.useFormAbove') : ''}
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
                    onClick={() => openModal(item)}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-coral-300 hover:shadow-md"
                  >
                    <div>
                      <p
                        className={`font-medium ${
                          item.is_completed ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t('assignments.due')} {formatDate(item.due_date, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.is_completed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.is_completed ? t('assignments.done') : t('assignments.pending')}
                      </span>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleComplete(item.id, item.is_completed)
                            }}
                            className="text-xs font-medium text-coral-600 hover:text-coral-800"
                          >
                            {t('assignments.toggleStatus')}
                          </button>
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
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

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
                    <dt className="font-medium text-slate-500">{t('assignments.dueDate')}</dt>
                    <dd className="text-slate-900">{formatDate(selected.due_date, locale)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{t('assignments.status')}</dt>
                    <dd className="text-slate-900">
                      {selected.is_completed ? t('assignments.completed') : t('assignments.pending')}
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
