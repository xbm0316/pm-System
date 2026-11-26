import { useToast } from '@astryxdesign/core/Toast'
import { useRef, useState } from 'react'
import { saveLocalAttachments } from './localFiles'

const MB = 1024 * 1024

export function useAttachmentDraft({ maxFiles = 20, maxSize, maxTotal, single = false }: {
  maxFiles?: number
  maxSize?: number
  maxTotal?: number
  single?: boolean
} = {}) {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const toast = useToast()

  function add(incoming: File[], existing: ReadonlyArray<{ size: number }> = []) {
    if (savingRef.current || !incoming.length) return
    const valid = incoming.filter((file) => file.size > 0 && (!maxSize || file.size <= maxSize * MB))
    const next = single && valid.length ? valid.slice(0, 1) : [...files, ...valid]
    if (existing.length + next.length > maxFiles) {
      setError('最多可保存 ' + maxFiles + ' 个附件')
      return
    }
    if (maxTotal && [...existing, ...next].reduce((total, file) => total + file.size, 0) > maxTotal * MB) {
      setError('附件总大小不能超过 ' + maxTotal + ' MB')
      return
    }
    setFiles(next)
    setError(valid.length === incoming.length ? '' : maxSize ? '空文件或超过 ' + maxSize + ' MB 的文件未添加' : '空文件未添加')
  }

  function reset() {
    setFiles([])
    setError('')
  }

  async function save(
    context: Parameters<typeof saveLocalAttachments>[1],
    persist: Parameters<typeof saveLocalAttachments>[2],
  ) {
    if (savingRef.current) return false
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const retained = await saveLocalAttachments(files, context, persist)
      if (retained.length) toast({
        type: 'info',
        body: '附件已保存，源文件仍在原位置：' + retained.join('、'),
        isAutoHide: false,
      })
      reset()
      return true
    } catch (error) {
      setError(error instanceof Error && error.name !== 'AbortError' ? error.message : '未完成附件保存，请重试')
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return {
    files, error, saving, add, save, reset, setError,
    remove: (index: number) => { setFiles((current) => current.filter((_, i) => i !== index)); setError('') },
  }
}
