export interface LocalAttachment {
  id: string
  fileId: string
  name: string
  fileName?: string
  type: string
  mimeType?: string
  size: number
  kind: 'image' | 'file'
  url: string
  relativePath?: string
  createdAt?: number
  updatedAt?: number
}

type DirectoryHandle = FileSystemDirectoryHandle
type DirectoryHandleWithPermission = DirectoryHandle & {
  queryPermission: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}
type StoredFile = {
  id: string
  spaceId: string
  entityType: string
  entityId: string
  originalName: string
  relativePath: string
  mimeType: string
  size: number
  blob: Blob
  createdAt: number
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle>
}

const DB_NAME = 'jawcat-local-files'
const DB_VERSION = 1
const FILE_STORE = 'files'
const HANDLE_STORE = 'settings'
const LOCAL_FILE_PREFIX = '/local-files/'
const objectUrls = new Map<string, string>()
let directoryPromise: Promise<DirectoryHandle> | null = null

function unsupportedError() {
  return new Error('当前浏览器不支持本地文件夹保存，请使用 Chrome 或 Edge 桌面版')
}

function safeSegment(value: string, fallback: string) {
  const safe = String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  return safe || fallback
}

function extension(name: string) {
  const match = name.match(/\.[a-z0-9]{1,16}$/i)
  return match ? match[0].toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const store = db.createObjectStore(FILE_STORE, { keyPath: 'id' })
        store.createIndex('entity', ['entityType', 'entityId'], { unique: false })
        store.createIndex('spaceId', 'spaceId', { unique: false })
      }
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('本地文件数据库打开失败'))
  })
}

async function idbPut(storeName: string, value: unknown) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('本地文件记录保存失败'))
  })
  db.close()
}

async function idbGet<T>(storeName: string, key: IDBValidKey) {
  const db = await openDb()
  const result = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error || new Error('本地文件记录读取失败'))
  })
  db.close()
  return result
}

async function idbDelete(storeName: string, key: IDBValidKey) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('本地文件记录删除失败'))
  })
  db.close()
}

async function idbAll() {
  const db = await openDb()
  const result = await new Promise<StoredFile[]>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly')
    const request = tx.objectStore(FILE_STORE).getAll()
    request.onsuccess = () => resolve((request.result || []) as StoredFile[])
    request.onerror = () => reject(request.error || new Error('本地文件记录读取失败'))
  })
  db.close()
  return result
}

async function restoreDirectoryHandle() {
  const saved = await idbGet<{ key: string; handle: DirectoryHandle }>(HANDLE_STORE, 'root')
  if (saved?.handle) directoryPromise = Promise.resolve(saved.handle)
}

function ensureDirectoryHandle() {
  if (!directoryPromise) {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.reject(unsupportedError())
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker
    if (!picker) return Promise.reject(unsupportedError())
    // This call must happen synchronously in the upload click's activation.
    directoryPromise = picker({ mode: 'readwrite' }).then(async (handle) => {
      await idbPut(HANDLE_STORE, { key: 'root', handle })
      return handle
    }).catch((error) => {
      directoryPromise = null
      throw error
    })
  }
  return directoryPromise.then(async (handle) => {
    const permission = await (handle as DirectoryHandleWithPermission).queryPermission({ mode: 'readwrite' })
    if (permission === 'granted') return handle
    const requested = await (handle as DirectoryHandleWithPermission).requestPermission({ mode: 'readwrite' })
    if (requested !== 'granted') throw new Error('未获得本地文件夹写入权限')
    return handle
  })
}

async function getNestedDirectory(root: DirectoryHandle, segments: string[], create = true) {
  let current = root
  for (const segment of segments) current = await current.getDirectoryHandle(segment, { create })
  return current
}

async function getFileHandle(root: DirectoryHandle, relativePath: string, create = false) {
  const segments = relativePath.split('/').filter(Boolean)
  const name = segments.pop()
  if (!name) throw new Error('本地文件路径无效')
  const directory = await getNestedDirectory(root, segments, create)
  return directory.getFileHandle(name, { create })
}

