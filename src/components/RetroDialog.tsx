import { Heading } from '@astryxdesign/core/Text'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Button } from '@astryxdesign/core/Button'
import { useState } from 'react'
import type { Requirement, Retro } from '../lib/store'
import RichTextField, { RichTextContent } from './RichTextField'

interface Props {
  requirement: Requirement
  retros: Retro[]
  onAdd: (retro: Retro) => void
  onClose: () => void
  embedded?: boolean
}

export default function RetroDialog({ requirement, retros, onAdd, onClose, embedded = false }: Props) {
  const [draft, setDraft] = useState('')
  const currentRetros = retros
    .filter((retro) => retro.reqId === requirement.id)
    .sort((a, b) => a.createdAt - b.createdAt)

  function save() {
    if (!draft.trim()) return
    onAdd({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      reqId: requirement.id,
      content: draft.trim(),
      createdAt: Date.now(),
    })
    setDraft('')
  }

  const panel = (
      <div className={embedded ? 'retro-panel__content' : 'modal modal--wide retro-dialog'}>
        <Heading level={3} accessibilityLevel={2} className="modal__title">复盘 · {requirement.name}</Heading>
        <div className="retro-list">
          {currentRetros.length === 0 ? (
            <div className="retro-list__empty">还没有复盘记录</div>
          ) : currentRetros.map((retro, index) => (
            <div className="retro-item" key={retro.id}>
              <div className="retro-item__idx">{String(index + 1).padStart(2, '0')}</div>
              <div className="retro-item__content"><RichTextContent value={retro.content} /></div>
            </div>
          ))}
        </div>
        <div className="field-label" style={{ marginTop: 18 }}>写复盘</div>
        <RichTextField label="写复盘" value={draft} placeholder="做得好的是什么，下次改什么…" onChange={setDraft} />
        <div className="modal__actions">
          <Button label="关闭" variant="ghost" onClick={onClose} />
          <Button label="保存复盘" variant="primary" onClick={save} style={{ opacity: draft.trim() ? 1 : 0.45 }} />
        </div>
      </div>
  )
  return embedded ? <div className="retro-panel">{panel}</div> : <WorkspaceOverlay label={`复盘 · ${requirement.name}`} onClose={onClose}>{panel}</WorkspaceOverlay>
}
