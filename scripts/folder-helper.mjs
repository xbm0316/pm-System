import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
const port = Number(process.env.LOCAL_FILES_HELPER_PORT || 4174)
const root = path.resolve(process.env.LOCAL_FILES_ROOT || path.join(process.cwd(), 'data'))

function safeRelative(value) {
  const normalized = String(value || '').replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) throw new Error('invalid relative path')
  const clean = path.posix.normalize(normalized)
  if (clean === '..' || clean.startsWith('../')) throw new Error('invalid relative path')
  return clean
}

function resolveRelative(value) {
  const relative = safeRelative(value)
  const resolved = path.resolve(root, relative)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('invalid path')
  return resolved
}

function resolveScoped(spaceId, relativePath) {
  const scope = safeRelative(spaceId || 'anonymous')
  return { target: resolveRelative(path.posix.join(scope, relativePath)), scope, relativePath: safeRelative(relativePath) }
}

async function uniqueFile(target) {
  const extension = path.extname(target)
  const stem = target.slice(0, target.length - extension.length)
  let candidate = target
  let suffix = 1
  while (true) {
    try { await fs.access(candidate); candidate = `${stem}-${suffix}${extension}`; suffix += 1 } catch { return candidate }
  }
}

function nativeOpen(target) {
  const platform = os.platform()
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer.exe' : 'xdg-open'
  try {
    const child = spawn(command, [target], { detached: true, stdio: 'ignore' })
    child.on('error', () => undefined)
    child.unref()
  } catch { /* opening is best effort; the directory itself has been validated */ }
}

async function body(request) {
  let text = ''
  for await (const chunk of request) text += chunk
  return text ? JSON.parse(text) : {}
}

function respond(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(payload))
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
    if (request.method === 'OPTIONS') return respond(response, 204, {})
    if (request.method === 'GET' && url.pathname === '/health') return respond(response, 200, { ok: true, root })
    if (request.method === 'POST' && url.pathname === '/save-file') {
      const input = await body(request)
      const scoped = resolveScoped(input.spaceId, input.relativePath)
      const target = await uniqueFile(scoped.target)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, Buffer.from(String(input.data || ''), 'base64'))
      return respond(response, 200, { ok: true, path: path.relative(path.join(root, scoped.scope), target).replaceAll(path.sep, '/') })
    }
    if (request.method === 'POST' && url.pathname === '/delete-file') {
      const { target, scope, relativePath } = resolveScoped(url.searchParams.get('spaceId') || '', url.searchParams.get('path') || '')
      if (!relativePath.startsWith('upload/')) throw new Error('invalid attachment path')
      const upload = path.join(root, scope, 'upload')
      let directory = path.dirname(target)
      const actualRoot = await fs.realpath(root)
      const relativeDirectory = path.relative(root, directory)
      try {
        if (await fs.realpath(directory) !== path.join(actualRoot, relativeDirectory)) throw new Error('invalid attachment directory')
      } catch (error) {
        if (error.code === 'ENOENT') return respond(response, 200, { ok: true })
        throw error
      }
      await fs.rm(target, { force: true })
      while (directory !== upload) {
        try {
          await fs.rmdir(directory)
        } catch (error) {
          if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') break
          if (error.code !== 'ENOENT') throw error
        }
        directory = path.dirname(directory)
      }
      return respond(response, 200, { ok: true })
    }
    if (request.method === 'POST' && url.pathname === '/open-folder') {
      const scoped = resolveScoped(url.searchParams.get('spaceId') || '', url.searchParams.get('path') || '')
      const target = scoped.target
      await fs.access(target)
      await nativeOpen(target)
      return respond(response, 200, { ok: true, path: path.relative(path.join(root, scoped.scope), target).replaceAll(path.sep, '/') })
    }
    return respond(response, 404, { ok: false, error: 'not found' })
  } catch (error) {
    return respond(response, 400, { ok: false, error: error instanceof Error ? error.message : 'helper error' })
  }
})

await fs.mkdir(root, { recursive: true })
server.on('error', (error) => console.warn(`[local-files] native helper unavailable: ${error instanceof Error ? error.message : error}`))
server.listen(port, '127.0.0.1', () => console.log(`[local-files] native folder helper on http://127.0.0.1:${port} (root: ${root})`))

function shutdown() { server.close(() => process.exit(0)) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
