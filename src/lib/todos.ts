import { useEffect, useState } from 'react'
import { uid } from './store'

export interface TodoFields {
  title: string
  content: string
  dueAt: number
}

export interface Todo extends TodoFields {
  id: string
  createdAt?: number
  completedAt?: number
}

const HOUR = 60 * 60 * 1000
const dateTimeFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' })

export function formatTodoDueAt(dueAt: number) {
  return dateTimeFormat.format(dueAt)
}

function readTodos(storageKey: string): Todo[] {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return []
  const saved: unknown = JSON.parse(raw)
  return Array.isArray(saved) ? saved : []
}

export function useWorkspaceTodos(ownerPhone: string, spaceId: string) {
  const storageKey = `jawcat.workspace-todos.v1.${ownerPhone}.${spaceId}`
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      return readTodos(storageKey)
    } catch {
      return []
    }
  })
  const [error, setError] = useState('')

  useEffect(() => {
    function refreshFromStorage(event: StorageEvent) {
      if (event.storageArea !== localStorage || (event.key !== storageKey && event.key !== null)) return
      try {
        setTodos(readTodos(storageKey))
        setError('')
      } catch {
        setError('无法读取此工作空间的待办事项')
      }
    }
    window.addEventListener('storage', refreshFromStorage)
    return () => window.removeEventListener('storage', refreshFromStorage)
  }, [storageKey])

  function updateTodos(update: (current: Todo[]) => Todo[]) {
    try {
      const next = update(readTodos(storageKey))
      localStorage.setItem(storageKey, JSON.stringify(next))
      setTodos(next)
      setError('')
      return true
    } catch {
      setError('未能保存待办事项，请检查浏览器存储设置后重试')
      return false
    }
  }

  function saveTodo(fields: TodoFields, id?: string) {
    if (id) return updateTodos((current) => current.map((item) => item.id === id ? { ...item, ...fields } : item))
    const todo: Todo = { ...fields, id: uid(), createdAt: Date.now() }
    return updateTodos((current) => [...current, todo])
  }

  function completeTodo(id: string) {
    const completedAt = Date.now()
    return updateTodos((current) => current.map((item) => item.id === id && item.completedAt === undefined ? { ...item, completedAt } : item))
  }

  function deleteTodo(id: string) {
    return updateTodos((current) => current.filter((item) => item.id !== id))
  }

  return { todos, error, saveTodo, completeTodo, deleteTodo }
}

export function useTodoReminders(todos: Todo[]) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    let timer: number | undefined
    const unfinished = todos.filter((item) => item.completedAt === undefined)

    function updateClock() {
      window.clearTimeout(timer)
      const current = Date.now()
      setNow(current)
      let nextBoundary = Infinity
      for (const item of unfinished) {
        if (item.dueAt <= current) continue
        const reminderStart = item.dueAt - HOUR
        nextBoundary = Math.min(nextBoundary, reminderStart > current ? reminderStart : item.dueAt)
      }
      if (Number.isFinite(nextBoundary)) {
        timer = window.setTimeout(updateClock, Math.min(nextBoundary - current, 2_147_483_647))
      }
    }

    updateClock()
    document.addEventListener('visibilitychange', updateClock)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', updateClock)
    }
  }, [todos])

  return todos.filter((item) => item.completedAt === undefined && item.dueAt > now && item.dueAt - now <= HOUR)
    .sort((a, b) => a.dueAt - b.dueAt)
}
