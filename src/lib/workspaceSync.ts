import { useCallback, useEffect, useRef, useState } from 'react'
import { hasLegacyAttachments, importLegacyAttachments } from './localFiles'
import { supabase } from './supabase'

export type WorkspaceModule = 'operations' | 'projects' | 'todos'
type ModuleRow = { module: WorkspaceModule; data: unknown; revision: number }
type ModuleRows = Partial<Record<WorkspaceModule, ModuleRow>>

const prefixes: Record<WorkspaceModule, string> = {
  operations: 'jawcat.operations.v4.',
  projects: 'jawcat.project-manager.v4.',
  todos: 'jawcat.workspace-todos.v1.',
}

function readBrowserCopies(ownerPhone: string, spaceId: string) {
  const copies: Partial<Record<WorkspaceModule, unknown>> = {}
  for (const module of Object.keys(prefixes) as WorkspaceModule[]) {
    try {
      const prefix = prefixes[module]
      const raw = localStorage.getItem(prefix + ownerPhone + '.' + spaceId)
        || (module === 'projects' && ownerPhone === '13610392041' ? localStorage.getItem(prefix + spaceId) : null)
      if (!raw) continue
      const value: unknown = JSON.parse(raw)
      if (module === 'todos' ? Array.isArray(value) : value && typeof value === 'object' && !Array.isArray(value)) {
        copies[module] = value
      }
    } catch {
      // The browser copy stays intact if it cannot be decoded.
    }
  }
  return copies
}

async function fetchRows(spaceId: string): Promise<ModuleRows> {
  const { data, error } = await supabase.from('workspace_module_state')
    .select('module,data,revision').eq('space_id', spaceId).returns<ModuleRow[]>()
  if (error) throw new Error(error.message)
  return Object.fromEntries((data || []).map((row) => [row.module, row]))
}

async function saveRow(spaceId: string, module: WorkspaceModule, data: unknown, revision?: number) {
  const table = supabase.from('workspace_module_state')
  const query = revision === undefined
    ? table.upsert({ space_id: spaceId, module, data, revision: 1 }, { onConflict: 'space_id,module', ignoreDuplicates: true })
    : table.update({ data, revision: revision + 1 }).eq('space_id', spaceId).eq('module', module).eq('revision', revision)
  const { data: row, error } = await query.select('module,data,revision').maybeSingle<ModuleRow>()
  if (error) throw new Error(error.message)
  return row
}

export function useWorkspaceSync(ownerPhone: string, spaceId: string) {
  const [rows, setRows] = useState<ModuleRows | null>(null)
  const [loadError, setLoadError] = useState('')
  const [writeError, setWriteError] = useState('')
  const [importing, setImporting] = useState(false)
  const [hasLocalAttachments, setHasLocalAttachments] = useState(false)
  const [imported, setImported] = useState(false)
  const [browserCopies] = useState(() => readBrowserCopies(ownerPhone, spaceId))
  const current = useRef<ModuleRows | null>(null)
  const serial = useRef<Promise<unknown>>(Promise.resolve())

  const queue = useCallback(<T,>(work: () => Promise<T>) => {
    const result = serial.current.then(work)
    serial.current = result.catch(() => undefined)
    return result
  }, [])

  const refresh = useCallback(() => queue(async () => {
    try {
      const next = await fetchRows(spaceId)
      current.current = next
      setRows(next)
      setLoadError('')
    } catch {
      if (!current.current) setLoadError('无法读取账号数据，请检查网络后重试')
    }
  }), [queue, spaceId])

  useEffect(() => {
    let active = true
    void hasLegacyAttachments(spaceId).then((found) => { if (active) setHasLocalAttachments(found) }).catch(() => undefined)
    return () => { active = false }
  }, [spaceId])

  useEffect(() => {
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(onVisible, 30_000)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [refresh])

  function update<T>(module: WorkspaceModule, visibleRevision: number | undefined, read: (value: unknown) => T, change: (value: T) => T): Promise<void> {
    return queue(async () => {
      try {
        if (!current.current) throw new Error('账号数据还在加载，请稍后重试')
        const previous = current.current[module]
        if (previous?.revision !== visibleRevision) throw new Error('数据已更新，请检查最新内容后重试')
        const row = await saveRow(spaceId, module, change(read(previous?.data)), previous?.revision)
        if (!row) {
          current.current = await fetchRows(spaceId)
          setRows(current.current)
          throw new Error('此数据刚在其他页面更新，请检查最新内容后重试')
        }
        current.current = { ...current.current, [module]: row }
        setRows(current.current)
        setWriteError('')
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '无法同步修改，请重试'
        setWriteError(message)
        throw new Error(message)
      }
    })
  }

  async function importFromBrowser() {
    if (importing) return false
    setImporting(true)
    setWriteError('')
    try {
      await queue(async () => {
        const cloud = await fetchRows(spaceId)
        // Import into empty modules only. Existing cloud data may have been
        // created on another device while this dialog was open.
        const empty = (Object.keys(browserCopies) as WorkspaceModule[]).filter((module) => !cloud[module])
        if (!imported && empty.length) {
          await importLegacyAttachments(spaceId, (type) => (
            type === 'requirement' || type === 'competitor'
              || (['product', 'ops-review'].includes(type) ? empty.includes('operations') : empty.includes('projects'))
          ))
          for (const module of empty) {
            const row = await saveRow(spaceId, module, browserCopies[module])
            if (!row) throw new Error('另一个页面刚写入此工作区，现有云端数据已保留')
          }
        } else if (!imported) {
          // Product-manager workspaces may only have browser-side attachments.
          await importLegacyAttachments(spaceId, (type) => type === 'requirement' || type === 'competitor')
        }
        current.current = await fetchRows(spaceId)
        setRows(current.current)
        setImported(true)
      })
      return true
    } catch (cause) {
      setWriteError(cause instanceof Error ? cause.message : '未能导入本机数据，请重试')
      await refresh()
      return false
    } finally {
      setImporting(false)
    }
  }

  return { rows, loadError, writeError, refresh, update, importFromBrowser, importing, imported, hasBrowserCopies: hasLocalAttachments || Object.keys(browserCopies).length > 0 }
}
