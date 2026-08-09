// In dev, requests hit the Vite proxy at a relative /api path. In production (Vercel),
// the frontend and backend are deployed separately, so VITE_API_BASE_URL must point at the
// backend's public URL (e.g. https://your-app.onrender.com). Leave it unset for local dev.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export function apiUrl(path) {
  return `${API_BASE}${path}`
}

// The backend (server/index.js) requires "Authorization: Bearer <API_KEY>" on every route except
// GET /api/health — VITE_API_KEY must be set to the same value as the server's API_KEY, or every
// request from this app will get a 401. Spread this into every fetch() call's headers.
export function authHeaders() {
  const key = import.meta.env.VITE_API_KEY || ''
  return key ? { Authorization: `Bearer ${key}` } : {}
}
