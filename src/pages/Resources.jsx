import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../context/AdminContext'
import { useLanguage } from '../context/LanguageContext'
import { deleteGoogleDriveFile, uploadFileToGoogleDrive } from '../lib/googleDrive'

const CATEGORY_KEYS = ['Study Guides', 'Test Summaries', 'College Apps']

const emptyForm = {
  title: '',
  category: 'Study Guides',
  description: '',
}

export default function Resources() {
  const { isAdmin } = useAdmin()
  const { t } = useLanguage()
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const loadResources = useCallback(async () => {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('uploaded_at', { ascending: false })

    if (!error) setResources(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  const grouped = useMemo(() => {
    return CATEGORY_KEYS.reduce((acc, category) => {
      acc[category] = resources.filter((r) => r.category === category)
      return acc
    }, {})
  }, [resources])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) {
      alert('Please choose a PDF or image file.')
      return
    }

    setUploading(true)
    let driveFile
    try {
      driveFile = await uploadFileToGoogleDrive(file)
    } catch (error) {
      setUploading(false)
      alert(`Upload failed: ${error.message}`)
      return
    }

    const { error: insertError } = await supabase.from('resources').insert({
      title: form.title.trim() || file.name,
      category: form.category,
      description: form.description.trim() || null,
      file_url: driveFile.url,
    })

    setUploading(false)
    if (insertError) {
      try { await deleteGoogleDriveFile(driveFile.url) } catch { /* keep the file if cleanup fails */ }
      alert(`File uploaded but record failed: ${insertError.message}`)
      return
    }

    setForm(emptyForm)
    setFile(null)
    e.currentTarget.reset()
    loadResources()
  }

  function startEditTitle(item) {
    setEditingId(item.id)
    setEditTitle(item.title)
  }

  function cancelEditTitle() {
    setEditingId(null)
    setEditTitle('')
  }

  async function saveEditTitle(id) {
    const trimmed = editTitle.trim()
    if (!trimmed) {
      alert('Title cannot be empty.')
      return
    }

    setSavingEdit(true)
    const { error } = await supabase.from('resources').update({ title: trimmed }).eq('id', id)
    setSavingEdit(false)

    if (error) {
      alert(`Could not update title: ${error.message}`)
      return
    }

    setEditingId(null)
    setEditTitle('')
    loadResources()
  }

  async function handleDelete(item) {
    if (!confirm(t('resources.deleteConfirm', { name: item.title }))) return

    const { error } = await supabase.from('resources').delete().eq('id', item.id)
    if (error) {
      alert(`Could not delete: ${error.message}`)
      return
    }

    try {
      await deleteGoogleDriveFile(item.file_url)
    } catch {
      // The database record is already gone; keep the Drive file if cleanup fails.
    }

    loadResources()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{t('resources.heading')}</h2>
        <p className="mt-1 text-slate-600">{t('resources.subheading')}</p>
      </div>

      <form
        onSubmit={handleUpload}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="font-semibold text-slate-900">{t('resources.uploadHeading')}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('resources.titleOptionalPlaceholder')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {CATEGORY_KEYS.map((cat) => (
              <option key={cat} value={cat}>
                {t(`resources.categories.${cat}`)}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-coral-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-coral-700"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('resources.descriptionOptionalPlaceholder')}
            rows={2}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-3"
          />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="mt-4 rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700 disabled:opacity-50"
        >
          {uploading ? t('resources.uploading') : t('resources.upload')}
        </button>
      </form>

      {loading ? (
        <p className="text-slate-500">{t('resources.loading')}</p>
      ) : (
        <div className="space-y-8">
          {CATEGORY_KEYS.map((category) => (
            <section key={category}>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">
                {t(`resources.categories.${category}`)}
              </h3>
              {grouped[category].length === 0 ? (
                <p className="text-sm text-slate-500">{t('resources.noFiles')}</p>
              ) : (
                <ul className="space-y-2">
                  {grouped[category].map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        {editingId === item.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => saveEditTitle(item.id)}
                              className="rounded-lg bg-coral-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-coral-700 disabled:opacity-50"
                            >
                              {savingEdit ? t('common.saving') : t('common.save')}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditTitle}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <p className="truncate font-medium text-slate-900">{item.title}</p>
                        )}
                        {item.description && (
                          <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>
                        )}
                        <p className="text-xs text-slate-500">
                          {new Date(item.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-coral-700 hover:bg-slate-200"
                        >
                          {t('resources.open')}
                        </a>
                        {isAdmin && editingId !== item.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditTitle(item)}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {t('resources.editTitle')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              {t('common.delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
