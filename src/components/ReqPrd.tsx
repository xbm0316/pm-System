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

type EditorCommand = { label: string; icon?: string; text?: string; command: string; value?: string }
const EDITOR_COMMANDS: EditorCommand[] = [
  { label: '标题 1', text: 'H1', command: 'formatBlock', value: 'h2' },
  { label: '标题 2', text: 'H2', command: 'formatBlock', value: 'h3' },
  { label: '粗体', icon: 'bold', command: 'bold' },
  { label: '斜体', icon: 'italic', command: 'italic' },
  { label: '链接', icon: 'link', command: 'createLink' },
  { label: '无序列表', icon: 'list', command: 'insertUnorderedList' },
  { label: '有序列表', icon: 'listOrdered', command: 'insertOrderedList' },
  { label: '代码', icon: 'code', command: 'formatBlock', value: 'pre' },
]

type DiagramNode = { id: string; x: number; y: number; text: string; shape: 'start' | 'process' | 'decision' | 'text' }
type DiagramData = { nodes: DiagramNode[] }
const DIAGRAM_WIDTH = 900
const DIAGRAM_HEIGHT = 520
function defaultDiagram(label: string): DiagramData {
  return { nodes: [
    { id: uid(), x: 350, y: 42, text: '开始', shape: 'start' },
    { id: uid(), x: 320, y: 155, text: `${label}步骤`, shape: 'process' },
    { id: uid(), x: 320, y: 285, text: '处理与判断', shape: 'decision' },
    { id: uid(), x: 350, y: 420, text: '结束', shape: 'start' },
  ] }
}
function parseDiagram(value: string, label: string): DiagramData {
  if (value) {
    try {
      const parsed = JSON.parse(value) as DiagramData
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length) return parsed
    } catch { /* 旧版文本内容继续作为画布说明 */ }
  }
  const fallback = defaultDiagram(label)
  if (value.trim()) fallback.nodes[1].text = value.trim().slice(0, 80)
  return fallback
}

