import { useState } from 'react'
import type { Requirement, Retro } from '../lib/store'

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

  return (
    <div className={embedded ? 'retro-panel' : 'overlay'} onClick={embedded ? undefined : onClose}>
      <div className={embedded ? 'retro-panel__content' : 'modal modal--wide retro-dialog'} onClick={(event) => event.stopPropagation()}>
        <div className="modal__title">复盘 · {requirement.name}</div>
        <div className="retro-list">
          {currentRetros.length === 0 ? (
            <div className="retro-list__empty">还没有复盘记录</div>
          ) : currentRetros.map((retro, index) => (
            <div className="retro-item" key={retro.id}>
              <div className="retro-item__idx">{String(index + 1).padStart(2, '0')}</div>
              <div className="retro-item__content">{retro.content}</div>
            </div>
          ))}
        </div>
        <div className="field-label" style={{ marginTop: 18 }}>写复盘</div>
        <textarea
          className="text-area"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="做得好的是什么，下次改什么…"
        />
        <div className="modal__actions">
          <button className="btn-ghost" onClick={onClose}>关闭</button>
          <button className="btn-primary" onClick={save} style={{ opacity: draft.trim() ? 1 : 0.45 }}>保存复盘</button>
        </div>
      </div>
    </div>
  )
}
