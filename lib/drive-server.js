const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing Vercel environment variable: ${name}`)
  return value
}

export async function getDriveAccessToken() {
  const body = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Could not refresh the Google Drive access token')
  }
  return data.access_token
}

export async function driveApi(path, options = {}) {
  const accessToken = await getDriveAccessToken()
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(`${DRIVE_API}${path}`, { ...options, headers })
}

export async function driveUploadApi(path, options = {}) {
  const accessToken = await getDriveAccessToken()
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(`${DRIVE_UPLOAD_API}${path}`, { ...options, headers })
}

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body)
}

export { DRIVE_SCOPE }
