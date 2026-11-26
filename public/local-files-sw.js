const DB_NAME = 'jawcat-local-files'
const DB_VERSION = 1
const FILE_STORE = 'files'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

function getFile(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(FILE_STORE, 'readonly')
      const get = tx.objectStore(FILE_STORE).get(id)
      get.onsuccess = () => { resolve(get.result || null); db.close() }
      get.onerror = () => { reject(get.error); db.close() }
    }
  })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || !url.pathname.startsWith('/local-files/')) return
  event.respondWith((async () => {
    try {
      const id = decodeURIComponent(url.pathname.slice('/local-files/'.length))
      const record = await getFile(id)
      const file = record?.blob ?? await record?.handle?.getFile()
      if (!file) return new Response('File not found', { status: 404 })
      return new Response(file, { status: 200, headers: { 'Content-Type': record.mimeType || 'application/octet-stream', 'Content-Length': String(file.size), 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(record.originalName || 'attachment')}`, 'Cache-Control': 'no-store' } })
    } catch {
      return new Response('Local file unavailable', { status: 500 })
    }
  })())
})
