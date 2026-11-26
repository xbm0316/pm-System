import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number | string
  purpose?: 'form' | 'info'
  className?: string
  actions?: ReactNode
}

export default function WorkspaceDialog({ title, onClose, children, width = 480, purpose = 'form', className, actions }: Props) {
  const onOpenChange = (open: boolean) => { if (!open) onClose() }
  const header = <DialogHeader title={title} onOpenChange={onOpenChange} />
  const content = <LayoutContent label={title} className="app-dialog-content">{children}</LayoutContent>
  return (
    <Dialog isOpen onOpenChange={onOpenChange} purpose={purpose} width={width} maxHeight="90dvh" className={className}>
      {actions ? <Layout
        header={header}
        content={content}
        footer={<LayoutFooter hasDivider><HStack gap={2} hAlign="end" wrap="wrap">{actions}</HStack></LayoutFooter>}
      /> : <>{header}{content}</>}
    </Dialog>
  )
}

export function WorkspaceDialogActions({ children }: { children: ReactNode }) {
  return (
    <LayoutFooter className="app-dialog-actions" padding={0} hasDivider>
      <HStack gap={2} hAlign="end" wrap="wrap">{children}</HStack>
    </LayoutFooter>
  )
}

export function WorkspaceOverlay({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return <Dialog isOpen aria-label={label} onOpenChange={(open) => { if (!open) onClose() }} purpose="info"
    width="max-content" maxHeight="96dvh" padding={0} className="app-dialog-surface">
    {children}
  </Dialog>
}
