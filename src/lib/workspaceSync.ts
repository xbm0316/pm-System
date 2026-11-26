import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type WorkspaceModule = 'operations' | 'projects' | 'todos'
type ModuleRow = { module: WorkspaceModule; data: unknown; revision: number }
type ModuleRows = Partial<Record<WorkspaceModule, ModuleRow>>

export async function fetchWorkspaceRows(spaceId: string): Promise<ModuleRows> {
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

export function useWorkspaceSync(spaceId: string) {
  const [rows, setRows] = useState<ModuleRows | null>(null)
  const [loadError, setLoadError] = useState('')
  const [writeError, setWriteError] = useState('')
  const current = useRef<ModuleRows | null>(null)
  const serial = useRef<Promise<unknown>>(Promise.resolve())

  const queue = useCallback(<T,>(work: () => Promise<T>) => {
    const result = serial.current.then(work)
    serial.current = result.catch(() => undefined)
    return result
  }, [])

  const refresh = useCallback(() => queue(async () => {
    try {
      const next = await fetchWorkspaceRows(spaceId)
      current.current = next
      setRows(next)
      setLoadError('')
    } catch {
      if (!current.current) setLoadError('无法读取账号数据，请检查网络后重试')
    }
  }), [queue, spaceId])

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
          current.current = await fetchWorkspaceRows(spaceId)
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

  return { rows, loadError, writeError, refresh, update }
}