async function removeFile(root: DirectoryHandle, relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean)
  const name = segments.pop()
  if (!name) return
  const directory = await getNestedDirectory(root, segments, false)
  await directory.removeEntry(name)
}

export function localFileUrl(fileId: string) {
  return `${LOCAL_FILE_PREFIX}${encodeURIComponent(fileId)}`
}

export async function registerLocalFileServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/local-files-sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    await restoreDirectoryHandle()
  } catch (error) { console.warn('local file service worker unavailable', error) }
}

export async function uploadLocalFile(file: File | Blob, context: { spaceId: string; entityType: string; entityId: string; fileName?: string }) {
  const root = await ensureDirectoryHandle()
  const id = crypto.randomUUID()
  const originalName = context.fileName || (file instanceof File ? file.name : 'attachment')
  const relativePath = ['uploads', safeSegment(context.spaceId, 'default-space'), safeSegment(context.entityType, 'generic'), safeSegment(context.entityId, 'unassigned'), `${id}${extension(originalName)}`].join('/')
  const target = await getFileHandle(root, relativePath, true)
  const writable = await target.createWritable()
  await writable.write(file)
  await writable.close()
  const blob = file instanceof Blob ? file : new Blob([file])
  const now = Date.now()
  await idbPut(FILE_STORE, { id, spaceId: context.spaceId, entityType: context.entityType, entityId: context.entityId, originalName, relativePath, mimeType: file.type || 'application/octet-stream', size: file.size, blob, createdAt: now } satisfies StoredFile)
  const objectUrl = URL.createObjectURL(blob)
  objectUrls.set(id, objectUrl)
  return { id, fileId: id, name: originalName, fileName: originalName, type: file.type || 'application/octet-stream', mimeType: file.type || 'application/octet-stream', size: file.size, kind: (file.type || '').startsWith('image/') ? 'image' as const : 'file' as const, url: objectUrl, relativePath, createdAt: now, updatedAt: now } satisfies LocalAttachment
}

export async function deleteLocalFile(fileId?: string) {
  if (!fileId) return
  const record = await idbGet<StoredFile>(FILE_STORE, fileId)
  if (record) {
    try { await removeFile(await ensureDirectoryHandle(), record.relativePath) } catch { /* file may already be removed */ }
  }
  const objectUrl = objectUrls.get(fileId)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrls.delete(fileId)
  await idbDelete(FILE_STORE, fileId)
}

export async function listLocalFiles(entityType: string, entityId: string) {
  const records = (await idbAll()).filter((record) => record.entityType === entityType && record.entityId === entityId)
  return records.map((record) => ({ id: record.id, fileId: record.id, name: record.originalName, fileName: record.originalName, type: record.mimeType, mimeType: record.mimeType, size: record.size, kind: record.mimeType.startsWith('image/') ? 'image' as const : 'file' as const, url: localFileUrl(record.id), relativePath: record.relativePath, createdAt: record.createdAt, updatedAt: record.createdAt }))
}

export async function deleteLocalFilesForEntity(entityType: string, entityId: string) {
  const attachments = await listLocalFiles(entityType, entityId)
  await Promise.all(attachments.map((attachment) => deleteLocalFile(attachment.fileId || attachment.id)))
}

export async function deleteLocalFilesForSpace(spaceId: string) {
  const records = (await idbAll()).filter((record) => record.spaceId === spaceId)
  await Promise.all(records.map((record) => deleteLocalFile(record.id)))
}

export async function fetchLocalBuffer(url: string) {
  if (url.startsWith(LOCAL_FILE_PREFIX)) {
    const id = decodeURIComponent(url.slice(LOCAL_FILE_PREFIX.length))
    const record = await idbGet<StoredFile>(FILE_STORE, id)
    if (!record) throw new Error('本地文件记录不存在')
    return record.blob.arrayBuffer()
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error('文件读取失败')
  return response.arrayBuffer()
}
