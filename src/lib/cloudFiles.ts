import { supabase } from './supabase'

const BUCKET = 'workspace-files-private'

export interface CloudFile {
  id: string
  space_id: string
  entity_type: string
  entity_id: string
  original_name: string
  mime_type: string
  size: number
  created_at: number
}

function objectPath(file: CloudFile) {
  return `${file.space_id}/${file.id}`
}

export async function findCloudFile(id: string) {
  const { data, error } = await supabase.from('workspace_files').select('*').eq('id', id).maybeSingle<CloudFile>()
  if (error) throw new Error(error.message)
  return data
}

export async function listCloudFiles(filters: { spaceId?: string; entityType?: string; entityId?: string }) {
  let query = supabase.from('workspace_files').select('*')
  if (filters.spaceId) query = query.eq('space_id', filters.spaceId)
  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.entityId) query = query.eq('entity_id', filters.entityId)
  const { data, error } = await query.order('created_at').returns<CloudFile[]>()
  if (error) throw new Error(error.message)
  return data || []
}

/** Returns whether this call created the cloud copy. For legacy imports, a
 * retry must be able to resume without duplicating a previously imported file. */
export async function uploadCloudFile(file: CloudFile, content: Blob) {
  const existing = await findCloudFile(file.id)
  if (existing) {
    if (existing.space_id !== file.space_id || existing.entity_type !== file.entity_type || existing.entity_id !== file.entity_id) {
      throw new Error('附件 ID 与现有记录冲突')
    }
    return false
  }

  const path = objectPath(file)
  const bucket = supabase.storage.from(BUCKET)
  const { error: fileError } = await bucket.upload(path, content, { contentType: file.mime_type, upsert: false })
  if (fileError) throw new Error(fileError.message)

  const { error: metadataError } = await supabase.from('workspace_files').insert(file)
  if (metadataError) {
    await bucket.remove([path])
    throw new Error(metadataError.message)
  }
  return true
}

export async function readCloudFile(file: CloudFile) {
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath(file))
  if (error) throw new Error(error.message)
  return data
}

export async function removeCloudFiles(files: CloudFile[]) {
  if (!files.length) return
  const bucket = supabase.storage.from(BUCKET)
  for (let offset = 0; offset < files.length; offset += 100) {
    const batch = files.slice(offset, offset + 100)
    const { error: storageError } = await bucket.remove(batch.map(objectPath))
    if (storageError) throw new Error(storageError.message)
    const { error: metadataError } = await supabase.from('workspace_files').delete().in('id', batch.map((file) => file.id))
    if (metadataError) throw new Error(metadataError.message)
  }
}
