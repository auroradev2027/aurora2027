import { driveApi, json } from '../../lib/drive-server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const { fileId: requestedFileId, uploadToken, name } = req.body || {}
    let fileId = requestedFileId

    // The browser can upload the final chunk successfully while CORS prevents
    // it from reading Google's 200/201 response. When that happens, recover
    // the Drive file server-side using the unique appProperties upload token.
    if (!fileId && uploadToken) {
      let file = null
      for (let attempt = 0; attempt < 4 && !file; attempt += 1) {
        const q = `appProperties has { key='classOrganizerUploadToken' and value='${uploadToken.replace(/'/g, "\\'")}' } and trashed = false`
        const lookup = await driveApi(`/files?spaces=drive&q=${encodeURIComponent(q)}&pageSize=10&fields=files(id,name,mimeType,size,webViewLink,webContentLink)` )
        const data = await lookup.json()
        if (!lookup.ok) return json(res, lookup.status, { error: data.error?.message || 'Could not locate the uploaded Drive file' })
        file = data.files?.[0] || null
        if (!file && attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
      if (!file) {
        return json(res, 409, { error: `The file was uploaded, but Google Drive has not made it searchable yet${name ? ` (${name})` : ''}. Please try the upload again.` })
      }
      fileId = file.id
    }

    if (!fileId) return json(res, 400, { error: 'fileId or uploadToken is required' })

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
