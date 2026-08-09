import crypto from 'node:crypto'
import { json } from '../../lib/drive-server.js'

function env(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing Vercel environment variable: ${name}`)
  return value
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })

  try {
    const state = crypto.randomBytes(32).toString('hex')
    const redirectUri = env('GOOGLE_REDIRECT_URI')
    const params = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/drive.file',
      state,
    })

    res.setHeader('Set-Cookie', `drive_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`)
    res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
    res.end()
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not start Google authorization' })
  }
}
