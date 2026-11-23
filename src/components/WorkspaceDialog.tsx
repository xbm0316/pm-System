import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number | string
  purpose?: 'form' | 'info'
  className?: string
}

export default function WorkspaceDialog({ title, onClose, children, width = 480, purpose = 'form', className }: Props) {
  const onOpenChange = (open: boolean) => { if (!open) onClose() }
  return (
    <Dialog isOpen onOpenChange={onOpenChange} purpose={purpose} width={width} maxHeight="90dvh" className={className}>
      <DialogHeader title={title} onOpenChange={onOpenChange} />
      {children}
    </Dialog>
  )
}

export function WorkspaceOverlay({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return <Dialog isOpen aria-label={label} onOpenChange={(open) => { if (!open) onClose() }} purpose="info"
    width="max-content" maxHeight="96dvh" padding={0} className="app-dialog-surface">
    {children}
  </Dialog>
}
