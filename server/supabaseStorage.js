// Aliased to avoid clashing with the unrelated createClient() exported from db.js (creates a
// row in the `clients` table) that server/index.js also imports.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { basename } from 'path'

const BUCKET = 'client-files'

let supabase = null

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante. Ajoutez-les dans votre fichier .env à la racine du projet (Project Settings > API dans Supabase).'
    )
  }
  if (!supabase) {
    // We only ever use `.storage` here, never Realtime — but supabase-js unconditionally
    // constructs a RealtimeClient in its own constructor. On Node < 22 (no native WebSocket
    // global, e.g. the node:18-alpine image this API deploys with) that constructor throws
    // "Node.js detected but native WebSocket not found" unless a `transport` is supplied,
    // which would otherwise break every Storage call (upload/getUrl/delete) in production.
    // Passing the `ws` package here satisfies that requirement; the transport itself is never
    // actually opened since we never call `.channel()`/`.connect()`.
    supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      realtime: { transport: WebSocket },
    })
  }
  return supabase
}

// Uploads a file buffer to the private 'client-files' bucket under a collision-proof path
// (timestamp-prefixed with the original filename), and returns that path — the value to persist
// as files.file_path so it can be looked up again later for signed URLs / deletion.
export async function uploadFileToStorage(fileBuffer, fileName, fileType) {
  const client = getSupabase()
  // Strip any directory components (path traversal) and replace characters that could
  // cause bucket namespace pollution or storage-key ambiguity.
  const safeName = basename(fileName).replace(/[^a-zA-Z0-9._\-]/g, '_')
  const storagePath = `${Date.now()}-${safeName}`

  const { error } = await client.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType: fileType || 'application/octet-stream',
    upsert: false,
  })

  if (error) {
    throw new Error(`Échec de l'envoi du fichier "${fileName}" vers Supabase Storage : ${error.message}`)
  }

  return storagePath
}

// The bucket is private, so files have no public URL — every view/download needs a fresh signed
// URL. Valid for 1 hour.
export async function getFileUrl(filePath) {
  const client = getSupabase()
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(filePath, 60 * 60)

  if (error) {
    throw new Error(`Impossible de générer l'URL signée pour "${filePath}" : ${error.message}`)
  }

  return data.signedUrl
}

export async function deleteFileFromStorage(filePath) {
  const client = getSupabase()
  const { error } = await client.storage.from(BUCKET).remove([filePath])

  if (error) {
    throw new Error(`Impossible de supprimer le fichier "${filePath}" du stockage : ${error.message}`)
  }
}
