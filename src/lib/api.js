// In dev, requests hit the Vite proxy at a relative /api path. In production (Vercel),
// the frontend and backend are deployed separately, so VITE_API_BASE_URL must point at the
// backend's public URL (e.g. https://your-app.onrender.com). Leave it unset for local dev.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export function apiUrl(path) {
  return `${API_BASE}${path}`
}
