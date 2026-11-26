self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

async function getAttachment(clientId, id) {
  const client = clientId ? await self.clients.get(clientId) : null
  if (!client) return null
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel()
    const finish = (result) => {
      clearTimeout(timeout)
      port1.close()
      resolve(result)
    }
    const timeout = setTimeout(() => finish(null), 25000)
    port1.onmessage = (event) => finish(event.data)
    client.postMessage({ type: 'workspace-file-preview', id }, [port2])
  })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || !url.pathname.startsWith('/local-files/')) return
  event.respondWith((async () => {
    try {
      const id = decodeURIComponent(url.pathname.slice('/local-files/'.length))
      const attachment = await getAttachment(event.clientId, id)
      if (!attachment?.file) return new Response('File not found', { status: 404 })
      const { file, name } = attachment
      return new Response(file, {
        status: 200,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Length': String(file.size),
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
          'Content-Security-Policy': 'sandbox',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        },
      })
    } catch {
      return new Response('Attachment unavailable', { status: 500 })
    }
  })())
})
