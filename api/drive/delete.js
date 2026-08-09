import { driveApi, json } from '../../lib/drive-server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const { fileId } = req.body || {}
    if (!fileId) return json(res, 400, { error: 'fileId is required' })

    const response = await driveApi(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' })
    if (!response.ok && response.status !== 404) {
      const text = await response.text()
      return json(res, response.status, { error: text || 'Could not delete the Drive file' })
    }

    return json(res, 200, { ok: true })
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not delete Drive file' })
  }
}
