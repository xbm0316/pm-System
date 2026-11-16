import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Icon from './Icon'
import type { ProjectTaskAttachment, WorkspaceCollectionType, WorkspaceRetro } from '../lib/store'
import { deleteLocalFile, uploadLocalFile } from '../lib/localFiles'

interface Props {
  spaceId: string
  types: WorkspaceCollectionType[]
  retros: WorkspaceRetro[]
  onChange: (types: WorkspaceCollectionType[], retros: WorkspaceRetro[]) => void
  searchQuery?: string
}

export default function RetroWorkspace({ spaceId, types, retros, onChange, searchQuery = '' }: Props) {
  const [showCreateType, setShowCreateType] = useState(false)
  const [showCreateRetro, setShowCreateRetro] = useState(false)
  const [editing, setEditing] = useState<WorkspaceRetro | null>(null)
  const [detail, setDetail] = useState<WorkspaceRetro | null>(null)
  const [deleteType, setDeleteType] = useState<WorkspaceCollectionType | null>(null)
  const [deleteRetro, setDeleteRetro] = useState<WorkspaceRetro | null>(null)
  const [typeName, setTypeName] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<ProjectTaskAttachment | null>(null)
  const [draggedTypeId, setDraggedTypeId] = useState<string | null>(null)

  useEffect(() => {
    if (!types.length) onChange([{ id: `retro-${Date.now().toString(36)}`, spaceId, name: '通用', createdAt: Date.now() }], retros)
  }, [onChange, retros, spaceId, types.length])

  const query = searchQuery.trim().toLocaleLowerCase()
  const cardsByType = useMemo(() => new Map(types.map((type) => [type.id, retros.filter((item) => item.typeId === type.id).filter((item) => !query || `${item.title} ${item.content}`.toLocaleLowerCase().includes(query)).sort((a, b) => b.createdAt - a.createdAt)])), [query, retros, types])

  function openCreateRetro(typeId: string) { setSelectedTypeId(typeId); setTitle(''); setContent(''); setSelectedFiles([]); setError(''); setShowCreateRetro(true) }
  function addType() {
    const name = typeName.trim()
    if (!name) return setError('请输入类型名称')
    onChange([...types, { id: `retro-${Date.now().toString(36)}`, spaceId, name, createdAt: Date.now() }], retros)
    setTypeName(''); setError(''); setShowCreateType(false)
  }
  async function addRetro() {
    if (!selectedTypeId || !title.trim() || !content.trim()) return setError('请填写复盘类型、标题和内容')
    const now = Date.now()
    const id = `retro-${now.toString(36)}`
    const results = await Promise.allSettled(selectedFiles.slice(0, 20).map((file) => uploadLocalFile(file, { spaceId, entityType: 'retro', entityId: id })))
    const attachments = results.flatMap((result) => result.status === 'fulfilled' ? [{ ...result.value, id: result.value.fileId }] : []) as ProjectTaskAttachment[]
    if (results.some((result) => result.status === 'rejected')) setError('部分附件上传失败，请确认已选择本地文件夹并授予写入权限')
    onChange(types, [{ id, spaceId, typeId: selectedTypeId, title: title.trim(), content: content.trim(), attachments, createdAt: now, updatedAt: now }, ...retros])
    setSelectedFiles([]); setShowCreateRetro(false)
  }
  function openEdit(item: WorkspaceRetro) { setEditing(item); setSelectedTypeId(item.typeId); setTitle(item.title); setContent(item.content); setSelectedFiles([]); setError('') }
  async function saveEdit() {
    if (!editing || !selectedTypeId || !title.trim() || !content.trim()) return setError('请填写复盘类型、标题和内容')
    const now = Date.now()
    const results = selectedFiles.length ? await Promise.allSettled(selectedFiles.slice(0, 20 - (editing.attachments || []).length).map((file) => uploadLocalFile(file, { spaceId, entityType: 'retro', entityId: editing.id }))) : []
    const added = results.flatMap((result) => result.status === 'fulfilled' ? [{ ...result.value, id: result.value.fileId }] : []) as ProjectTaskAttachment[]
    const attachments = selectedFiles.length ? [...(editing.attachments || []), ...added] : editing.attachments
    if (results.some((result) => result.status === 'rejected')) setError('部分附件上传失败，请确认已选择本地文件夹并授予写入权限')
    onChange(types, retros.map((item) => item.id === editing.id ? { ...item, typeId: selectedTypeId, title: title.trim(), content: content.trim(), attachments, updatedAt: now } : item)); setEditing(null); setSelectedFiles([])
  }
  function onFiles(event: ChangeEvent<HTMLInputElement>) { setSelectedFiles((current) => [...current, ...Array.from(event.target.files || []).slice(0, 20 - current.length)]); event.target.value = '' }
  function removeAttachment(item: WorkspaceRetro, attachment: ProjectTaskAttachment) { void deleteLocalFile(attachment.fileId || attachment.id); const next = { ...item, attachments: (item.attachments || []).filter((entry) => entry.id !== attachment.id), updatedAt: Date.now() }; onChange(types, retros.map((entry) => entry.id === item.id ? next : entry)); setDetail(next); setPreviewAttachment(null) }
  function removeType() { if (!deleteType) return; retros.filter((item) => item.typeId === deleteType.id).flatMap((item) => item.attachments || []).forEach((attachment) => void deleteLocalFile(attachment.fileId || attachment.id)); onChange(types.filter((type) => type.id !== deleteType.id), retros.filter((item) => item.typeId !== deleteType.id)); setDeleteType(null) }
  function removeRetro() { if (!deleteRetro) return; (deleteRetro.attachments || []).forEach((attachment) => void deleteLocalFile(attachment.fileId || attachment.id)); onChange(types, retros.filter((item) => item.id !== deleteRetro.id)); setDeleteRetro(null); setDetail(null) }
  function moveType(targetId: string) {
    if (!draggedTypeId || draggedTypeId === targetId) return
    const from = types.findIndex((type) => type.id === draggedTypeId); const to = types.findIndex((type) => type.id === targetId); if (from < 0 || to < 0) return
    const next = [...types]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); onChange(next, retros); setDraggedTypeId(null)
  }

  return <div className="collection-page collection-page--board">
    <div className="collection-board-toolbar"><div className="collection-board-title">复盘记录</div><button type="button" className="btn-primary" onClick={() => { setError(''); setShowCreateType(true) }}><Icon name="plus" size={14} /> 新增类型</button></div>
    <div className="collection-board-scroll">
      {types.map((type, typeIndex) => { const cards = cardsByType.get(type.id) || []; const colorClass = ['status-group--research', 'status-group--reviewed', 'status-group--development', 'status-group--testing', 'status-group--live'][typeIndex % 5]; return <section className={`collection-column status-group ${colorClass}`} key={type.id} onDragOver={(event) => event.preventDefault()} onDrop={() => moveType(type.id)}>
        <div className="collection-column__head status-group__head"><button type="button" className="collection-column__drag" draggable onDragStart={() => setDraggedTypeId(type.id)} title="拖动排序" aria-label={`拖动排序 ${type.name}`}><Icon name="grip" size={15} /></button><span className="status-group__name">{type.name}</span><button type="button" className="collection-column__add-icon" onClick={(event) => { event.stopPropagation(); openCreateRetro(type.id) }} title={`新增复盘到 ${type.name}`} aria-label={`新增复盘到 ${type.name}`}><Icon name="plus" size={14} /></button><button type="button" className="collection-column__delete" onClick={(event) => { event.stopPropagation(); setDeleteType(type) }} title={`删除类型 ${type.name}`} aria-label={`删除类型 ${type.name}`}><Icon name="trash" size={13} /></button></div>
        <div className="collection-column__body status-group__body-shell"><div className="collection-column__cards status-group__body">{!cards.length && <div className="status-group__empty">{query ? '没有匹配结果' : '暂无复盘'}</div>}{cards.map((item) => <article className="req-card-wrap collection-board-card-wrap" key={item.id}><div className="req-card collection-board-card" onClick={() => setDetail(item)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setDetail(item) }}><div className="req-card__top"><span className="req-card__ver">复盘</span><span className="collection-card__date">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span></div><div className="req-card__name">{item.title}</div><div className="req-card__content">{item.content}</div></div><div className="req-card__bottom-actions collection-card__actions" onClick={(event) => event.stopPropagation()}><button type="button" className="req-card__delete" onClick={() => openEdit(item)} title="编辑复盘" aria-label={`编辑复盘 ${item.title}`}><span className="icon-circle"><Icon name="edit" size={13} /></span></button><button type="button" className="req-card__delete" onClick={() => setDeleteRetro(item)} title="删除复盘" aria-label={`删除复盘 ${item.title}`}><span className="icon-circle"><Icon name="trash" size={13} /></span></button></div></article>)}</div></div>
      </section> })}
    </div>
    {showCreateType && <div className="overlay" onClick={() => setShowCreateType(false)}><div className="modal collection-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">新增复盘类型</div><div className="field-label">类型名称</div><input className="text-input" value={typeName} onChange={(event) => { setTypeName(event.target.value); setError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addType() } }} placeholder="例如：沟通技巧" autoFocus />{error && <div className="form-error">{error}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowCreateType(false)}>取消</button><button type="button" className="btn-primary" onClick={addType}>创建类型</button></div></div></div>}
    {showCreateRetro && <div className="overlay" onClick={() => setShowCreateRetro(false)}><div className="modal modal--wide collection-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">新增复盘</div><div className="field-label">复盘类型</div><select className="text-input" value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><div className="field-label collection-field-gap">复盘标题 <span className="field-required">*</span></div><input className="text-input" value={title} onChange={(event) => { setTitle(event.target.value); setError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addRetro() } }} placeholder="这次遇到了什么问题" autoFocus /><div className="field-label collection-field-gap">复盘内容 <span className="field-required">*</span></div><textarea className="text-area" rows={7} value={content} onChange={(event) => { setContent(event.target.value); setError('') }} placeholder="记录解决技巧、处理方法和下次可复用的经验…" /><div className="field-label collection-field-gap">附件</div><label className="knowledge-file-picker"><Icon name="plus" size={15} />添加多个附件<input type="file" multiple onChange={onFiles} /></label>{selectedFiles.length > 0 && <div className="knowledge-upload-list">{selectedFiles.map((file, index) => <div className="knowledge-upload-item" key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" className="knowledge-upload-item__remove" onClick={() => setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}><Icon name="close" size={13} /></button></div>)}</div>}{error && <div className="form-error">{error}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowCreateRetro(false)}>取消</button><button type="button" className="btn-primary" onClick={addRetro}>创建复盘</button></div></div></div>}
    {(editing || detail) && <div className="overlay" onClick={() => { setEditing(null); setDetail(null) }}><div className="modal modal--wide collection-detail-modal" onClick={(event) => event.stopPropagation()}>{editing ? <><div className="modal__title">编辑复盘</div><div className="field-label">复盘类型</div><select className="text-input" value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><div className="field-label collection-field-gap">复盘标题 <span className="field-required">*</span></div><input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveEdit() } }} /><div className="field-label collection-field-gap">复盘内容 <span className="field-required">*</span></div><textarea className="text-area" rows={8} value={content} onChange={(event) => setContent(event.target.value)} /><div className="field-label collection-field-gap">附件</div><label className="knowledge-file-picker"><Icon name="plus" size={15} />添加多个附件<input type="file" multiple onChange={onFiles} /></label>{error && <div className="form-error">{error}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>取消</button><button type="button" className="btn-primary" onClick={saveEdit}>保存</button></div></> : detail && <><div className="modal__title">{detail.title}</div><div className="collection-detail__meta">{types.find((type) => type.id === detail.typeId)?.name} · {new Date(detail.createdAt).toLocaleDateString('zh-CN')}</div><div className="collection-detail__content">{detail.content}</div>{detail.attachments?.length ? <div className="project-task-attachments">{detail.attachments.map((attachment) => <div className="project-task-attachment-wrap" key={attachment.id}><button type="button" className="project-task-attachment" onClick={() => setPreviewAttachment(attachment)}>{attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name} /> : <span className="project-task-attachment__file">文件</span>}<span>{attachment.name}</span></button><button type="button" className="project-task-attachment__remove" onClick={() => removeAttachment(detail, attachment)} title="删除附件" aria-label={`删除附件 ${attachment.name}`}><Icon name="trash" size={12} /></button></div>)}</div> : null}<div className="modal__actions"><button type="button" className="btn-primary" onClick={() => setDetail(null)}>关闭</button></div></>}</div></div>}
    {previewAttachment && <div className="overlay" onClick={() => setPreviewAttachment(null)}><div className="modal attachment-preview" onClick={(event) => event.stopPropagation()}><div className="modal__title">{previewAttachment.name}</div>{previewAttachment.kind === 'image' ? <img className="attachment-preview__image" src={previewAttachment.url} alt={previewAttachment.name} /> : <div className="attachment-preview__file"><span className="attachment-preview__file-icon">文件</span><span>{previewAttachment.type}</span></div>}<div className="modal__actions"><a className="btn-ghost" href={previewAttachment.url} download={previewAttachment.name}>下载附件</a><button type="button" className="btn-primary" onClick={() => setPreviewAttachment(null)}>关闭</button></div></div></div>}
    {deleteType && <div className="overlay" onClick={() => setDeleteType(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除类型？</div><div className="delete-confirm-modal__text">删除「{deleteType.name}」后，该类型下的复盘记录也会一并移除。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteType(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={removeType}>确认删除</button></div></div></div>}
    {deleteRetro && <div className="overlay" onClick={() => setDeleteRetro(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除复盘？</div><div className="delete-confirm-modal__text">删除「{deleteRetro.title}」后无法恢复。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteRetro(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={removeRetro}>确认删除</button></div></div></div>}
  </div>
}
