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
  storageScope?: string
  storageBackend?: 'helper' | 'browser'
  createdAt?: number
  updatedAt?: number
}

export type LocalFileInfo = LocalAttachment

type DirectoryHandle = FileSystemDirectoryHandle
type WritableHandle = {
  queryPermission: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}
type StoredFile = {
  id: string
  spaceId: string
  ownerPhone?: string
  entityType: string
  entityId: string
  originalName: string
  relativePath: string
  mimeType: string
  size: number
  blob?: Blob
  handle?: FileSystemFileHandle
  root?: DirectoryHandle
  createdAt: number
  storageBackend?: 'helper' | 'browser'
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string; startIn?: DirectoryHandle }) => Promise<DirectoryHandle>
  showOpenFilePicker?: (options?: { multiple?: boolean; id?: string }) => Promise<RemovableFileHandle[]>
}

type RemovableFileHandle = FileSystemFileHandle & WritableHandle & { remove?: () => Promise<void> }
type MoveSource = { directory?: DirectoryHandle; handle: RemovableFileHandle }
type MoveDirectory = DirectoryHandle & { values(): AsyncIterable<FileSystemHandle> }
export type AttachmentMoveEntry = { name: string; read: () => Promise<File> }

const moveSources = new WeakMap<File, MoveSource>()

export function supportsAttachmentMoves() {
  return typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
    && typeof globalThis.FileSystemDirectoryHandle?.prototype.removeEntry === 'function'
}

export function supportsDirectFileSelection() {
  return typeof (window as DirectoryPickerWindow).showOpenFilePicker === 'function'
    && typeof (globalThis.FileSystemFileHandle?.prototype as RemovableFileHandle | undefined)?.remove === 'function'
}

export async function pickFilesToMove(multiple: boolean) {
  const picker = (window as DirectoryPickerWindow).showOpenFilePicker
  if (!picker) throw unsupportedError()
  const handles = await picker({ multiple, id: 'attachment-source-files' })
  return Promise.all(handles.map(async (handle) => {
    if (!handle.remove) throw unsupportedError()
    const file = await handle.getFile()
    moveSources.set(file, { handle })
    return file
  }))
}

export async function pickAttachmentSource() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) throw unsupportedError()
  const directory = await picker({ mode: 'readwrite', id: 'attachment-source' }) as MoveDirectory
  const entries: AttachmentMoveEntry[] = []
  for await (const entry of directory.values()) {
    if (entry.kind !== 'file') continue
    const handle = entry as RemovableFileHandle
    entries.push({
      name: handle.name,
      async read() {
        const file = await handle.getFile()
        moveSources.set(file, { directory, handle })
        return file
      },
    })
  }
  return { name: directory.name, entries: entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')) }
}

export const isAttachmentToMove = (file: File) => moveSources.has(file)

const DB_NAME = 'jawcat-local-files'
const DB_VERSION = 1
const FILE_STORE = 'files'
const HANDLE_STORE = 'settings'
const LOCAL_FILE_PREFIX = '/local-files/'
let directoryPromise: Promise<DirectoryHandle> | null = null

function currentOwnerPhone() {
  try { return localStorage.getItem('ws.session.v1') || 'anonymous' } catch { return 'anonymous' }
}

function unsupportedError() {
  return new Error('当前浏览器不支持本地文件夹保存，请使用 Chrome 或 Edge 桌面版')
}

