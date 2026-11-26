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

export function normalizeTodos(value: unknown): Todo[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Todo => (
    item && typeof item.id === 'string' && typeof item.title === 'string'
    && typeof item.content === 'string' && Number.isFinite(item.dueAt) && Math.abs(item.dueAt) <= 8.64e15
  ))
}

export function workspaceTodoActions(update: (change: (current: Todo[]) => Todo[]) => Promise<void>) {
  function updateTodos(change: (current: Todo[]) => Todo[]) {
    return update(change).then(() => true, () => false)
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

  return { saveTodo, completeTodo, deleteTodo }
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
