// Aliased to avoid clashing with the unrelated createClient() exported from db.js (creates a
// row in the `clients` table) that server/index.js also imports.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'client-files'

let supabase = null

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante. Ajoutez-les dans votre fichier .env à la racine du projet (Project Settings > API dans Supabase).'
    )
  }
  if (!supabase) {
    // The service role key bypasses Row Level Security — safe here because this only runs on
    // the backend, never sent to the browser.
    supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  return supabase
}

// Uploads a file buffer to the private 'client-files' bucket under a collision-proof path
// (timestamp-prefixed with the original filename), and returns that path — the value to persist
// as files.file_path so it can be looked up again later for signed URLs / deletion.
export async function uploadFileToStorage(fileBuffer, fileName, fileType) {
  const client = getSupabase()
  const path = `${Date.now()}-${fileName}`

  const { error } = await client.storage.from(BUCKET).upload(path, fileBuffer, {
    contentType: fileType || 'application/octet-stream',
    upsert: false,
  })

  if (error) {
    throw new Error(`Échec de l'envoi du fichier "${fileName}" vers Supabase Storage : ${error.message}`)
  }

  return path
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
