import { driveApi, json } from '../../lib/drive-server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const { fileId } = req.body || {}
    if (!fileId) return json(res, 400, { error: 'fileId is required' })

    const permissionResponse = await driveApi(`/files/${encodeURIComponent(fileId)}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader' }),
    })

    if (!permissionResponse.ok) {
      const text = await permissionResponse.text()
      return json(res, permissionResponse.status, { error: text || 'Could not make the file publicly readable' })
    }

    const fileResponse = await driveApi(`/files/${encodeURIComponent(fileId)}?fields=id,name,webViewLink,webContentLink`)
    const file = await fileResponse.json()
    if (!fileResponse.ok) return json(res, fileResponse.status, { error: file.error?.message || 'Could not read the uploaded file' })

    const baseUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`
    const separator = baseUrl.includes('?') ? '&' : '?'
    const url = `${baseUrl}${separator}name=${encodeURIComponent(file.name || '')}`

    return json(res, 200, {
      id: file.id,
      name: file.name,
      url,
      downloadUrl: file.webContentLink || `https://drive.google.com/uc?export=download&id=${file.id}`,
    })
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not finalize Drive file' })
  }
}
