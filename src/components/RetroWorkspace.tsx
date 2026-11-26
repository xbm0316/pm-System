import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { IconButton } from '@astryxdesign/core/IconButton'
import { useAttachmentDraft } from '../lib/useAttachmentDraft'
import ConfirmDataDeletion from './ConfirmDataDeletion'
import AttachmentPicker from './AttachmentPicker'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Selector } from '@astryxdesign/core/Selector'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import RichTextField, { RichTextContent } from './RichTextField'
import { richTextPlainText } from '../lib/richText'
import type { ProjectTaskAttachment, WorkspaceCollectionType, WorkspaceRetro } from '../lib/store'
import { deleteLocalFile, deleteLocalFilesForEntities, deleteLocalFilesForEntity } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'

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
  const [deleteFile, setDeleteFile] = useState<{ retro: WorkspaceRetro; attachment: ProjectTaskAttachment } | null>(null)
  const [deleteType, setDeleteType] = useState<WorkspaceCollectionType | null>(null)
  const [deleteRetro, setDeleteRetro] = useState<WorkspaceRetro | null>(null)
  const [typeName, setTypeName] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const attachmentDraft = useAttachmentDraft()
  const [draggedTypeId, setDraggedTypeId] = useState<string | null>(null)

  const query = searchQuery.trim().toLocaleLowerCase()
  const cardsByType = useMemo(() => new Map(types.map((type) => [type.id, retros.filter((item) => item.typeId === type.id).filter((item) => !query || `${item.title} ${richTextPlainText(item.content)}`.toLocaleLowerCase().includes(query)).sort((a, b) => b.createdAt - a.createdAt)])), [query, retros, types])

  function openCreateRetro(typeId: string) { setSelectedTypeId(typeId); setTitle(''); setContent(''); attachmentDraft.reset(); setError(''); setShowCreateRetro(true) }
  function addType() {
    const name = typeName.trim()
    if (!name) return setError('请输入类型名称')
    onChange([...types, { id: `retro-${Date.now().toString(36)}`, spaceId, name, createdAt: Date.now() }], retros)
    setTypeName(''); setError(''); setShowCreateType(false)
  }
  async function addRetro() {
    if (!selectedTypeId || !title.trim() || !content.trim()) return setError('请填写复盘类型、标题和内容')
    setError('')
    const now = Date.now()
    const id = `retro-${now.toString(36)}`
    const typeName = types.find((type) => type.id === selectedTypeId)?.name || selectedTypeId
    const saved = await attachmentDraft.save({ spaceId, entityType: 'retro', entityId: id, pathSegments: ['复盘', typeName] }, (attachments) => {
      onChange(types, [{ id, spaceId, typeId: selectedTypeId, title: title.trim(), content: content.trim(), attachments, createdAt: now, updatedAt: now }, ...retros])
    })
    if (saved) setShowCreateRetro(false)
  }
  function openEdit(item: WorkspaceRetro) { setEditing(item); setSelectedTypeId(item.typeId); setTitle(item.title); setContent(item.content); attachmentDraft.reset(); setError('') }
  async function saveEdit() {
    if (!editing || !selectedTypeId || !title.trim() || !content.trim()) return setError('请填写复盘类型、标题和内容')
    setError('')
    const now = Date.now()
    const typeName = types.find((type) => type.id === selectedTypeId)?.name || selectedTypeId
    const saved = await attachmentDraft.save({ spaceId, entityType: 'retro', entityId: editing.id, pathSegments: ['复盘', typeName] }, (added) => {
      const attachments = [...(editing.attachments || []), ...added]
      onChange(types, retros.map((item) => item.id === editing.id ? { ...item, typeId: selectedTypeId, title: title.trim(), content: content.trim(), attachments, updatedAt: now } : item))
    })
    if (saved) setEditing(null)
  }
  async function removeAttachment(item: WorkspaceRetro, attachment: ProjectTaskAttachment) { await deleteLocalFile(attachment.fileId || attachment.id); const next = { ...item, attachments: (item.attachments || []).filter((entry) => entry.id !== attachment.id), updatedAt: Date.now() }; onChange(types, retros.map((entry) => entry.id === item.id ? next : entry)); setDetail(next) }
  async function removeType() {
    if (!deleteType) return
    const removing = retros.filter((item) => item.typeId === deleteType.id)
    await deleteLocalFilesForEntities(removing.map((item) => ({ type: 'retro', id: item.id })), spaceId)
    onChange(types.filter((type) => type.id !== deleteType.id), retros.filter((item) => item.typeId !== deleteType.id))
  }

  async function removeRetro() {
    if (!deleteRetro) return
    await deleteLocalFilesForEntity('retro', deleteRetro.id, spaceId)
    onChange(types, retros.filter((item) => item.id !== deleteRetro.id))
    if (detail?.id === deleteRetro.id) setDetail(null)
  }

  function moveType(targetId: string) {
    if (!draggedTypeId || draggedTypeId === targetId) return
    const from = types.findIndex((type) => type.id === draggedTypeId); const to = types.findIndex((type) => type.id === targetId); if (from < 0 || to < 0) return
    const next = [...types]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); onChange(next, retros); setDraggedTypeId(null)
  }

  return <div className="collection-page collection-page--board"><Layout height="fill" header={<LayoutHeader padding={2}><div className="collection-board-toolbar"><div className="collection-board-title">复盘记录</div><Button label="新增类型" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={() => { setError(''); setShowCreateType(true) }} /></div></LayoutHeader>} content={<LayoutContent padding={0}><div className="collection-board-scroll">
      {types.map((type, typeIndex) => { const cards = cardsByType.get(type.id) || []; const colorClass = ['status-group--research', 'status-group--reviewed', 'status-group--development', 'status-group--testing', 'status-group--live'][typeIndex % 5]; return <Card variant="muted" padding={0} className={`collection-column status-group ${colorClass}`} key={type.id} onDragOver={(event) => event.preventDefault()} onDrop={() => moveType(type.id)}>
        <Layout height="fill" header={<LayoutHeader hasDivider padding={3}><div className="collection-column__head"><button type="button" className="collection-column__drag" draggable onDragStart={() => setDraggedTypeId(type.id)} title="拖动排序" aria-label={`拖动排序 ${type.name}`}><Icon name="grip" size={15} /></button><span className="status-group__name">{type.name}</span><IconButton label={`新增复盘到 ${type.name}`} variant="ghost" size="sm" className="collection-column__add-icon" icon={<Icon name="plus" size={14} />} type="button" onClick={(event) => { event.stopPropagation(); openCreateRetro(type.id) }} /><IconButton label={`删除类型 ${type.name}`} variant="ghost" size="sm" className="collection-column__delete" icon={<Icon name="trash" size={13} />} type="button" onClick={(event) => { event.stopPropagation(); setDeleteType(type) }} /></div></LayoutHeader>} content={<LayoutContent padding={2}><div className="collection-column__cards">{!cards.length && <EmptyState isCompact title={query ? '没有匹配结果' : '暂无复盘'} />}{cards.map((item) => <article className="req-card-wrap collection-board-card-wrap" key={item.id}><ClickableCard label={`查看复盘 ${item.title}`} padding={0} className="req-card collection-board-card" onClick={() => setDetail(item)}><div className="req-card__top"><span className="req-card__ver">复盘</span><span className="collection-card__date">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span></div><div className="req-card__name">{item.title}</div><div className="req-card__content">{richTextPlainText(item.content)}</div></ClickableCard><div className="req-card__bottom-actions collection-card__actions" onClick={(event) => event.stopPropagation()}><IconButton label={`编辑复盘 ${item.title}`} variant="ghost" size="sm" className="req-card__delete" icon={<Icon name="edit" size={13} />} type="button" onClick={() => openEdit(item)} /><IconButton label={`删除复盘 ${item.title}`} variant="ghost" size="sm" className="req-card__delete" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteRetro(item)} /></div></article>)}</div></LayoutContent>} />
      </Card> })}
    </div></LayoutContent>} />
    {showCreateType && <WorkspaceOverlay label="新增复盘类型" onClose={() => setShowCreateType(false)}><div className="modal collection-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">新增复盘类型</Heading><div className="field-label">类型名称</div><TextInput label="类型名称" isLabelHidden width="100%" value={typeName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addType() } }} placeholder="例如：沟通技巧" hasAutoFocus onChange={(nextValue) => { setTypeName(nextValue); setError('') }} />{(error || attachmentDraft.error) && <Banner status="error" title={<>{error || attachmentDraft.error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setShowCreateType(false)} /><Button label="创建类型" variant="primary" type="button" onClick={addType} /></div></div></WorkspaceOverlay>}
    {showCreateRetro && <WorkspaceOverlay label="新增复盘" onClose={() => { if (!attachmentDraft.saving) setShowCreateRetro(false) }}><div className="modal modal--wide collection-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">新增复盘</Heading><div className="field-label">复盘类型</div><Selector label="复盘类型" isLabelHidden width="100%" value={selectedTypeId} onChange={setSelectedTypeId} options={types.map(({ id, name }) => ({ value: id, label: name }))} /><div className="field-label collection-field-gap">复盘标题 <span className="field-required">*</span></div><TextInput label="复盘标题" isLabelHidden width="100%" value={title} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addRetro() } }} placeholder="这次遇到了什么问题" hasAutoFocus onChange={(nextValue) => { setTitle(nextValue); setError('') }} /><RichTextField label="复盘内容" value={content} placeholder="记录解决技巧、处理方法和下次可复用的经验…" onChange={(nextValue) => { setContent(nextValue); setError('') }} /><div className="field-label collection-field-gap">附件</div><AttachmentPicker label="添加附件" files={attachmentDraft.files} onRemove={attachmentDraft.remove} onFiles={(files) => attachmentDraft.add(files, editing?.attachments)} isDisabled={attachmentDraft.saving} />{(error || attachmentDraft.error) && <Banner status="error" title={<>{error || attachmentDraft.error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" isDisabled={attachmentDraft.saving} onClick={() => setShowCreateRetro(false)} /><Button label="创建复盘" variant="primary" type="button" isLoading={attachmentDraft.saving} onClick={() => void addRetro()} /></div></div></WorkspaceOverlay>}
    {(editing || detail) && <WorkspaceOverlay label="编辑复盘" onClose={() => { if (!attachmentDraft.saving) { setEditing(null); setDetail(null) } }}><div className="modal modal--wide collection-detail-modal">{editing ? <><Heading level={3} accessibilityLevel={2} className="modal__title">编辑复盘</Heading><div className="field-label">复盘类型</div><Selector label="复盘类型" isLabelHidden width="100%" value={selectedTypeId} onChange={setSelectedTypeId} options={types.map(({ id, name }) => ({ value: id, label: name }))} /><div className="field-label collection-field-gap">复盘标题 <span className="field-required">*</span></div><TextInput label="复盘标题" value={title} isLabelHidden width="100%" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveEdit() } }} onChange={setTitle} /><RichTextField label="复盘内容" value={content} placeholder="记录解决技巧、处理方法和下次可复用的经验…" onChange={setContent} /><div className="field-label collection-field-gap">附件</div><AttachmentPicker label="添加附件" files={attachmentDraft.files} onRemove={attachmentDraft.remove} onFiles={(files) => attachmentDraft.add(files, editing?.attachments)} isDisabled={attachmentDraft.saving} />{(error || attachmentDraft.error) && <Banner status="error" title={<>{error || attachmentDraft.error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" isDisabled={attachmentDraft.saving} onClick={() => setEditing(null)} /><Button label="保存" variant="primary" type="button" isLoading={attachmentDraft.saving} onClick={() => void saveEdit()} /></div></> : detail && <><Heading level={3} accessibilityLevel={2} className="modal__title">{detail.title}</Heading><div className="collection-detail__meta">{types.find((type) => type.id === detail.typeId)?.name} · {new Date(detail.createdAt).toLocaleDateString('zh-CN')}</div><div className="collection-detail__content"><RichTextContent value={detail.content} /></div>{detail.attachments?.length ? <FileAttachmentList files={detail.attachments} onDelete={(attachment) => setDeleteFile({ retro: detail, attachment: attachment as ProjectTaskAttachment })} /> : null}<div className="modal__actions"><Button label="关闭" variant="primary" type="button" onClick={() => setDetail(null)} /></div></>}</div></WorkspaceOverlay>}
    {deleteFile && <ConfirmDataDeletion title={'删除附件「' + deleteFile.attachment.name + '」？'} onClose={() => setDeleteFile(null)} onDelete={() => removeAttachment(deleteFile.retro, deleteFile.attachment)} />}
    {deleteType && <ConfirmDataDeletion title={'删除类型「' + deleteType.name + '」？'} onClose={() => setDeleteType(null)} onDelete={removeType} />}
    {deleteRetro && <ConfirmDataDeletion title={'删除复盘「' + deleteRetro.title + '」？'} onClose={() => setDeleteRetro(null)} onDelete={removeRetro} />}
  </div>
}