function safeSegment(value: string, fallback: string) {
  const safe = String(value || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
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

type SavedDirectory = { key: string; handle: DirectoryHandle }

async function restoreDirectoryHandle() {
  const saved = await idbGet<SavedDirectory>(HANDLE_STORE, 'root')
  if (saved?.handle && !directoryPromise) directoryPromise = Promise.resolve(saved.handle)
}

export async function getAttachmentDestinationName() {
  await restoreDirectoryHandle()
  return (await directoryPromise)?.name ?? ''
}

async function requestWriteAccess(handle: FileSystemHandle) {
  const writable = handle as FileSystemHandle & WritableHandle
  const options = { mode: 'readwrite' } as const
  if (await writable.queryPermission(options) === 'granted') return
  if (await writable.requestPermission(options) !== 'granted') throw new Error('未获得本地文件或文件夹写入权限')
}

async function openDestinationPicker(previous?: DirectoryHandle) {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) throw unsupportedError()
  const next = await picker({ mode: 'readwrite', id: 'attachment-destination', ...(previous ? { startIn: previous } : {}) })
  await requestWriteAccess(next)
  if (previous && !await previous.isSameEntry(next) && !await idbGet<SavedDirectory>(HANDLE_STORE, 'legacy-root')) {
    await idbPut(HANDLE_STORE, { key: 'legacy-root', handle: previous } satisfies SavedDirectory)
  }
  await idbPut(HANDLE_STORE, { key: 'root', handle: next } satisfies SavedDirectory)
  return next
}

export async function chooseAttachmentDestination() {
  const previousPromise = directoryPromise
  const next = await openDestinationPicker(previousPromise ? await previousPromise : undefined)
  directoryPromise = Promise.resolve(next)
  window.dispatchEvent(new Event('attachment-destination-change'))
  return next.name
}

async function ensureDirectoryHandle() {
  if (!directoryPromise) {
    directoryPromise = openDestinationPicker().then((handle) => {
      window.dispatchEvent(new Event('attachment-destination-change'))
      return handle
    }).catch((error) => {
      directoryPromise = null
      throw error
    })
  }
  const handle = await directoryPromise
  await requestWriteAccess(handle)
  return handle
}

async function recordedDirectory(record: StoredFile) {
  const saved = record.root ?? (await idbGet<SavedDirectory>(HANDLE_STORE, 'legacy-root'))?.handle
    ?? (await idbGet<SavedDirectory>(HANDLE_STORE, 'root'))?.handle
  if (!saved) throw new Error('原附件的存放位置未授权')
  return saved
}

export async function authorizeAttachmentDirectory(fileId?: string) {
  const record = fileId ? await idbGet<StoredFile>(FILE_STORE, fileId) : undefined
  if (record?.storageBackend === 'browser' || (record && !record.storageBackend)) await requestWriteAccess(await recordedDirectory(record))
  else await ensureDirectoryHandle()
}

async function getNestedDirectory(root: DirectoryHandle, segments: string[], create = true) {
  let current = root
  for (const segment of segments) current = await current.getDirectoryHandle(segment, { create })
  return current
}

function missingEntry(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

async function removeFile(root: DirectoryHandle, relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean)
  const name = segments.pop()
  if (!name || segments[0] !== 'upload') throw new Error('本地附件路径无效')
  const directories = [root]
  for (const segment of segments) {
    try {
      directories.push(await directories[directories.length - 1].getDirectoryHandle(segment))
    } catch (error) {
      if (missingEntry(error)) break
      throw error
    }
  }
  if (directories.length === segments.length + 1) {
    try {
      await directories[directories.length - 1].removeEntry(name)
    } catch (error) {
      if (!missingEntry(error)) throw error
    }
  }
  // Remove empty application directories only, stopping at the shared upload root.
  for (let index = directories.length - 1; index > 1; index -= 1) {
    try {
      await directories[index - 1].removeEntry(segments[index - 1], { recursive: false })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'InvalidModificationError') return
      if (!missingEntry(error)) throw error
    }
  }
}

export function localFileUrl(fileId: string) {
  return `${LOCAL_FILE_PREFIX}${encodeURIComponent(fileId)}`
}

function helperAvailable() {
  return typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
}

function helperUrl(path: string) {
  return `/__local-files${path}`
}

async function helperRequest(path: string, init?: RequestInit) {
  if (!helperAvailable()) return null
  try {
    const response = await fetch(helperUrl(path), init)
    if (!response.ok) return null
    return await response.json() as { path?: string }
  } catch { return null }
}

