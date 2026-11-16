import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { MENUS, uid } from '../lib/store'

interface OperationsWorkspaceProps {
  spaceId: string
  activeMenu: string
  searchQuery?: string
}

interface OperationsRecord {
  id: string
  menuKey: string
  title: string
  content: string
  createdAt: number
}

const STORAGE_PREFIX = 'jawcat.operations.v1.'

function readRecords(spaceId: string): OperationsRecord[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function OperationsWorkspace({ spaceId, activeMenu, searchQuery = '' }: OperationsWorkspaceProps) {
  const menus = MENUS['独立站电商运营']
  const [records, setRecords] = useState<OperationsRecord[]>(() => readRecords(spaceId))
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${spaceId}`, JSON.stringify(records))
  }, [records, spaceId])

  const activeMenuDef = menus.find((menu) => menu.key === activeMenu) || menus[0]
  const visibleRecords = useMemo(() => records
    .filter((record) => record.menuKey === activeMenuDef.key)
    .filter((record) => !searchQuery.trim() || `${record.title} ${record.content}`.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt), [activeMenuDef.key, records, searchQuery])

  function createRecord() {
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    setRecords((current) => [{ id: uid(), menuKey: activeMenuDef.key, title: cleanTitle, content: content.trim(), createdAt: Date.now() }, ...current])
    setTitle('')
    setContent('')
    setShowCreate(false)
  }

  function removeRecord(id: string) {
    setRecords((current) => current.filter((record) => record.id !== id))
  }

  return <div className="operations-workspace">
    <div className="operations-workspace__head">
      <div>
        <div className="operations-workspace__eyebrow">独立站运营</div>
        <h1>{activeMenuDef.label}</h1>
      </div>
      <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}><Icon name="plus" size={14} /> 新增记录</button>
    </div>
    <div className="operations-workspace__grid">
      {visibleRecords.length === 0 ? <div className="operations-workspace__empty">暂无{activeMenuDef.label}记录</div> : visibleRecords.map((record) => <article className="operations-record-card" key={record.id}>
        <div className="operations-record-card__top"><span>{activeMenuDef.label}</span><button type="button" onClick={() => removeRecord(record.id)} title="删除记录" aria-label={`删除记录 ${record.title}`}><Icon name="trash" size={13} /></button></div>
        <h2>{record.title}</h2>
        <p>{record.content || '暂无补充说明'}</p>
      </article>)}
    </div>
    {showCreate && <div className="overlay" onClick={() => setShowCreate(false)}><form className="modal modal--wide operations-create-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); createRecord() }}>
      <div className="modal__title">新增{activeMenuDef.label}</div>
      <div className="field-label">记录标题 <span className="field-required">*</span></div>
      <input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`输入${activeMenuDef.label}标题`} autoFocus required />
      <div className="field-label collection-field-gap">记录内容</div>
      <textarea className="text-area" rows={7} value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录关键信息、执行结果和备注" />
      <div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>取消</button><button type="submit" className="btn-primary" disabled={!title.trim()} style={{ opacity: title.trim() ? 1 : .45 }}>创建记录</button></div>
    </form></div>}
  </div>
}

