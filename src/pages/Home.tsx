import { useState, useEffect, useRef } from 'react'
import TopBar from '../components/TopBar'
import Icon from '../components/Icon'
import { ALL_TYPES, type Space, type TypeName } from '../lib/store'

interface Props {
  spaces: Space[]
  onOpen: (s: Space) => void
  onCreate: (name: string, types: TypeName[]) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onLogout: () => void
}

export default function Home({
  spaces,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onLogout,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTypes, setNewTypes] = useState<TypeName[]>(['项目经理'])
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Space | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function submitCreate() {
    const name = newName.trim()
    if (!name || newTypes.length === 0) return
    onCreate(name, newTypes)
    setShowCreate(false)
    setNewName('')
    setNewTypes(['项目经理'])
  }

  function toggleType(type: TypeName) {
    setNewTypes([type])
  }

  function submitRename() {
    if (!renaming) return
    const v = renameValue.trim()
    if (v) onRename(renaming.id, v)
    setRenaming(null)
    setRenameValue('')
  }

  return (
    <>
      <TopBar
        title="工作空间"
        hideTitle
        onLogout={onLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="page">
        <div className="page__head">
          <div className="page__title">我的空间</div>
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + 新建空间
          </button>
        </div>

        {spaces.filter((s) => {
          const q = searchQuery.trim().toLocaleLowerCase()
          return !q || [s.name, ...s.types].join(' ').toLocaleLowerCase().includes(q)
        }).length === 0 ? (
          <div className="empty">
            <div>还没有空间</div>
            <div className="empty__hint">点击右上角「+ 新建空间」开始</div>
          </div>
        ) : (
          <div className="space-grid">
            {spaces.filter((s) => {
              const q = searchQuery.trim().toLocaleLowerCase()
              return !q || [s.name, ...s.types].join(' ').toLocaleLowerCase().includes(q)
            }).map((s) => (
              <div key={s.id} className="space-card" onClick={() => onOpen(s)}>
                <div className="space-card__top">
                  <div className="space-card__name">{s.name}</div>
                  <div style={{ flex: 1 }} />
                  <button
                    className="space-card__menu-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === s.id ? null : s.id)
                    }}
                  >
                    <Icon name="dots" size={16} color="currentColor" />
                  </button>
                </div>

                <div className="space-card__tags">
                  {s.types.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>

                {menuOpenId === s.id && (
                  <div className="dropdown" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="dropdown__item"
                      onClick={() => {
                        setRenaming(s)
                        setRenameValue(s.name)
                        setMenuOpenId(null)
                      }}
                    >
                      改名
                    </button>
                    <button
                      className="dropdown__item dropdown__item--danger"
                      onClick={() => {
                        if (confirm(`删除空间「${s.name}」？此操作不可恢复。`)) {
                          onDelete(s.id)
                        }
                        setMenuOpenId(null)
                      }}
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">新建空间</div>

            <div className="field-label">空间名称</div>
            <input
              className="text-input"
              style={{ marginBottom: 20 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="给空间起个名字"
              autoFocus
            />

            <div className="field-label">空间类型</div>
            <div className="type-list">
              {ALL_TYPES.map((type) => {
                const selected = newTypes.includes(type)
                return <button type="button" key={type} className={`type-opt${selected ? ' type-opt--on' : ''}`} onClick={() => toggleType(type)}>
                  <span className="type-opt__box">{selected && <span>✓</span>}</span>
                  <span className="type-opt__label">{type}</span>
                </button>
              })}
            </div>

            <div className="modal__actions">
              <button className="btn-ghost" onClick={() => setShowCreate(false)}>
                取消
              </button>
              <button
                className="btn-primary"
                onClick={submitCreate}
                style={{ opacity: !newName.trim() || newTypes.length === 0 ? 0.45 : 1 }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {renaming && (
        <div className="overlay" onClick={() => setRenaming(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">改名</div>
            <div className="field-label">空间名称</div>
            <input
              className="text-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitRename()}
              autoFocus
            />
            <div className="modal__actions">
              <button className="btn-ghost" onClick={() => setRenaming(null)}>
                取消
              </button>
              <button className="btn-primary" onClick={submitRename}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