export async function registerLocalFileServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/local-files-sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    await restoreDirectoryHandle()
  } catch (error) { console.warn('local file service worker unavailable', error) }
}

type AttachmentContext = { spaceId: string; entityType: string; entityId: string; fileName?: string; pathSegments?: string[] }

async function sameContents(a: Blob, b: Blob) {
  if (a.size !== b.size) return false
  const chunkSize = 1024 * 1024
  for (let offset = 0; offset < a.size; offset += chunkSize) {
    const left = new Uint8Array(await a.slice(offset, offset + chunkSize).arrayBuffer())
    const right = new Uint8Array(await b.slice(offset, offset + chunkSize).arrayBuffer())
    if (left.some((value, index) => value !== right[index])) return false
  }
  return true
}

export async function uploadLocalFile(file: File | Blob, context: AttachmentContext): Promise<LocalAttachment> {
  if (file instanceof File && isAttachmentToMove(file)) throw new Error('请通过表单保存待移动文件')
  return writeAttachment(file, context, await ensureDirectoryHandle())
}

async function writeAttachment(file: File | Blob, context: AttachmentContext, root: DirectoryHandle, verify = false): Promise<LocalAttachment> {
  const id = crypto.randomUUID()
  const originalName = context.fileName || (file instanceof File ? file.name : 'attachment')
  const baseSegments = context.pathSegments?.length ? context.pathSegments : [context.spaceId, context.entityType, context.entityId]
  const cleanName = safeSegment(originalName, 'attachment' + extension(originalName))
  const directorySegments = ['upload', ...baseSegments.map((segment) => safeSegment(segment, 'unassigned'))]
  let relativePath = [...directorySegments, cleanName].join('/')
  const mimeType = file.type || 'application/octet-stream'
  const now = Date.now()
  const metadata = { id, spaceId: context.spaceId, ownerPhone: currentOwnerPhone(), entityType: context.entityType, entityId: context.entityId, originalName, mimeType, size: file.size, createdAt: now }
  const attachment = {
    id, fileId: id, name: originalName, fileName: originalName, type: mimeType, mimeType, size: file.size,
    kind: mimeType.startsWith('image/') ? 'image' as const : 'file' as const,
    storageScope: context.spaceId, createdAt: now, updatedAt: now,
  }
  const storeFile = async (): Promise<LocalAttachment> => {
    const directory = await getNestedDirectory(root, directorySegments)
    let target: FileSystemFileHandle
    let name = cleanName
    for (let suffix = 1; ; suffix += 1) {
      try {
        await directory.getFileHandle(name)
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error
        target = await directory.getFileHandle(name, { create: true })
        break
      }
      const stem = cleanName.replace(/(\.[^.]*)$/, '')
      name = stem + '-' + suffix + cleanName.slice(stem.length)
    }
    relativePath = [...directorySegments, name].join('/')
    try {
      const writable = await target.createWritable()
      try {
        await writable.write(file)
        await writable.close()
      } catch (error) {
        await writable.abort().catch(() => undefined)
        throw error
      }
      if (verify && !await sameContents(file, await target.getFile())) throw new Error('目标文件校验失败')
      await idbPut(FILE_STORE, { ...metadata, relativePath, handle: target, root, storageBackend: 'browser' } satisfies StoredFile)
    } catch (error) {
      await directory.removeEntry(name).catch(() => undefined)
      throw error
    }
    return { ...attachment, url: localFileUrl(id), relativePath, storageBackend: 'browser' }
  }
  return navigator.locks ? navigator.locks.request('pm-workspace-attachment-write', storeFile) : storeFile()
}

