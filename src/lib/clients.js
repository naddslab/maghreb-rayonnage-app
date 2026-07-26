import { apiUrl } from './api'

// Shared by every function below: builds the full backend URL via apiUrl(), surfaces network
// failures (backend unreachable, DNS, etc.) as a descriptive Error, and — for non-2xx responses —
// prefers the `{ error: "..." }` message the API sends (see server/index.js) over a generic one.
async function request(path, options) {
  let res
  try {
    res = await fetch(apiUrl(path), options)
  } catch (err) {
    throw new Error(`Impossible de contacter le serveur (${path}) : ${err.message}`)
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.error || `Erreur ${res.status} lors de l'appel à ${path}.`)
  }

  return data
}

function postJson(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function putJson(path, body) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------- Clients ----------

export async function fetchAllClients() {
  return request('/api/clients')
}

export async function fetchClient(clientId) {
  return request(`/api/clients/${clientId}`)
}

export async function createClient(name, company, contact, email, phone, location, nextStep, value, importance, vaultId) {
  return postJson('/api/clients', { name, company, contact, email, phone, location, nextStep, value, importance, vaultId })
}

export async function updateClient(clientId, updates) {
  return putJson(`/api/clients/${clientId}`, updates)
}

export async function deleteClient(clientId) {
  return request(`/api/clients/${clientId}`, { method: 'DELETE' })
}

// ---------- Deal history ----------

export async function fetchDealHistory(clientId) {
  return request(`/api/clients/${clientId}/deal-history`)
}

export async function createDealHistory(clientId, oldValue, newValue, reason) {
  return postJson(`/api/clients/${clientId}/deal-history`, { oldValue, newValue, reason })
}

// ---------- Meetings ----------

export async function fetchMeetings(clientId) {
  return request(`/api/clients/${clientId}/meetings`)
}

export async function createMeeting(clientId, meetingDate, notes, meetingType) {
  return postJson(`/api/clients/${clientId}/meetings`, { meetingDate, notes, meetingType })
}

// ---------- Activities ----------

export async function fetchActivities(clientId) {
  return request(`/api/clients/${clientId}/activities`)
}

export async function createActivity(clientId, activityType, amount, description) {
  return postJson(`/api/clients/${clientId}/activities`, { activityType, amount, description })
}

// ---------- Files ----------

export async function fetchClientFiles(clientId) {
  return request(`/api/clients/${clientId}/files`)
}

// `file` is a File/Blob object from an <input type="file"> element. Uses the shared request()
// helper (same error handling as every other function here) — the only difference is the body
// is FormData instead of JSON, so no Content-Type header is set: the browser fills it in
// automatically, including the multipart boundary, which we'd otherwise get wrong by hand.
export async function uploadClientFile(clientId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return request(`/api/clients/${clientId}/files`, { method: 'POST', body: formData })
}

// A file not tied to any client (e.g. a personal document attached in chat without specifying
// who it's for) — same multipart upload, but hits /api/files instead of a :clientId-scoped route.
export async function uploadGeneralFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request('/api/files', { method: 'POST', body: formData })
}

export async function fetchGeneralFiles() {
  return request('/api/files/general')
}

export async function fetchFileUrl(fileId) {
  return request(`/api/files/${fileId}/url`)
}

export async function deleteFile(fileId) {
  return request(`/api/files/${fileId}`, { method: 'DELETE' })
}

export async function fetchAllFiles() {
  return request('/api/files')
}

// ---------- Revenue & goals ----------

// The current calendar month as reckoned in Morocco (Africa/Casablanca), regardless of the
// visitor's own device timezone — matches how the backend buckets revenue by month.
export function getCurrentMoroccoMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}`
}

export async function fetchRevenueChart(monthsBack = 12) {
  return request(`/api/revenue/chart?monthsBack=${encodeURIComponent(monthsBack)}`)
}

export async function fetchMonthlyRevenue(month) {
  return request(`/api/revenue/monthly?month=${encodeURIComponent(month)}`)
}

export async function fetchVaultRevenueChart(vaultId, monthsBack = 12) {
  return request(`/api/vaults/${encodeURIComponent(vaultId)}/revenue/chart?monthsBack=${encodeURIComponent(monthsBack)}`)
}

export async function fetchVaultMonthlyRevenue(vaultId, month) {
  return request(`/api/vaults/${encodeURIComponent(vaultId)}/revenue/monthly?month=${encodeURIComponent(month)}`)
}

export async function fetchMonthlyGoal(month) {
  return request(`/api/goals/${encodeURIComponent(month)}`)
}

export async function saveMonthlyGoal(month, targetValue) {
  return putJson(`/api/goals/${encodeURIComponent(month)}`, { targetValue })
}
