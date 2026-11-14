import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { uid, type PrdOptionalSection, type PrdTableRow, type Requirement, type RequirementPrd } from '../lib/store'

interface Props { requirement: Requirement; mode: 'view' | 'edit'; onClose: () => void; onSave: (prd: RequirementPrd) => void; embedded?: boolean }
const OPTIONAL_SECTIONS: Array<{ key: PrdOptionalSection; label: string; icon: string }> = [
  { key: 'competitor', label: '竞品分析', icon: 'trend' },
  { key: 'business-flow', label: '业务流程图', icon: 'grid' },
  { key: 'system-flow', label: '系统流程图', icon: 'panelRight' },
  { key: 'state-machine', label: '状态机', icon: 'clock' },
]
function emptyPrd(): RequirementPrd { return { background: '', explanation: '', contentRows: [{ id: uid(), module: '', change: '', note: '' }], changeLog: '', optionalSections: [], optionalContent: {}, updatedAt: 0 } }

type EditorCommand = { label: string; icon: string; command: string; value?: string }
const EDITOR_COMMANDS: EditorCommand[] = [
  { label: '标题 1', icon: 'bold', command: 'formatBlock', value: 'h2' },
  { label: '标题 2', icon: 'bold', command: 'formatBlock', value: 'h3' },
  { label: '粗体', icon: 'bold', command: 'bold' },
  { label: '斜体', icon: 'italic', command: 'italic' },
  { label: '链接', icon: 'link', command: 'createLink' },
  { label: '无序列表', icon: 'list', command: 'insertUnorderedList' },
  { label: '有序列表', icon: 'listOrdered', command: 'insertOrderedList' },
  { label: '代码', icon: 'code', command: 'formatBlock', value: 'pre' },
]

