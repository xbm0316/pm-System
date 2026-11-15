import { useState, useEffect, useRef } from 'react'
import { type Competitor, uid } from '../lib/store'

interface Props {
  spaceId: string
  competitors: Competitor[]
  onAdd: (c: Competitor) => void
  openSignal: number
  searchQuery?: string
}

export default function CompAnalysis({ spaceId, competitors, onAdd, openSignal, searchQuery = '' }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<Competitor | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const consumedSignal = useRef(openSignal)

  useEffect(() => {
    if (openSignal !== consumedSignal.current) {
      consumedSignal.current = openSignal
      if (openSignal > 0) setShowForm(true)
    }
  }, [openSignal])

  const query = searchQuery.trim().toLocaleLowerCase()
  const list = competitors
    .filter((c) => c.spaceId === spaceId)
    .filter((c) => !query || [c.name, c.url, c.description].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
    .sort((a, b) => b.createdAt - a.createdAt)

  function submit() {
    if (!name.trim()) return
    onAdd({
      id: uid(),
      spaceId,
      name: name.trim(),
      url: url.trim(),
      createdAt: Date.now(),
    })
    setShowForm(false)
    setName('')
    setUrl('')
  }

  return (
    <>
      {list.length === 0 ? (
        <div className="empty" style={{ padding: '36px 12px' }}>
          <div style={{ fontSize: 12.5 }}>{query ? '没有匹配结果' : '暂无竞品'}</div>
        </div>
      ) : (
        <div className="comp-grid">
          {list.map((c) => (
            <button key={c.id} className="comp-card" onClick={() => setDetail(c)}>
              <div className="comp-card__name">{c.name}</div>
              {c.url && <div className="comp-card__url">{c.url}</div>}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">新增竞品</div>

            <div className="field-label">竞品名称</div>
            <input
              className="text-input"
              style={{ marginBottom: 16 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="竞品叫什么"
              autoFocus
            />

            <div className="field-label">竞品链接</div>
            <input
              className="text-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />

            <div className="modal__actions">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                取消
              </button>
              <button
                className="btn-primary"
                onClick={submit}
                style={{ opacity: name.trim() ? 1 : 0.45 }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">{detail.name}</div>
            {detail.url ? (
              <a
                href={detail.url}
                target="_blank"
                rel="noreferrer"
                className="comp-link"
              >
                {detail.url}
              </a>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>未填写链接</div>
            )}
            <div className="modal__actions">
              <button className="btn-ghost" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
