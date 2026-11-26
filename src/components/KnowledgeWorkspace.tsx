import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Table, TableBody, TableRow, TableCell } from '@astryxdesign/core/Table'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useAttachmentDraft } from '../lib/useAttachmentDraft'
import ConfirmDataDeletion from './ConfirmDataDeletion'
import AttachmentPicker from './AttachmentPicker'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Selector } from '@astryxdesign/core/Selector'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import type { KnowledgeResource, WorkspaceCollectionType } from '../lib/store'
import { deleteLocalFile, deleteLocalFilesForEntities, deleteLocalFilesForEntity, fetchLocalBuffer, uploadLocalFile } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'

interface Props {
  spaceId: string
  types: WorkspaceCollectionType[]
  resources: KnowledgeResource[]
  onChange: (types: WorkspaceCollectionType[], resources: KnowledgeResource[]) => Promise<void>
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
function decodeBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  return new TextDecoder().decode(bytes)
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
  const attachmentDraft = useAttachmentDraft({ maxFiles: MAX_UPLOAD_FILES, maxSize: 15, maxTotal: MAX_UPLOAD_TOTAL_SIZE / (1024 * 1024) })
  const selectedFiles = attachmentDraft.files
  const [editorName, setEditorName] = useState('')
  const [editorText, setEditorText] = useState('')
  const [editorHtml, setEditorHtml] = useState('')
  const [sheetRows, setSheetRows] = useState<string[][]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const uploading = attachmentDraft.saving
  const [editing, setEditing] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [error, setError] = useState('')
  const [draggedTypeId, setDraggedTypeId] = useState<string | null>(null)

  const query = searchQuery.trim().toLocaleLowerCase()
  const resourcesByType = useMemo(() => new Map(types.map((type) => [type.id, resources.filter((item) => item.typeId === type.id).filter((item) => !query || `${item.name} ${item.fileName} ${item.mimeType}`.toLocaleLowerCase().includes(query)).sort((a, b) => b.createdAt - a.createdAt)])), [query, resources, types])