function RichEditor({ value, editable, onChange, placeholder }: { value: string; editable: boolean; onChange: (value: string) => void; placeholder: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  useEffect(() => { const element = ref.current; if (!element) return; const focused = document.activeElement === element; if (!mounted.current || (!focused && element.innerHTML !== value)) element.innerHTML = value; mounted.current = true }, [value, editable])
  function syncValue() { onChange(ref.current?.innerHTML || '') }
  function command(item: EditorCommand) {
    if (!editable) return
    ref.current?.focus()
    if (item.command === 'createLink') {
      const url = window.prompt('输入链接地址')
      if (!url) return
      document.execCommand(item.command, false, url)
    } else document.execCommand(item.command, false, item.value)
    syncValue()
  }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!editable) return
    const modifier = event.metaKey || event.ctrlKey
    if (modifier && /^[1-3]$/.test(event.key)) { event.preventDefault(); document.execCommand('formatBlock', false, `h${event.key}`); syncValue() }
    if (event.key === 'Tab') { event.preventDefault(); document.execCommand(event.shiftKey ? 'outdent' : 'indent'); syncValue() }
  }
  return <div className={`rich-editor${editable ? ' rich-editor--editable' : ' rich-editor--readonly'}`}>
    {editable && <div className="rich-editor__toolbar" role="toolbar" aria-label="文本格式">
      {EDITOR_COMMANDS.map((item, index) => <span key={item.label} className="rich-editor__tool-wrap"><button type="button" className={`rich-editor__tool${index === 0 || index === 1 ? ' rich-editor__tool--text' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => command(item)} title={item.label} aria-label={item.label}><Icon name={item.icon} size={14} /></button>{index === 1 || index === 3 || index === 4 ? <span className="rich-editor__divider" /> : null}</span>)}
      <span className="rich-editor__hint">⌘/Ctrl + 1–3 标题 · Tab 缩进</span>
    </div>}
    <div ref={ref} className="rich-editor__surface" contentEditable={editable} suppressContentEditableWarning role={editable ? 'textbox' : undefined} aria-multiline={editable || undefined} data-placeholder={placeholder} onInput={syncValue} onBlur={syncValue} onKeyDown={keyDown} />
  </div>
}

function TextBlock({ label, value, editable, placeholder, onChange }: { label: string; value: string; editable: boolean; placeholder: string; onChange: (value: string) => void }) {
  return <section className="prd-section"><div className="prd-section__label">{label}</div>{editable ? <textarea className="prd-textarea" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} /> : <div className={`prd-text${value ? '' : ' prd-text--empty'}`}>{value || '暂未填写'}</div>}</section>
}

function EditableTable({ rows, editable, onUpdate, onAdd, onRemove, onReorder }: { rows: PrdTableRow[]; editable: boolean; onUpdate: (id: string, field: keyof Omit<PrdTableRow, 'id'>, value: string) => void; onAdd: () => void; onRemove: (id: string) => void; onReorder: (from: string, to: string) => void }) {
  const [dragId, setDragId] = useState<string | null>(null)
  return <>
    <div className="prd-table-wrap"><table className="prd-table"><colgroup><col className="prd-table__col-module" /><col className="prd-table__col-change" /><col className="prd-table__col-note" />{editable && <col className="prd-table__col-operation" />}</colgroup><thead><tr><th>改动模块</th><th>改动内容</th><th>备注</th>{editable && <th className="prd-table__operation" aria-label="操作" />}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} draggable={editable} className={dragId === row.id ? 'prd-table__row--dragging' : ''} onDragStart={() => setDragId(row.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId && dragId !== row.id) onReorder(dragId, row.id); setDragId(null) }} onDragEnd={() => setDragId(null)}>
      {editable ? <><td><div className="prd-table__cell-edit"><button type="button" className="prd-table__grip" title="拖动排序" aria-label="拖动排序"><Icon name="grip" size={14} /></button><input value={row.module} onChange={(event) => onUpdate(row.id, 'module', event.target.value)} placeholder="模块名称" /></div></td><td><textarea value={row.change} onChange={(event) => onUpdate(row.id, 'change', event.target.value)} placeholder="改动内容" rows={2} /></td><td><textarea value={row.note} onChange={(event) => onUpdate(row.id, 'note', event.target.value)} placeholder="备注" rows={2} /></td><td className="prd-table__operation"><button type="button" className="text-btn text-btn--danger" onClick={() => onRemove(row.id)}>删除</button></td></> : <><td className="prd-table__display-cell">{row.module || '—'}</td><td className="prd-table__display-cell">{row.change || '—'}</td><td className="prd-table__display-cell">{row.note || '—'}</td></>}
    </tr>)}</tbody></table></div>{editable && <div className="prd-table__actions"><button type="button" className="table-add" onClick={onAdd}><Icon name="plus" size={14} /> 添加一行</button><span className="prd-table__hint"><Icon name="grip" size={13} /> 拖动左侧手柄调整顺序</span></div>}
  </>
}

export default function ReqPrd({ requirement, mode, onClose, onSave, embedded = false }: Props) {
  const [editing, setEditing] = useState(mode === 'edit')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [prd, setPrd] = useState<RequirementPrd>(() => requirement.prd || emptyPrd())
  useEffect(() => { setEditing(mode === 'edit'); setShowAddMenu(false); setPrd(requirement.prd || emptyPrd()) }, [mode, requirement.id])
  useEffect(() => { function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [onClose])
  function patchPrd(patch: Partial<RequirementPrd>) { setPrd((current) => ({ ...current, ...patch })) }
  function toggleOptionalSection(key: PrdOptionalSection) { setPrd((current) => ({ ...current, optionalSections: current.optionalSections.includes(key) ? current.optionalSections.filter((section) => section !== key) : [...current.optionalSections, key] })) }
  function updateOptionalContent(key: PrdOptionalSection, value: string) { setPrd((current) => ({ ...current, optionalContent: { ...current.optionalContent, [key]: value } })) }
  function updateRow(id: string, field: keyof Omit<PrdTableRow, 'id'>, value: string) { setPrd((current) => ({ ...current, contentRows: current.contentRows.map((row) => row.id === id ? { ...row, [field]: value } : row) })) }
  function addRow() { setPrd((current) => ({ ...current, contentRows: [...current.contentRows, { id: uid(), module: '', change: '', note: '' }] })) }
  function removeRow(id: string) { setPrd((current) => ({ ...current, contentRows: current.contentRows.length <= 1 ? [{ id: uid(), module: '', change: '', note: '' }] : current.contentRows.filter((row) => row.id !== id) })) }
  function reorderRows(from: string, to: string) { setPrd((current) => { const rows = [...current.contentRows]; const fromIndex = rows.findIndex((row) => row.id === from); const toIndex = rows.findIndex((row) => row.id === to); if (fromIndex < 0 || toIndex < 0) return current; const [moved] = rows.splice(fromIndex, 1); rows.splice(toIndex, 0, moved); return { ...current, contentRows: rows } }) }
  function save() { onSave({ ...prd, updatedAt: Date.now() }); setEditing(false); setShowAddMenu(false) }
  return <div className={`prd-page${embedded ? ' prd-page--embedded' : ''}`}>
    <header className="prd-page__header"><div>{!embedded && <h2 className="prd-page__title"><span className="prd-page__version">{requirement.version}</span><span className="prd-page__title-text">{requirement.name}</span><span className={`pri prd-page__priority pri--${requirement.priority.toLowerCase()}`}>{requirement.priority}</span></h2>}{embedded && <span className="prd-page__embedded-label">PRD 内容</span>}</div><div className="prd-page__actions"><button className={`icon-btn${editing ? ' icon-btn--active' : ''}`} type="button" onClick={() => setEditing(true)} title="编辑 PRD" aria-label="编辑 PRD"><Icon name="edit" size={15} /></button><div className="prd-add-wrap"><button className={`icon-btn${showAddMenu ? ' icon-btn--active' : ''}`} type="button" onClick={() => editing && setShowAddMenu((value) => !value)} title="添加区块" aria-label="添加区块" aria-expanded={editing ? showAddMenu : undefined} disabled={!editing}><Icon name="plus" size={16} /></button>{showAddMenu && editing && <div className="prd-add-menu"><div className="prd-add-menu__title">显示区块</div>{OPTIONAL_SECTIONS.map((section) => <label className="prd-add-menu__item" key={section.key}><input type="checkbox" checked={prd.optionalSections.includes(section.key)} onChange={() => toggleOptionalSection(section.key)} /><Icon name={section.icon} size={14} /><span>{section.label}</span></label>)}</div>}</div>{!embedded && <button className="icon-btn" type="button" onClick={onClose} title="关闭 PRD" aria-label="关闭 PRD"><Icon name="close" size={15} /></button>}</div></header>
    <div className="prd-page__body"><TextBlock label="需求背景" value={prd.background} editable={editing} placeholder="填写需求背景、用户问题和业务目标…" onChange={(value) => patchPrd({ background: value })} />
      {prd.optionalSections.includes('competitor') && <TextBlock label="竞品分析" value={prd.optionalContent.competitor || ''} editable={editing} placeholder="填写竞品观察、差异和借鉴点…" onChange={(value) => updateOptionalContent('competitor', value)} />}
      <section className="prd-section"><div className="prd-section__label">需求说明</div><RichEditor value={prd.explanation} editable={editing} placeholder="使用标题、列表和缩进整理需求说明…" onChange={(value) => patchPrd({ explanation: value })} /></section>
      {(['business-flow', 'system-flow', 'state-machine'] as PrdOptionalSection[]).map((key) => prd.optionalSections.includes(key) && <TextBlock key={key} label={OPTIONAL_SECTIONS.find((item) => item.key === key)?.label || key} value={prd.optionalContent[key] || ''} editable={editing} placeholder="填写流程、状态和流转说明…" onChange={(value) => updateOptionalContent(key, value)} />)}
      <section className="prd-section"><div className="prd-section__label">需求内容</div><EditableTable rows={prd.contentRows} editable={editing} onUpdate={updateRow} onAdd={addRow} onRemove={removeRow} onReorder={reorderRows} /></section>
      <section className="prd-section"><div className="prd-section__label">改动记录</div><RichEditor value={prd.changeLog} editable={editing} placeholder="记录需求的调整、决策和变更原因…" onChange={(value) => patchPrd({ changeLog: value })} /></section>
    </div><footer className="prd-page__footer"><span className="prd-page__footer-hint">{editing ? '编辑完成后保存，保存后将以完整内容展示' : '当前为只读展示状态'}</span>{editing && <button type="button" className="btn-primary" onClick={save}>保存 PRD</button>}</footer>
  </div>
}
