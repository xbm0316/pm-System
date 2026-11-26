import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Text } from '@astryxdesign/core/Text'
import { useRef, useState } from 'react'
import WorkspaceDialog, { WorkspaceDialogActions } from './WorkspaceDialog'

export default function ConfirmDataDeletion({ title, onClose, onDelete }: {
  title: string
  onClose: () => void
  onDelete: () => void | Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)

  async function confirm() {
    if (busy.current) return
    busy.current = true
    setDeleting(true)
    setError('')
    try {
      await onDelete()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除未完成，请重试')
    } finally {
      busy.current = false
      setDeleting(false)
    }
  }

  return <WorkspaceDialog title={title} onClose={() => { if (!busy.current) onClose() }}>
    <div className="app-dialog-form">
      <Text>会删除所有文件以及数据，确认删除吗？</Text>
      {error && <Banner status="error" title={<>{error}</>} />}
      <WorkspaceDialogActions>
        <Button label="取消" type="button" variant="secondary" isDisabled={deleting} onClick={onClose} />
        <Button label="确认删除" type="button" variant="destructive" isLoading={deleting} onClick={() => void confirm()} />
      </WorkspaceDialogActions>
    </div>
  </WorkspaceDialog>
}
