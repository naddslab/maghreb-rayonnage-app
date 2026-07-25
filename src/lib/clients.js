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

export async function createClient(name, company, contact, email, phone, location, nextStep, value, importance) {
  return postJson('/api/clients', { name, company, contact, email, phone, location, nextStep, value, importance })
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
