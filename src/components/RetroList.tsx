import { Heading } from '@astryxdesign/core/Text'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Button } from '@astryxdesign/core/Button'
import { useState } from 'react'
import { type Requirement, type Retro } from '../lib/store'
import PriorityBadge from './PriorityBadge'

interface Props {
  spaceId: string
  requirements: Requirement[]
  retros: Retro[]
  onAddRetro: (reqId: string, content: string) => void
  searchQuery?: string
}

export default function RetroList({ spaceId, requirements, retros, onAddRetro, searchQuery = '' }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const query = searchQuery.trim().toLocaleLowerCase()
  const list = requirements
    .filter((r) => r.spaceId === spaceId && r.status === '已上线')
    .filter((r) => !query || [r.name, r.content].join(' ').toLocaleLowerCase().includes(query))
    .sort((a, b) => b.createdAt - a.createdAt)
  const current = list.find((r) => r.id === openId)
  const currentRetros = retros.filter((x) => x.reqId === openId).sort((a, b) => a.createdAt - b.createdAt)

  function save() {
    if (!openId || !draft.trim()) return
    onAddRetro(openId, draft.trim())
    setDraft('')
  }

  return (
    <>
      {list.length === 0 ? (
        <div className="empty" style={{ padding: '36px 12px' }}>
          <div style={{ fontSize: 12.5 }}>{query ? '没有匹配结果' : '暂无已上线需求'}</div>
          {!query && <div className="empty__hint">需求状态变为「已上线」后出现在这里</div>}
        </div>
      ) : (
        <div className="comp-grid retro-grid">
          {list.map((r) => {
            const cnt = retros.filter((x) => x.reqId === r.id).length
            return (
              <ClickableCard padding={0} key={r.id} className="retro-card" label={`查看复盘 ${r.name}`} onClick={() => { setOpenId(r.id); setDraft('') }}>
                <div className="retro-card__top">
                  <span className="retro-card__ver">{r.version}</span>
                  <PriorityBadge priority={r.priority} />
                </div>
                <div className="retro-card__name">{r.name}</div>
                <div className="retro-card__foot">
                  <span className="retro-card__cnt">{cnt > 0 ? `${cnt} 篇复盘` : '未复盘'}</span>
                  <button
                    className="retro-card__btn"
                    onClick={() => {
                      setOpenId(r.id)
                      setDraft('')
                    }}
                  >
                    复盘
                  </button>
                </div>
              </ClickableCard>
            )
          })}
        </div>
      )}

      {current && (
        <WorkspaceOverlay label={`复盘 · ${current.name}`} onClose={() => setOpenId(null)}>
          <div className="modal modal--wide">
            <Heading level={3} accessibilityLevel={2} className="modal__title">复盘 · {current.name}</Heading>

            <div className="retro-list">
              {currentRetros.length === 0 ? (
                <div className="retro-list__empty">还没有复盘记录</div>
              ) : (
                currentRetros.map((x, i) => (
                  <div key={x.id} className="retro-item">
                    <div className="retro-item__idx">{String(i + 1).padStart(2, '0')}</div>
                    <div className="retro-item__content">{x.content}</div>
                  </div>
                ))
              )}
            </div>

            <div className="field-label" style={{ marginTop: 18 }}>
              写复盘
            </div>
            <TextArea label="写复盘" isLabelHidden width="100%" rows={4} value={draft} placeholder="做得好的是什么，下次改什么…" onChange={setDraft} />

            <div className="modal__actions">
              <Button label="关闭" variant="ghost" onClick={() => setOpenId(null)} />
              <Button label="保存复盘" variant="primary" onClick={save} style={{ opacity: draft.trim() ? 1 : 0.45 }} />
            </div>
          </div>
        </WorkspaceOverlay>
      )}
    </>
  )
}
