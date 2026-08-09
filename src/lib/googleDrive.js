const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`)
  }
  return data
}

export async function uploadFileToGoogleDrive(file, { folderId } = {}) {
  const session = await requestJson('/api/drive/upload-session', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      folderId: folderId || undefined,
    }),
  })

  const uploadResponse = await fetch(session.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Length': String(file.size),
    },
    body: file,
  })

  const uploaded = await uploadResponse.json().catch(() => ({}))
  if (!uploadResponse.ok) {
    throw new Error(uploaded.error?.message || uploaded.error || `Google Drive upload failed (${uploadResponse.status})`)
  }

  return requestJson('/api/drive/finalize', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fileId: uploaded.id }),
  })
}

export async function deleteGoogleDriveFile(fileUrl) {
  const fileId = getGoogleDriveFileId(fileUrl)
  if (!fileId) return

  await requestJson('/api/drive/delete', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fileId }),
  })
}

export function getGoogleDriveFileId(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const pathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/)
    if (pathMatch) return pathMatch[1]
    return parsed.searchParams.get('id') || ''
  } catch {
    return ''
  }
}

export function getGoogleDriveFileName(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return decodeURIComponent(parsed.searchParams.get('name') || '')
  } catch {
    return ''
  }
}
