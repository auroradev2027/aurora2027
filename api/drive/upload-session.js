import { driveUploadApi, json } from '../../lib/drive-server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const { name, mimeType, size, folderId } = req.body || {}
    if (!name || !mimeType || !Number.isFinite(size) || size < 0) {
      return json(res, 400, { error: 'name, mimeType, and size are required' })
    }

    const parents = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID
    const metadata = {
      name,
      mimeType,
      ...(parents ? { parents: [parents] } : {}),
    }

    const response = await driveUploadApi('?uploadType=resumable&fields=id,name,mimeType,webViewLink,webContentLink', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(size),
      },
      body: JSON.stringify(metadata),
    })

    if (!response.ok) {
      const text = await response.text()
      return json(res, response.status, { error: text || 'Google Drive rejected the upload session' })
    }

    const uploadUrl = response.headers.get('location')
    if (!uploadUrl) return json(res, 502, { error: 'Google Drive did not return an upload session URL' })

    return json(res, 200, { uploadUrl })
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not create upload session' })
  }
}
