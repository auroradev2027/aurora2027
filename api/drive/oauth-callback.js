import { json } from '../../lib/drive-server.js'

function env(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing Vercel environment variable: ${name}`)
  return value
}

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })

  try {
    const { code, state, error } = req.query || {}
    if (error) return json(res, 400, { error: `Google authorization failed: ${error}` })
    if (!code || !state || state !== readCookie(req, 'drive_oauth_state')) {
      return json(res, 400, { error: 'Invalid or expired OAuth state. Start authorization again.' })
    }

    const body = new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: env('GOOGLE_REDIRECT_URI'),
      grant_type: 'authorization_code',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const tokens = await response.json()
    if (!response.ok || !tokens.refresh_token) {
      return json(res, response.status || 400, {
        error: tokens.error_description || tokens.error || 'Google did not return a refresh token. Re-authorize with consent.',
      })
    }

    res.setHeader('Set-Cookie', 'drive_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google Drive authorization complete</title>
<style>body{font-family:system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#172033}code,textarea{font-family:ui-monospace,monospace}textarea{width:100%;min-height:100px;padding:12px;box-sizing:border-box}li{margin:10px 0}.ok{color:#087443}</style></head>
<body><h1 class="ok">Google Drive authorization complete</h1>
<p>Copy the refresh token below into your Vercel environment variables as <code>GOOGLE_REFRESH_TOKEN</code>. Treat it like a password for this new Google account.</p>
<textarea readonly>${escapeHtml(tokens.refresh_token)}</textarea>
<h2>Next</h2><ol><li>Open Vercel → your project → Settings → Environment Variables.</li><li>Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_REFRESH_TOKEN</code>, and <code>GOOGLE_REDIRECT_URI</code>.</li><li>Redeploy the site.</li></ol>
<p>You can close this tab after saving the token.</p></body></html>`)
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not finish Google authorization' })
  }
}
