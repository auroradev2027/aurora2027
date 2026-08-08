import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Study Guides', 'Test Summaries', 'College Apps']

const emptyForm = {
  title: '',
  category: 'Study Guides',
}

export default function Resources() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

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
    return CATEGORIES.reduce((acc, category) => {
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
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('resources')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setUploading(false)
      alert(`Upload failed: ${uploadError.message}`)
      return
    }

    const { data: urlData } = supabase.storage.from('resources').getPublicUrl(path)

    const { error: insertError } = await supabase.from('resources').insert({
      title: form.title.trim() || file.name,
      category: form.category,
      file_url: urlData.publicUrl,
    })

    setUploading(false)
    if (insertError) {
      alert(`File uploaded but record failed: ${insertError.message}`)
      return
    }

    setForm(emptyForm)
    setFile(null)
    e.currentTarget.reset()
    loadResources()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Resource Hub</h2>
        <p className="mt-1 text-slate-600">
          Upload study guides, test summaries, and college app materials for the class.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="font-semibold text-slate-900">Upload a Resource</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title (optional — uses filename)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
          />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {loading ? (
        <p className="text-slate-500">Loading resources...</p>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map((category) => (
            <section key={category}>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">{category}</h3>
              {grouped[category].length === 0 ? (
                <p className="text-sm text-slate-500">No files yet.</p>
              ) : (
                <ul className="space-y-2">
                  {grouped[category].map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(item.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-slate-200"
                      >
                        Open
                      </a>
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
