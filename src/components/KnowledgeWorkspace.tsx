import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Icon from './Icon'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { KnowledgeResource, WorkspaceCollectionType } from '../lib/store'

interface Props {
  spaceId: string
  types: WorkspaceCollectionType[]
  resources: KnowledgeResource[]
  onChange: (types: WorkspaceCollectionType[], resources: KnowledgeResource[]) => void
  searchQuery?: string
}

function extension(name: string) { return name.split('.').pop()?.toLocaleLowerCase() || '' }
function mimeType(resource: KnowledgeResource) { return resource.mimeType || '' }
function isImage(resource: KnowledgeResource) {
  const fileExtension = extension(resource.fileName)
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(fileExtension) || (!fileExtension && mimeType(resource).startsWith('image/'))
}
function isText(resource: KnowledgeResource) {
  const fileExtension = extension(resource.fileName)
  return ['txt', 'md', 'markdown', 'csv'].includes(fileExtension) || (!fileExtension && mimeType(resource).startsWith('text/'))
}
function isPdf(resource: KnowledgeResource) { return extension(resource.fileName) === 'pdf' || (!extension(resource.fileName) && mimeType(resource) === 'application/pdf') }
function isSpreadsheet(resource: KnowledgeResource) {
  const fileExtension = extension(resource.fileName)
  return ['xls', 'xlsx'].includes(fileExtension) || (!fileExtension && (mimeType(resource).includes('spreadsheet') || mimeType(resource).includes('excel')))
}
function isDocx(resource: KnowledgeResource) {
  const fileExtension = extension(resource.fileName)
  return ['doc', 'docx'].includes(fileExtension) || (!fileExtension && mimeType(resource).includes('word'))
}
function canEdit(resource: KnowledgeResource) { return isImage(resource) || isText(resource) || isSpreadsheet(resource) }
function decodeDataUrl(dataUrl: string) {
  const encoded = dataUrl.split(',')[1] || ''
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
function encodeText(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return `data:text/plain;base64,${btoa(binary)}`
}
function dataUrlToArrayBuffer(dataUrl: string) {
  const binary = atob(dataUrl.split(',')[1] || '')
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return bytes.buffer
}
function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return `data:${mimeType};base64,${btoa(binary)}`
}

const MAX_UPLOAD_FILES = 20
const MAX_UPLOAD_TOTAL_SIZE = 50 * 1024 * 1024