function DiagramEditor({ label, value, editable, onChange }: { label: string; value: string; editable: boolean; onChange: (value: string) => void }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [data, setData] = useState<DiagramData>(() => parseDiagram(value, label))
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number; svg: SVGSVGElement } | null>(null)
  const [history, setHistory] = useState<DiagramData[]>([])
  const [future, setFuture] = useState<DiagramData[]>([])
  const [zoom, setZoom] = useState(100)
  const canvasId = useState(() => uid())[0]
  useEffect(() => { setData(parseDiagram(value, label)) }, [value, label])
  useEffect(() => {
    if (!dragging) return
    const move = (event: PointerEvent) => {
      const bounds = dragging.svg.getBoundingClientRect()
      const point = { x: (event.clientX - bounds.left) * DIAGRAM_WIDTH / bounds.width, y: (event.clientY - bounds.top) * DIAGRAM_HEIGHT / bounds.height }
      const next = { ...data, nodes: data.nodes.map((node) => node.id === dragging.id ? { ...node, x: Math.max(20, Math.min(DIAGRAM_WIDTH - 220, point.x - dragging.dx)), y: Math.max(20, Math.min(DIAGRAM_HEIGHT - 70, point.y - dragging.dy)) } : node) }
      setData(next); onChange(JSON.stringify(next))
    }
    const up = () => setDragging(null)
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [dragging, data, onChange])
  function update(next: DiagramData) { setHistory((current) => [...current, data].slice(-30)); setFuture([]); setData(next); onChange(JSON.stringify(next)) }
  function undo() { const previous = history[history.length - 1]; if (!previous) return; setHistory((current) => current.slice(0, -1)); setFuture((current) => [data, ...current].slice(0, 30)); setData(previous); onChange(JSON.stringify(previous)) }
  function redo() { const next = future[0]; if (!next) return; setFuture((current) => current.slice(1)); setHistory((current) => [...current, data].slice(-30)); setData(next); onChange(JSON.stringify(next)) }
  function addNode(shape: DiagramNode['shape']) {
    const index = data.nodes.length
    const next = { ...data, nodes: [...data.nodes, { id: uid(), x: 120 + (index % 3) * 250, y: 100 + (Math.floor(index / 3) % 3) * 125, text: shape === 'decision' ? '新的判断' : shape === 'text' ? '新的说明' : '新的步骤', shape }] }
    update(next)
  }
  function removeNode(id: string) { update({ ...data, nodes: data.nodes.length <= 1 ? data.nodes : data.nodes.filter((node) => node.id !== id) }) }
  const canvas = (large: boolean) => <div className={`prd-diagram__workspace${large ? ' prd-diagram__workspace--fullscreen' : ''}`}><aside className="prd-diagram__palette"><span>图形</span><button type="button" onClick={() => addNode('start')} title="添加开始或结束节点">○</button><button type="button" onClick={() => addNode('process')} title="添加处理节点">□</button><button type="button" onClick={() => addNode('decision')} title="添加判断节点">◇</button><button type="button" onClick={() => addNode('text')} title="添加文本节点">T</button></aside><div className={`prd-diagram__canvas${large ? ' prd-diagram__canvas--fullscreen' : ''}`}><svg viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`} style={{ transform: `scale(${zoom / 100})` }} role="img" aria-label={`${label}画布`} onPointerDown={(event) => { if (event.target === event.currentTarget) (event.currentTarget as SVGSVGElement).focus() }} tabIndex={0}>
    <defs><pattern id={`prd-grid-${canvasId}-${large ? 'large' : 'small'}`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern><marker id={`prd-arrow-${canvasId}-${large ? 'large' : 'small'}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="currentColor" /></marker></defs>
    <rect width={DIAGRAM_WIDTH} height={DIAGRAM_HEIGHT} fill={`url(#prd-grid-${canvasId}-${large ? 'large' : 'small'})`} />
    {data.nodes.slice(0, -1).map((node, index) => { const target = data.nodes[index + 1]; return <line key={`${node.id}-${target.id}`} x1={node.x + 110} y1={node.y + 54} x2={target.x + 110} y2={target.y} stroke="currentColor" strokeOpacity=".55" strokeWidth="2" markerEnd={`url(#prd-arrow-${canvasId}-${large ? 'large' : 'small'})`} /> })}
    {data.nodes.map((node) => <g key={node.id} transform={`translate(${node.x} ${node.y})`} className="prd-diagram__node" onPointerDown={(event) => { if (!editable) return; event.stopPropagation(); const svg = event.currentTarget.ownerSVGElement; if (!svg) return; const bounds = svg.getBoundingClientRect(); const point = { x: (event.clientX - bounds.left) * DIAGRAM_WIDTH / bounds.width, y: (event.clientY - bounds.top) * DIAGRAM_HEIGHT / bounds.height }; setDragging({ id: node.id, dx: point.x - node.x, dy: point.y - node.y, svg }) }} onDoubleClick={() => { if (!editable) return; const nextText = window.prompt('编辑节点名称', node.text); if (nextText?.trim()) update({ ...data, nodes: data.nodes.map((item) => item.id === node.id ? { ...item, text: nextText.trim() } : item) }) }}>
      {node.shape === 'start' && <ellipse cx="110" cy="28" rx="78" ry="27" />}{node.shape === 'decision' && <polygon points="110,0 220,28 110,56 0,28" />}{node.shape === 'text' && <rect x="5" y="4" width="210" height="48" className="prd-diagram__text-node" />}{node.shape === 'process' && <rect x="0" y="0" width="220" height="56" rx="8" />}
      <text x="110" y="33" textAnchor="middle">{node.text}</text>{editable && <text x="207" y="12" className="prd-diagram__node-remove" onPointerDown={(event) => event.stopPropagation()} onClick={() => removeNode(node.id)} aria-label={`删除${node.text}`}>×</text>}
    </g>)}
  </svg></div></div>
  return <section className="prd-section prd-diagram"><div className="prd-section__label">{label}</div><div className="prd-diagram__shell"><div className="prd-diagram__toolbar"><span>{editable ? '拖动节点调整流程，双击节点改名' : '流程图预览'}</span>{editable && <div className="prd-diagram__tools"><button type="button" onClick={undo} disabled={!history.length} title="撤销">↶</button><button type="button" onClick={redo} disabled={!future.length} title="重做">↷</button><button type="button" onClick={() => addNode('process')}>+ 步骤</button><button type="button" onClick={() => addNode('decision')}>◇ 判断</button><button type="button" onClick={() => addNode('text')}>T 文本</button></div>}<div className="prd-diagram__zoom"><button type="button" onClick={() => setZoom((current) => Math.max(60, current - 10))}>−</button><span>{zoom}%</span><button type="button" onClick={() => setZoom((current) => Math.min(150, current + 10))}>＋</button></div><button type="button" className="icon-btn" onClick={() => setFullscreen(true)} title="全屏展开" aria-label="全屏展开"><Icon name="expand" size={15} /></button></div>{canvas(false)}</div>{fullscreen && <div className="prd-diagram__overlay" role="dialog" aria-modal="true" aria-label={`${label}全屏画布`}><div className="prd-diagram__fullscreen-panel"><div className="prd-diagram__fullscreen-head"><strong>{label}</strong><div>{editable && <><button type="button" onClick={undo} disabled={!history.length}>↶</button><button type="button" onClick={redo} disabled={!future.length}>↷</button><button type="button" onClick={() => addNode('process')}>+ 步骤</button><button type="button" onClick={() => addNode('decision')}>◇ 判断</button><button type="button" onClick={() => addNode('text')}>T 文本</button></>}<button type="button" className="icon-btn" onClick={() => setFullscreen(false)} title="退出全屏" aria-label="退出全屏"><Icon name="collapse" size={16} /></button></div></div>{canvas(true)}</div></div>}</section>
}

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
      {EDITOR_COMMANDS.map((item, index) => <span key={item.label} className="rich-editor__tool-wrap"><button type="button" className={`rich-editor__tool${item.text ? ' rich-editor__tool--text' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => command(item)} title={item.label} aria-label={item.label}>{item.text || <Icon name={item.icon || 'bold'} size={14} />}</button>{index === 1 || index === 3 || index === 4 ? <span className="rich-editor__divider" /> : null}</span>)}
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
    <div className="prd-grid-wrap"><table className="prd-grid"><colgroup><col className="prd-grid__col-index" /><col className="prd-grid__col-module" /><col className="prd-grid__col-change" /><col className="prd-grid__col-note" />{editable && <col className="prd-grid__col-operation" />}</colgroup><thead><tr><th>#</th><th>改动模块</th><th>改动内容</th><th>备注</th>{editable && <th aria-label="操作" />}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} draggable={editable} className={dragId === row.id ? 'prd-grid__row--dragging' : ''} onDragStart={() => setDragId(row.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId && dragId !== row.id) onReorder(dragId, row.id); setDragId(null) }} onDragEnd={() => setDragId(null)}>
      <td className="prd-grid__index">{index + 1}</td>{editable ? <><td><div className="prd-grid__cell-edit"><button type="button" className="prd-grid__grip" title="拖动排序" aria-label="拖动排序"><Icon name="grip" size={14} /></button><input value={row.module} onChange={(event) => onUpdate(row.id, 'module', event.target.value)} placeholder="模块名称" /></div></td><td><textarea value={row.change} onChange={(event) => onUpdate(row.id, 'change', event.target.value)} placeholder="改动内容" rows={2} /></td><td><textarea value={row.note} onChange={(event) => onUpdate(row.id, 'note', event.target.value)} placeholder="备注" rows={2} /></td><td className="prd-grid__operation"><button type="button" className="icon-btn icon-btn--small prd-grid__delete" onClick={() => onRemove(row.id)} title="删除这一行" aria-label="删除这一行"><Icon name="trash" size={13} /></button></td></> : <><td className="prd-grid__display-cell">{row.module || '—'}</td><td className="prd-grid__display-cell">{row.change || '—'}</td><td className="prd-grid__display-cell">{row.note || '—'}</td></>}
    </tr>)}</tbody></table></div>{editable && <div className="prd-grid__actions"><button type="button" className="table-add" onClick={onAdd}><Icon name="plus" size={14} /> 添加一行</button><span className="prd-table__hint"><Icon name="grip" size={13} /> 拖动左侧手柄调整顺序</span></div>}
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
    <header className="prd-page__header"><div>{!embedded && <div className="prd-page__heading"><div className="prd-page__meta-row"><span className="prd-page__version">{requirement.version}</span><span className={`pri prd-page__priority pri--${requirement.priority.toLowerCase()}`}>{requirement.priority}</span></div><h2 className="prd-page__title"><span className="prd-page__title-text">{requirement.name}</span></h2></div>}{embedded && <span className="prd-page__embedded-label">PRD 内容</span>}</div><div className="prd-page__actions"><button className={`icon-btn${editing ? ' icon-btn--active' : ''}`} type="button" onClick={() => setEditing(true)} title="编辑 PRD" aria-label="编辑 PRD"><Icon name="edit" size={15} /></button><div className="prd-add-wrap"><button className={`icon-btn${showAddMenu ? ' icon-btn--active' : ''}`} type="button" onClick={() => editing && setShowAddMenu((value) => !value)} title="添加区块" aria-label="添加区块" aria-expanded={editing ? showAddMenu : undefined} disabled={!editing}><Icon name="plus" size={16} /></button>{showAddMenu && editing && <div className="prd-add-menu"><div className="prd-add-menu__title">显示区块</div>{OPTIONAL_SECTIONS.map((section) => <label className="prd-add-menu__item" key={section.key}><input type="checkbox" checked={prd.optionalSections.includes(section.key)} onChange={() => toggleOptionalSection(section.key)} /><Icon name={section.icon} size={14} /><span>{section.label}</span></label>)}</div>}</div>{!embedded && <button className="icon-btn" type="button" onClick={onClose} title="关闭 PRD" aria-label="关闭 PRD"><Icon name="close" size={15} /></button>}</div></header>
    <div className="prd-page__body"><TextBlock label="需求背景" value={prd.background} editable={editing} placeholder="填写需求背景、用户问题和业务目标…" onChange={(value) => patchPrd({ background: value })} />
      {prd.optionalSections.includes('competitor') && <TextBlock label="竞品分析" value={prd.optionalContent.competitor || ''} editable={editing} placeholder="填写竞品观察、差异和借鉴点…" onChange={(value) => updateOptionalContent('competitor', value)} />}
      <section className="prd-section"><div className="prd-section__label">需求说明</div><RichEditor value={prd.explanation} editable={editing} placeholder="使用标题、列表和缩进整理需求说明…" onChange={(value) => patchPrd({ explanation: value })} /></section>
      {(['business-flow', 'system-flow', 'state-machine'] as PrdOptionalSection[]).map((key) => prd.optionalSections.includes(key) && <DiagramEditor key={key} label={OPTIONAL_SECTIONS.find((item) => item.key === key)?.label || key} value={prd.optionalContent[key] || ''} editable={editing} onChange={(value) => updateOptionalContent(key, value)} />)}
      <section className="prd-section"><div className="prd-section__label">需求内容</div><EditableTable rows={prd.contentRows} editable={editing} onUpdate={updateRow} onAdd={addRow} onRemove={removeRow} onReorder={reorderRows} /></section>
      <section className="prd-section"><div className="prd-section__label">改动记录</div><RichEditor value={prd.changeLog} editable={editing} placeholder="记录需求的调整、决策和变更原因…" onChange={(value) => patchPrd({ changeLog: value })} /></section>
    </div><footer className="prd-page__footer"><span className="prd-page__footer-hint">{editing ? '编辑完成后保存，保存后将以完整内容展示' : '当前为只读展示状态'}</span>{editing && <button type="button" className="btn-primary" onClick={save}>保存 PRD</button>}</footer>
  </div>
}