  async function addType() {
    const name = typeName.trim()
    if (!name) return setError('请输入类型名称')
    try { await onChange([...types, { id: `knowledge-${Date.now().toString(36)}`, spaceId, name, createdAt: Date.now() }], resources) } catch { return setError("无法保存类型，请重试") }
    setTypeName(''); setError(''); setShowCreateType(false)
  }
  async function addResource() {
    if (!selectedTypeId || !selectedFiles.length) return setError('请选择要上传的文件')
    setError('')
    const now = Date.now()
    const draftIds = selectedFiles.map((_, index) => 'knowledge-' + (now + index).toString(36))
    const typeName = types.find((type) => type.id === selectedTypeId)?.name || selectedTypeId
    const saved = await attachmentDraft.save((_, index) => ({
      spaceId, entityType: 'knowledge', entityId: draftIds[index], pathSegments: ['知识库', typeName],
    }), (attachments) => {
      const added: KnowledgeResource[] = attachments.map((file, index) => ({
        id: draftIds[index], spaceId, typeId: selectedTypeId,
        name: resourceName.trim() && attachments.length === 1 ? resourceName.trim() : file.name,
        fileName: file.name, mimeType: file.type, size: file.size, fileId: file.fileId,
        fileUrl: file.url, relativePath: file.relativePath, createdAt: now + index, updatedAt: now + index,
      }))
      return onChange(types, [...added, ...resources])
    })
    if (saved) { setResourceName(''); setShowUpload(false) }
  }
  async function openDetail(resource: KnowledgeResource) {
    setDetail(resource); setEditing(false); setEditorName(resource.name); setEditorText(''); setEditorHtml(''); setSheetRows([]); setRotation(resource.rotation || 0); setError(''); setLoadingPreview(true)
    try {
      const buffer = resource.fileUrl ? await fetchLocalBuffer(resource.fileUrl) : resource.dataUrl ? new TextEncoder().encode(resource.dataUrl).buffer : new ArrayBuffer(0)
      if (isText(resource)) setEditorText(resource.fileUrl ? decodeBuffer(buffer) : '')
      if (isDocx(resource)) {
        const { default: mammoth } = await import('mammoth')
        setEditorHtml((await mammoth.convertToHtml({ arrayBuffer: buffer })).value)
      }
      if (isSpreadsheet(resource)) {
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        setSheetRows((XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]).map((row) => row.map((cell) => String(cell))))
      }
    } catch { setError('资料预览解析失败，可尝试下载后打开') }
    finally { setLoadingPreview(false) }
  }
  async function saveDetail() {
    if (!detail || !editorName.trim()) return setError('资料名称不能为空')
    let nextMimeType = detail.mimeType
    let nextFileId = detail.fileId
    let nextFileUrl = detail.fileUrl
    let nextRelativePath = detail.relativePath
    let nextSize = detail.size
    let replacement: Blob | null = null
    if (isText(detail)) replacement = new Blob([editorText], { type: 'text/plain;charset=utf-8' })
    if (isSpreadsheet(detail)) {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), 'Sheet1')
      const binary = XLSX.write(workbook, { bookType: extension(detail.fileName) === 'xls' ? 'biff8' : 'xlsx', type: 'array' }) as ArrayBuffer
      nextMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; replacement = new Blob([binary], { type: nextMimeType })
    }
    if (replacement) {
      const typeName = types.find((type) => type.id === detail.typeId)?.name || detail.typeId
      const uploaded = await uploadLocalFile(replacement, { spaceId, entityType: 'knowledge', entityId: detail.id, fileName: detail.fileName, pathSegments: ['知识库', typeName] })
      nextFileId = uploaded.fileId; nextFileUrl = uploaded.url; nextRelativePath = uploaded.relativePath; nextSize = replacement.size
    }
    const updatedAt = Date.now()
    const updated = { ...detail, name: editorName.trim(), fileId: nextFileId, fileUrl: nextFileUrl, relativePath: nextRelativePath, mimeType: nextMimeType, size: nextSize, rotation, updatedAt }
    try {
      await onChange(types, resources.map((item) => item.id === detail.id ? updated : item))
    } catch (cause) {
      if (replacement) await deleteLocalFile(nextFileId).catch(() => undefined)
      throw cause
    }
    setDetail(updated); setEditing(false); setError('')
    if (replacement) {
      try { await deleteLocalFile(detail.fileId) }
      catch { setError('新版资料已保存，旧附件暂未清理') }
    }
  }
  async function removeType() {
    if (!deleteType) return
    const removing = resources.filter((item) => item.typeId === deleteType.id)
    await deleteLocalFilesForEntities(removing.map((item) => ({ type: 'knowledge', id: item.id })), spaceId)
    await onChange(types.filter((type) => type.id !== deleteType.id), resources.filter((item) => item.typeId !== deleteType.id))
  }

  async function removeResource() {
    if (!deleteResource) return
    await deleteLocalFilesForEntity('knowledge', deleteResource.id, spaceId)
    await onChange(types, resources.filter((item) => item.id !== deleteResource.id))
    if (detail?.id === deleteResource.id) setDetail(null)
  }

  function moveType(targetId: string) {
    if (!draggedTypeId || draggedTypeId === targetId) return
    const from = types.findIndex((type) => type.id === draggedTypeId); const to = types.findIndex((type) => type.id === targetId); if (from < 0 || to < 0) return
    const next = [...types]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); void onChange(next, resources).catch(() => undefined); setDraggedTypeId(null)
  }
  function formatSize(size: number) { if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB` }
  function openUpload(typeId: string) { setSelectedTypeId(typeId); setResourceName(''); attachmentDraft.reset(); setError(''); setShowUpload(true) }
  function csvRows(text: string) { return text.split(/\r?\n/).filter(Boolean).map((line) => line.split(',').map((cell) => cell.trim())) }

  return <div className="collection-page collection-page--board"><Layout height="fill" header={<LayoutHeader padding={2}><div className="collection-board-toolbar"><div className="collection-board-title">知识库</div><Button label="新增类型" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={() => { setError(''); setShowCreateType(true) }} /></div></LayoutHeader>} content={<LayoutContent padding={0}><div className="collection-board-scroll">
      {types.map((type, typeIndex) => { const cards = resourcesByType.get(type.id) || []; const colorClass = ['status-group--research', 'status-group--reviewed', 'status-group--development', 'status-group--testing', 'status-group--live'][typeIndex % 5]; return <Card variant="muted" padding={0} className={`collection-column status-group ${colorClass}`} key={type.id} onDragOver={(event) => event.preventDefault()} onDrop={() => moveType(type.id)}>
        <Layout height="fill" header={<LayoutHeader hasDivider padding={3}><div className="collection-column__head"><button type="button" className="collection-column__drag" draggable onDragStart={() => setDraggedTypeId(type.id)} title="拖动排序" aria-label={`拖动排序 ${type.name}`}><Icon name="grip" size={15} /></button><span className="status-group__name">{type.name}</span><IconButton label={`上传资料到 ${type.name}`} variant="ghost" size="sm" className="collection-column__add-icon" icon={<Icon name="plus" size={14} />} type="button" onClick={(event) => { event.stopPropagation(); openUpload(type.id) }} /><IconButton label={`删除类型 ${type.name}`} variant="ghost" size="sm" className="collection-column__delete" icon={<Icon name="trash" size={13} />} type="button" onClick={(event) => { event.stopPropagation(); setDeleteType(type) }} /></div></LayoutHeader>} content={<LayoutContent padding={2}><div className="collection-column__cards">{!cards.length && <EmptyState isCompact title={query ? '没有匹配结果' : '暂无资料'} />}{cards.map((item) => <article className="req-card-wrap collection-board-card-wrap" key={item.id}><ClickableCard label={`查看资料 ${item.name}`} padding={0} className="req-card collection-board-card" onClick={() => openDetail(item)}><div className="req-card__top"><span className="req-card__ver"><Icon name="doc" size={12} /> 资料</span><span className="collection-card__date">{formatSize(item.size)}</span></div><div className="req-card__name">{item.name}</div><div className="req-card__content">{item.fileName}</div>{item.relativePath && <code className="collection-card__path">{item.relativePath}</code>}</ClickableCard><div className="req-card__bottom-actions collection-card__actions" onClick={(event) => event.stopPropagation()}><IconButton label={`查看或编辑资料 ${item.name}`} variant="ghost" size="sm" className="req-card__delete" icon={<Icon name="edit" size={13} />} type="button" onClick={() => openDetail(item)} /><IconButton label={`删除资料 ${item.name}`} variant="ghost" size="sm" className="req-card__delete" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteResource(item)} /></div></article>)}</div></LayoutContent>} />
      </Card> })}
    </div></LayoutContent>} />
    {showCreateType && <WorkspaceOverlay label="新增知识库类型" onClose={() => setShowCreateType(false)}><div className="modal collection-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">新增知识库类型</Heading><div className="field-label">类型名称</div><TextInput label="类型名称" isLabelHidden width="100%" value={typeName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addType() } }} placeholder="例如：产品方法论" hasAutoFocus onChange={(nextValue) => { setTypeName(nextValue); setError('') }} />{error && <Banner status="error" title={<>{error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setShowCreateType(false)} /><Button label="创建类型" variant="primary" type="button" onClick={addType} /></div></div></WorkspaceOverlay>}
    {showUpload && <WorkspaceOverlay label="上传资料" onClose={() => !uploading && setShowUpload(false)}><div className="modal modal--wide collection-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">上传资料</Heading><div className="field-label">资料类型</div><Selector label="所属类型" isLabelHidden width="100%" value={selectedTypeId} onChange={setSelectedTypeId} isDisabled={uploading} options={types.map(({ id, name }) => ({ value: id, label: name }))} /><div className="field-label collection-field-gap">资料名称 <span className="field-hint">单个文件时可自定义</span></div><TextInput label="资料名称" isLabelHidden width="100%" value={resourceName} placeholder="可选，默认使用文件名" isDisabled={uploading} onChange={setResourceName} /><div className="field-label collection-field-gap">选择文件 <span className="field-required">*</span></div><AttachmentPicker label="选择资料文件" accept="image/*,.txt,.md,.markdown,.csv,.pdf,.doc,.docx,.xls,.xlsx" description="支持图片、文档、表格和 PDF，最多 20 个文件。" files={selectedFiles} onRemove={attachmentDraft.remove} onFiles={attachmentDraft.add} isDisabled={uploading} />{attachmentDraft.error && <Banner status="error" title={<>{attachmentDraft.error}</>} />}{uploading && <div className="upload-progress" role="status">正在读取 {selectedFiles.length} 个文件…</div>}{error && <Banner status="error" title={<>{error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setShowUpload(false)} isDisabled={uploading} /><Button label={`上传 ${selectedFiles.length || ''} 个文件`} variant="primary" type="button" onClick={addResource} isDisabled={uploading || !selectedFiles.length} isLoading={uploading} /></div></div></WorkspaceOverlay>}
    {detail && <WorkspaceOverlay label={editing ? '编辑资料' : detail.name} onClose={() => setDetail(null)}><div className="modal modal--wide collection-detail-modal knowledge-detail-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">{editing ? '编辑资料' : detail.name}</Heading><div className="collection-detail__meta">{types.find((type) => type.id === detail.typeId)?.name} · {detail.fileName} · {formatSize(detail.size)}</div><FileAttachmentList files={[{ id: detail.id, fileId: detail.fileId, name: detail.fileName, type: detail.mimeType, mimeType: detail.mimeType, size: detail.size, url: detail.fileUrl || detail.dataUrl, kind: isImage(detail) ? 'image' : 'file', relativePath: detail.relativePath }]} compact /><div className="knowledge-preview">{loadingPreview ? <div className="knowledge-unsupported">正在解析资料…</div> : isImage(detail) && <img src={detail.fileUrl || detail.dataUrl} alt={detail.name} style={{ transform: `rotate(${rotation}deg) scale(1)`, maxWidth: '100%', maxHeight: 360 }} />}{!loadingPreview && isPdf(detail) && <iframe title={detail.name} src={detail.fileUrl || detail.dataUrl} className="knowledge-pdf-frame" />}{!loadingPreview && isDocx(detail) && <div className="knowledge-docx-preview" dangerouslySetInnerHTML={{ __html: editorHtml }} />}{!loadingPreview && isText(detail) && (editing ? <TextArea label="资料正文" value={editorText} isLabelHidden width="100%" rows={12} onChange={setEditorText} /> : extension(detail.fileName) === 'csv' ? <Table density="compact" className="knowledge-csv-table"><TableBody>{csvRows(editorText).map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table> : <pre className="knowledge-text-preview">{editorText}</pre>)}{!loadingPreview && isSpreadsheet(detail) && <Table density="compact" className="knowledge-csv-table"><TableBody>{sheetRows.map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, cellIndex) => editing ? <TableCell key={cellIndex}><TextInput label={`第 ${rowIndex + 1} 行，第 ${cellIndex + 1} 列`} value={cell} isLabelHidden width="100%" size="sm" onChange={(nextValue) => setSheetRows((current) => current.map((currentRow, currentRowIndex) => currentRowIndex === rowIndex ? currentRow.map((currentCell, currentCellIndex) => currentCellIndex === cellIndex ? nextValue : currentCell) : currentRow))} /></TableCell> : <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table>}{!loadingPreview && !isImage(detail) && !isPdf(detail) && !isText(detail) && !isDocx(detail) && !isSpreadsheet(detail) && <div className="knowledge-unsupported"><Icon name="doc" size={22} /><div>当前格式支持在线预览和下载，暂不支持编辑。</div><span>可下载后使用本地 Office 或其他工具编辑。</span></div>}</div>{editing && <><div className="field-label collection-field-gap">资料名称</div><TextInput label="资料名称" value={editorName} isLabelHidden width="100%" onChange={setEditorName} /></>}{error && <Banner status="error" title={<>{error}</>} />}<div className="modal__actions"><a className="btn-ghost knowledge-download" href={detail.fileUrl || detail.dataUrl} download={detail.fileName}>下载资料</a><Button label="删除" variant="ghost" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteResource(detail)} className="btn-ghost--danger" />{canEdit(detail) && !editing && <Button label="编辑" variant="ghost" type="button" onClick={() => setEditing(true)} />}{editing && isImage(detail) && <Button label="旋转" variant="ghost" type="button" onClick={() => setRotation((value) => value + 90)} />}{editing && <Button label="保存" variant="primary" type="button" onClick={() => void saveDetail().catch((cause) => setError(cause instanceof Error ? cause.message : '资料保存失败'))} />}{!editing && <Button label="关闭" variant="primary" type="button" onClick={() => setDetail(null)} />}</div></div></WorkspaceOverlay>}
    {deleteType && <ConfirmDataDeletion title={'删除类型「' + deleteType.name + '」？'} onClose={() => setDeleteType(null)} onDelete={removeType} />}
    {deleteResource && <ConfirmDataDeletion title={'删除资料「' + deleteResource.name + '」？'} onClose={() => setDeleteResource(null)} onDelete={removeResource} />}
  </div>
}