export async function saveLocalAttachments(
  files: readonly File[],
  context: AttachmentContext | ((file: File, index: number) => AttachmentContext),
  persist: (attachments: LocalAttachment[]) => void | Promise<void>,
) {
  if (files.length && !directoryPromise) throw new Error('请先选择存放位置')
  const sourceHandles = [...new Set(files.flatMap((file) => {
    const source = moveSources.get(file)
    return source && !source.directory ? [source.handle] : []
  }))]
  // Confirm source permissions from the save gesture before staging any data.
  for (const handle of sourceHandles) await requestWriteAccess(handle)
  const root = files.length > 0 ? await ensureDirectoryHandle() : undefined
  const staged: LocalAttachment[] = []
  const sources: Array<{ file: File; source: MoveSource; attachment: LocalAttachment }> = []
  try {
    for (const [index, file] of files.entries()) {
      const source = moveSources.get(file)
      if (source) {
        const relative = await root?.resolve(source.handle)
        if (relative?.[0] === 'upload') throw new Error('「' + file.name + '」已在附件目录，请选择原始文件')
        for (const previous of sources) {
          if (await previous.source.handle.isSameEntry(source.handle)) throw new Error('「' + file.name + '」重复选择，请移除其中一项')
        }
      }
      try {
        const attachment = await writeAttachment(file, typeof context === 'function' ? context(file, index) : context, root!, Boolean(source))
        staged.push(attachment)
        if (source) sources.push({ file, source, attachment })
      } catch (error) {
        throw new Error('「' + file.name + '」保存失败：' + (error instanceof Error ? error.message : '请重试'))
      }
    }
    await persist(staged)
  } catch (error) {
    await Promise.allSettled(staged.map((attachment) => deleteLocalFile(attachment.fileId)))
    throw error
  }
  const retained: string[] = []
  for (const { file, source, attachment } of sources) {
    try {
      const liveHandle = source.directory ? await source.directory.getFileHandle(source.handle.name) : source.handle
      const record = await idbGet<StoredFile>(FILE_STORE, attachment.fileId)
      if (!record?.handle || !await liveHandle.isSameEntry(source.handle)
        || !await sameContents(file, await liveHandle.getFile())
        || !await sameContents(file, await record.handle.getFile())) {
        throw new Error('文件已变化')
      }
      if (source.directory) await source.directory.removeEntry(source.handle.name)
      else await source.handle.remove!()
    } catch {
      retained.push(file.name)
    }
  }
  return retained
}

export async function deleteLocalFile(fileId?: string) {
  if (!fileId) return
  const record = await idbGet<StoredFile>(FILE_STORE, fileId)
  if (!record || (record.ownerPhone && record.ownerPhone !== currentOwnerPhone())) return
  if (record.storageBackend === 'helper') {
    const result = await helperRequest('/delete-file?spaceId=' + encodeURIComponent(record.spaceId) + '&path=' + encodeURIComponent(record.relativePath), { method: 'POST' })
    if (!result) throw new Error('无法连接本地文件助手，请启动助手后重试')
  } else {
    const root = await recordedDirectory(record)
    await requestWriteAccess(root)
    const remove = () => removeFile(root, record.relativePath)
    if (navigator.locks) await navigator.locks.request('pm-workspace-attachment-write', remove)
    else await remove()
  }
  await idbDelete(FILE_STORE, fileId)
}

export async function listLocalFiles(entityType: string, entityId: string) {
  const ownerPhone = currentOwnerPhone()
  const records = (await idbAll()).filter((record) => record.entityType === entityType && record.entityId === entityId && (record.ownerPhone === ownerPhone || (!record.ownerPhone && ownerPhone === '13610392041')))
  return records.map((record) => ({ id: record.id, fileId: record.id, name: record.originalName, fileName: record.originalName, type: record.mimeType, mimeType: record.mimeType, size: record.size, kind: record.mimeType.startsWith('image/') ? 'image' as const : 'file' as const, url: localFileUrl(record.id), relativePath: record.relativePath, storageScope: record.spaceId, storageBackend: record.storageBackend || 'browser', createdAt: record.createdAt, updatedAt: record.createdAt }))
}

/** Read persisted metadata for one attachment. This is used to hydrate older
 * records that only stored a file id and to keep previews working after a
 * refresh. */
