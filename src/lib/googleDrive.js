const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`)
  }
  return data
}

// Google Drive's resumable upload endpoint is cross-origin. Using XMLHttpRequest
// here follows Google's browser/CORS upload pattern and also lets us report
// progress and handle 308 (Resume Incomplete) responses.
function uploadToResumableSession(file, uploadUrl, onProgress) {
  const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MiB; Google requires 256 KiB multiples.

  return new Promise((resolve, reject) => {
    let offset = 0
    let settled = false

    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error || 'Google Drive upload failed')))
    }

    const sendChunk = () => {
      if (settled) return

      const end = Math.min(offset + CHUNK_SIZE, file.size)
      const chunk = file.slice(offset, end)
      const xhr = new XMLHttpRequest()

      xhr.open('PUT', uploadUrl, true)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.setRequestHeader(
        'Content-Range',
        `bytes ${offset}-${end - 1}/${file.size}`,
      )

      if (xhr.upload) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress?.(Math.min(100, ((offset + event.loaded) / file.size) * 100))
          }
        })
      }

      xhr.onload = () => {
        // 200/201 means the whole file was accepted.
        if (xhr.status === 200 || xhr.status === 201) {
          settled = true
          try {
            resolve(JSON.parse(xhr.responseText || '{}'))
          } catch {
            fail(new Error('Google Drive returned an invalid upload response'))
          }
          return
        }

        // 308 means Google accepted this chunk but expects more data.
        if (xhr.status === 308) {
          const range = xhr.getResponseHeader('Range')
          if (range) {
            const match = range.match(/bytes=\d+-(\d+)/)
            if (match) offset = Number(match[1]) + 1
          } else {
            offset = end
          }

          if (offset >= file.size) {
            // A completed upload should normally return 200/201, so don't
            // guess the file ID if Google instead returns an incomplete 308.
            fail(new Error('Google Drive did not return the completed file after the final chunk'))
            return
          }

          onProgress?.((offset / file.size) * 100)
          sendChunk()
          return
        }

        let message = `Google Drive upload failed (${xhr.status})`
        try {
          const body = JSON.parse(xhr.responseText || '{}')
          message = body.error?.message || body.error || message
        } catch {
          // Keep the status-based message.
        }
        fail(new Error(message))
      }

      // Google may complete the upload but block the browser from reading the
      // final cross-origin response. In that case XHR fires `error` even though
      // the file is already in Drive. The server will locate the file by the
      // unique upload token returned by /api/drive/upload-session.
      xhr.onerror = () => {
        if (settled) return
        settled = true
        resolve({ uploadedWithoutResponse: true })
      }
      xhr.ontimeout = () => fail(new Error('The Google Drive upload timed out.'))
      xhr.send(chunk)
    }

    if (!file.size) {
      fail(new Error('Empty files are not supported for upload.'))
      return
    }

    sendChunk()
  })
}

export async function uploadFileToGoogleDrive(file, { folderId, onProgress } = {}) {
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

  const uploaded = await uploadToResumableSession(file, session.uploadUrl, onProgress)

  return requestJson('/api/drive/finalize', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      fileId: uploaded.id || undefined,
      uploadToken: session.uploadToken,
      name: file.name,
    }),
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