export default function KnowledgeWorkspace({ spaceId, types, resources, onChange, searchQuery = '' }: Props) {
  const [showCreateType, setShowCreateType] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [detail, setDetail] = useState<KnowledgeResource | null>(null)
  const [deleteType, setDeleteType] = useState<WorkspaceCollectionType | null>(null)
  const [deleteResource, setDeleteResource] = useState<KnowledgeResource | null>(null)
  const [typeName, setTypeName] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [resourceName, setResourceName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [editorName, setEditorName] = useState('')
  const [editorText, setEditorText] = useState('')
  const [editorHtml, setEditorHtml] = useState('')
  const [sheetRows, setSheetRows] = useState<string[][]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [error, setError] = useState('')
  const [draggedTypeId, setDraggedTypeId] = useState<string | null>(null)

  useEffect(() => {
    if (!types.length) onChange([{ id: `knowledge-${Date.now().toString(36)}`, spaceId, name: '通用', createdAt: Date.now() }], resources)
  }, [onChange, resources, spaceId, types.length])

  const query = searchQuery.trim().toLocaleLowerCase()
  const resourcesByType = useMemo(() => new Map(types.map((type) => [type.id, resources.filter((item) => item.typeId === type.id).filter((item) => !query || `${item.name} ${item.fileName} ${item.mimeType}`.toLocaleLowerCase().includes(query)).sort((a, b) => b.createdAt - a.createdAt)])), [query, resources, types])

  function addType() {
    const name = typeName.trim()
    if (!name) return setError('请输入类型名称')
    onChange([...types, { id: `knowledge-${Date.now().toString(36)}`, spaceId, name, createdAt: Date.now() }], resources)
    setTypeName(''); setError(''); setShowCreateType(false)
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || [])
    if (!incoming.length) return
    setSelectedFiles((current) => {
      const merged = [...current]
      incoming.forEach((file) => {
        if (!merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) merged.push(file)
      })
      if (merged.length > MAX_UPLOAD_FILES) {
        setError(`最多同时上传 ${MAX_UPLOAD_FILES} 个文件`)
        return merged.slice(0, MAX_UPLOAD_FILES)
      }
      if (merged.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_TOTAL_SIZE) {
        setError('文件总大小不能超过 50 MB')
        return current
      }
      setError('')
      return merged
    })
    event.currentTarget.value = ''
  }
  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setError('')
  }
  function readFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' && reader.result.startsWith('data:') ? resolve(reader.result) : reject(new Error('invalid data url'))
      reader.onerror = () => reject(reader.error || new Error('file read failed'))
      reader.onabort = () => reject(new Error('file read aborted'))
      reader.readAsDataURL(file)
    })
  }
  function addResource() {
    if (!selectedTypeId || !selectedFiles.length) return setError('请选择要上传的文件')
    const invalid = selectedFiles.find((file) => file.size === 0 || file.size > 15 * 1024 * 1024)
    if (invalid?.size === 0) return setError(`「${invalid.name}」是空文件，不能上传`)
    if (invalid) return setError(`「${invalid.name}」超过 15 MB，不能上传`)
    setUploading(true); setError('')
    Promise.allSettled(selectedFiles.map((file) => readFile(file))).then((results) => {
      const now = Date.now()
      const successful = results.flatMap((result, index) => result.status === 'fulfilled' ? [{ id: `knowledge-${(now + index).toString(36)}`, spaceId, typeId: selectedTypeId, name: resourceName.trim() && selectedFiles.length === 1 ? resourceName.trim() : selectedFiles[index].name, fileName: selectedFiles[index].name, mimeType: selectedFiles[index].type || 'application/octet-stream', size: selectedFiles[index].size, dataUrl: result.value, createdAt: now + index, updatedAt: now + index }] : [])
      const failedFiles = selectedFiles.filter((_, index) => results[index].status === 'rejected')
      if (successful.length) onChange(types, [...successful, ...resources])
      if (failedFiles.length) {
        setSelectedFiles(failedFiles)
        setError(`${failedFiles.length} 个文件读取失败，请移除后重试`)
      } else {
        setResourceName(''); setSelectedFiles([]); setShowUpload(false)
      }
    }).catch(() => setError('文件读取失败，请重试')).finally(() => setUploading(false))
  }
  async function openDetail(resource: KnowledgeResource) {
    setDetail(resource); setEditing(false); setEditorName(resource.name); setEditorText(''); setEditorHtml(''); setSheetRows([]); setRotation(resource.rotation || 0); setError(''); setLoadingPreview(true)
    try {
      if (isText(resource)) setEditorText(decodeDataUrl(resource.dataUrl))
      if (isDocx(resource)) setEditorHtml((await mammoth.convertToHtml({ arrayBuffer: dataUrlToArrayBuffer(resource.dataUrl) })).value)
      if (isSpreadsheet(resource)) {
        const workbook = XLSX.read(dataUrlToArrayBuffer(resource.dataUrl), { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        setSheetRows((XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]).map((row) => row.map((cell) => String(cell))))
      }
    } catch { setError('资料预览解析失败，可尝试下载后打开') }
    finally { setLoadingPreview(false) }
  }
  function saveDetail() {
    if (!detail || !editorName.trim()) return setError('资料名称不能为空')
    let nextDataUrl = detail.dataUrl
    let nextMimeType = detail.mimeType
    if (isText(detail)) nextDataUrl = encodeText(editorText)
    if (isSpreadsheet(detail)) {
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), 'Sheet1')
      const binary = XLSX.write(workbook, { bookType: extension(detail.fileName) === 'xls' ? 'biff8' : 'xlsx', type: 'array' }) as ArrayBuffer
      nextMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; nextDataUrl = arrayBufferToDataUrl(binary, nextMimeType)
    }
    const updatedAt = Date.now()
    onChange(types, resources.map((item) => item.id === detail.id ? { ...item, name: editorName.trim(), dataUrl: nextDataUrl, mimeType: nextMimeType, size: Math.max(0, Math.round((nextDataUrl.length * 3) / 4)), rotation, updatedAt } : item))
    setDetail({ ...detail, name: editorName.trim(), dataUrl: nextDataUrl, mimeType: nextMimeType, rotation, updatedAt }); setEditing(false); setError('')
  }
  function removeType() { if (!deleteType) return; onChange(types.filter((type) => type.id !== deleteType.id), resources.filter((item) => item.typeId !== deleteType.id)); setDeleteType(null) }
  function removeResource() { if (!deleteResource) return; onChange(types, resources.filter((item) => item.id !== deleteResource.id)); setDeleteResource(null); setDetail(null) }
  function moveType(targetId: string) {
    if (!draggedTypeId || draggedTypeId === targetId) return
    const from = types.findIndex((type) => type.id === draggedTypeId); const to = types.findIndex((type) => type.id === targetId); if (from < 0 || to < 0) return
    const next = [...types]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); onChange(next, resources); setDraggedTypeId(null)
  }
  function formatSize(size: number) { if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB` }
  function openUpload(typeId: string) { setSelectedTypeId(typeId); setResourceName(''); setSelectedFiles([]); setError(''); setShowUpload(true) }
  function csvRows(text: string) { return text.split(/\r?\n/).filter(Boolean).map((line) => line.split(',').map((cell) => cell.trim())) }

  return <div className="collection-page collection-page--board">
    <div className="collection-board-toolbar"><div className="collection-board-title">知识库</div><button type="button" className="btn-primary" onClick={() => { setError(''); setShowCreateType(true) }}><Icon name="plus" size={14} /> 新增类型</button></div>
    <div className="collection-board-scroll">
      {types.map((type, typeIndex) => { const cards = resourcesByType.get(type.id) || []; const colorClass = ['status-group--research', 'status-group--reviewed', 'status-group--development', 'status-group--testing', 'status-group--live'][typeIndex % 5]; return <section className={`collection-column status-group ${colorClass}`} key={type.id} onDragOver={(event) => event.preventDefault()} onDrop={() => moveType(type.id)}>
        <div className="collection-column__head status-group__head"><button type="button" className="collection-column__drag" draggable onDragStart={() => setDraggedTypeId(type.id)} title="拖动排序" aria-label={`拖动排序 ${type.name}`}><Icon name="grip" size={15} /></button><span className="status-group__name">{type.name}</span><button type="button" className="collection-column__add-icon" onClick={(event) => { event.stopPropagation(); openUpload(type.id) }} title={`上传资料到 ${type.name}`} aria-label={`上传资料到 ${type.name}`}><Icon name="plus" size={14} /></button><button type="button" className="collection-column__delete" onClick={(event) => { event.stopPropagation(); setDeleteType(type) }} title={`删除类型 ${type.name}`} aria-label={`删除类型 ${type.name}`}><Icon name="trash" size={13} /></button></div>
        <div className="collection-column__body status-group__body-shell"><div className="collection-column__cards status-group__body">{!cards.length && <div className="status-group__empty">{query ? '没有匹配结果' : '暂无资料'}</div>}{cards.map((item) => <article className="req-card-wrap collection-board-card-wrap" key={item.id}><div className="req-card collection-board-card" onClick={() => openDetail(item)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDetail(item) }}><div className="req-card__top"><span className="req-card__ver"><Icon name="doc" size={12} /> 资料</span><span className="collection-card__date">{formatSize(item.size)}</span></div><div className="req-card__name">{item.name}</div><div className="req-card__content">{item.fileName}</div></div><div className="req-card__bottom-actions collection-card__actions" onClick={(event) => event.stopPropagation()}><button type="button" className="req-card__delete" onClick={() => openDetail(item)} title="查看或编辑资料" aria-label={`查看或编辑资料 ${item.name}`}><span className="icon-circle"><Icon name="edit" size={13} /></span></button><button type="button" className="req-card__delete" onClick={() => setDeleteResource(item)} title="删除资料" aria-label={`删除资料 ${item.name}`}><span className="icon-circle"><Icon name="trash" size={13} /></span></button></div></article>)}</div></div>
      </section> })}
    </div>
    {showCreateType && <div className="overlay" onClick={() => setShowCreateType(false)}><div className="modal collection-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">新增知识库类型</div><div className="field-label">类型名称</div><input className="text-input" value={typeName} onChange={(event) => { setTypeName(event.target.value); setError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addType() } }} placeholder="例如：产品方法论" autoFocus />{error && <div className="form-error">{error}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowCreateType(false)}>取消</button><button type="button" className="btn-primary" onClick={addType}>创建类型</button></div></div></div>}
    {showUpload && <div className="overlay" onClick={() => !uploading && setShowUpload(false)}><div className="modal modal--wide collection-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">上传资料</div><div className="field-label">资料类型</div><select className="text-input" value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)} disabled={uploading}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><div className="field-label collection-field-gap">资料名称 <span className="field-hint">单个文件时可自定义</span></div><input className="text-input" value={resourceName} onChange={(event) => setResourceName(event.target.value)} placeholder="可选，默认使用文件名" disabled={uploading} /><div className="field-label collection-field-gap">选择文件 <span className="field-required">*</span></div><label className="knowledge-file-picker"><Icon name="plus" size={15} />选择图片、文档、表格或 PDF（最多 20 个）<input type="file" multiple accept="image/*,.txt,.md,.markdown,.csv,.pdf,.doc,.docx,.xls,.xlsx" onChange={onFileChange} disabled={uploading} /></label>{selectedFiles.length > 0 && <div className="knowledge-upload-list">{selectedFiles.map((file, index) => <div className="knowledge-upload-item" key={`${file.name}-${file.lastModified}-${index}`}><div className="knowledge-upload-item__meta"><span>{file.name}</span><small>{formatSize(file.size)}</small></div><button type="button" className="knowledge-upload-item__remove" onClick={() => removeSelectedFile(index)} disabled={uploading} title={`移除 ${file.name}`} aria-label={`移除 ${file.name}`}><Icon name="close" size={13} /></button></div>)}</div>}{uploading && <div className="upload-progress" role="status">正在读取 {selectedFiles.length} 个文件…</div>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowUpload(false)} disabled={uploading}>取消</button><button type="button" className="btn-primary" onClick={addResource} disabled={uploading || !selectedFiles.length} style={{ opacity: selectedFiles.length && !uploading ? 1 : .45 }}>{uploading ? '上传中…' : `上传 ${selectedFiles.length || ''} 个文件`}</button></div></div></div>}
    {detail && <div className="overlay" onClick={() => setDetail(null)}><div className="modal modal--wide collection-detail-modal knowledge-detail-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">{editing ? '编辑资料' : detail.name}</div><div className="collection-detail__meta">{types.find((type) => type.id === detail.typeId)?.name} · {detail.fileName} · {formatSize(detail.size)}</div><div className="knowledge-preview">{loadingPreview ? <div className="knowledge-unsupported">正在解析资料…</div> : isImage(detail) && <img src={detail.dataUrl} alt={detail.name} style={{ transform: `rotate(${rotation}deg) scale(1)`, maxWidth: '100%', maxHeight: 360 }} />}{!loadingPreview && isPdf(detail) && <iframe title={detail.name} src={detail.dataUrl} className="knowledge-pdf-frame" />}{!loadingPreview && isDocx(detail) && <div className="knowledge-docx-preview" dangerouslySetInnerHTML={{ __html: editorHtml }} />}{!loadingPreview && isText(detail) && (editing ? <textarea className="text-area knowledge-editor" value={editorText} onChange={(event) => setEditorText(event.target.value)} /> : extension(detail.fileName) === 'csv' ? <table className="knowledge-csv-table"><tbody>{csvRows(editorText).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table> : <pre className="knowledge-text-preview">{editorText}</pre>)}{!loadingPreview && isSpreadsheet(detail) && <table className="knowledge-csv-table"><tbody>{sheetRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => editing ? <td key={cellIndex}><input className="knowledge-cell-input" value={cell} onChange={(event) => setSheetRows((current) => current.map((currentRow, currentRowIndex) => currentRowIndex === rowIndex ? currentRow.map((currentCell, currentCellIndex) => currentCellIndex === cellIndex ? event.target.value : currentCell) : currentRow))} /></td> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>}{!loadingPreview && !isImage(detail) && !isPdf(detail) && !isText(detail) && !isDocx(detail) && !isSpreadsheet(detail) && <div className="knowledge-unsupported"><Icon name="doc" size={22} /><div>当前格式支持在线预览和下载，暂不支持编辑。</div><span>可下载后使用本地 Office 或其他工具编辑。</span></div>}</div>{editing && <><div className="field-label collection-field-gap">资料名称</div><input className="text-input" value={editorName} onChange={(event) => setEditorName(event.target.value)} /></>}{error && <div className="form-error">{error}</div>}<div className="modal__actions"><a className="btn-ghost knowledge-download" href={detail.dataUrl} download={detail.fileName}>下载资料</a><button type="button" className="btn-ghost btn-ghost--danger" onClick={() => setDeleteResource(detail)}><Icon name="trash" size={13} /> 删除</button>{canEdit(detail) && !editing && <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>编辑</button>}{editing && isImage(detail) && <button type="button" className="btn-ghost" onClick={() => setRotation((value) => value + 90)}>旋转</button>}{editing && <button type="button" className="btn-primary" onClick={saveDetail}>保存</button>}{!editing && <button type="button" className="btn-primary" onClick={() => setDetail(null)}>关闭</button>}</div></div></div>}
    {deleteType && <div className="overlay" onClick={() => setDeleteType(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除类型？</div><div className="delete-confirm-modal__text">删除「{deleteType.name}」后，该类型下的资料也会一并移除。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteType(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={removeType}>确认删除</button></div></div></div>}
    {deleteResource && <div className="overlay" onClick={() => setDeleteResource(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除资料？</div><div className="delete-confirm-modal__text">删除「{deleteResource.name}」后无法恢复。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteResource(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={removeResource}>确认删除</button></div></div></div>}
  </div>
}