export async function getLocalFile(fileId?: string): Promise<LocalAttachment | null> {
  if (!fileId) return null
  const record = await idbGet<StoredFile>(FILE_STORE, fileId)
  if (!record || (record.ownerPhone && record.ownerPhone !== currentOwnerPhone())) return null
  return {
    id: record.id,
    fileId: record.id,
    name: record.originalName,
    fileName: record.originalName,
    type: record.mimeType,
    mimeType: record.mimeType,
    size: record.size,
    kind: record.mimeType.startsWith('image/') ? 'image' : 'file',
    url: localFileUrl(record.id),
    relativePath: record.relativePath,
    storageScope: record.spaceId,
    storageBackend: record.storageBackend || 'browser',
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
  }
}

/**
 * Browser security does not expose an OS-level "reveal in Finder/Explorer"
 * API. We still validate the folder and return its real relative path so the
 * UI can offer a safe, honest fallback (copy the path / open the in-app file).
 */
export async function openLocalFolder(relativePath?: string, storageScope?: string, storageBackend?: 'helper' | 'browser', fileId?: string) {
  const path = String(relativePath || '').split('/').filter(Boolean)
  if (path.length) path.pop()
  const relativeDirectory = path.join('/') || 'upload'
  // The browser cannot call Finder/Explorer itself. During local development,
  // the dev helper exposes a localhost-only bridge that performs that native
  // action for us. It is intentionally best-effort and never blocks the
  // browser-only fallback below.
  if (storageBackend !== 'browser' && typeof window !== 'undefined') {
    try {
      const response = await fetch(helperUrl(`/open-folder?spaceId=${encodeURIComponent(storageScope || '')}&path=${encodeURIComponent(relativeDirectory)}`), { method: 'POST' })
      if (response.ok) return { path: relativeDirectory, native: true }
    } catch { /* helper is optional */ }
  }
  const record = fileId ? await idbGet<StoredFile>(FILE_STORE, fileId) : undefined
  const root = record && record.storageBackend !== 'helper' ? await recordedDirectory(record) : await ensureDirectoryHandle()
  await requestWriteAccess(root)
  await getNestedDirectory(root, path, false)
  return { path: relativeDirectory, native: false }
}

export async function deleteLocalFilesForEntities(entities: ReadonlyArray<{ type: string; id: string }>, spaceId?: string) {
  const ownerPhone = currentOwnerPhone()
  const keys = new Set(entities.map(({ type, id }) => type + ':' + id))
  const records = (await idbAll()).filter((record) =>
    (record.ownerPhone === ownerPhone || (!record.ownerPhone && ownerPhone === '13610392041'))
    && (!spaceId || record.spaceId === spaceId) && keys.has(record.entityType + ':' + record.entityId))
  for (const { id } of records) await deleteLocalFile(id)
}

export async function deleteLocalFilesForEntity(entityType: string, entityId: string, spaceId?: string) {
  await deleteLocalFilesForEntities([{ type: entityType, id: entityId }], spaceId)
}

export async function deleteLocalFilesForSpace(spaceId: string) {
  const ownerPhone = currentOwnerPhone()
  const records = (await idbAll()).filter((record) => record.spaceId === spaceId && (record.ownerPhone === ownerPhone || (!record.ownerPhone && ownerPhone === '13610392041')))
  for (const { id } of records) await deleteLocalFile(id)
}

export async function readLocalAttachment(fileId: string) {
  const record = await idbGet<StoredFile>(FILE_STORE, fileId)
  if (!record || (record.ownerPhone && record.ownerPhone !== currentOwnerPhone())) throw new Error('本地文件记录不存在')
  const file = record.blob ?? await record.handle?.getFile()
  if (!file) throw new Error('本地附件不可读取')
  return file
}

export async function fetchLocalBuffer(url: string) {
  if (url.startsWith(LOCAL_FILE_PREFIX)) {
    const file = await readLocalAttachment(decodeURIComponent(url.slice(LOCAL_FILE_PREFIX.length)))
    return file.arrayBuffer()
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error('文件读取失败')
  return response.arrayBuffer()
}
