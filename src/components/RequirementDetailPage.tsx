import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import ReqTrack from './ReqTrack'
import type { Competitor, Requirement, RequirementAttachment, RequirementStatus } from '../lib/store'
import DatePicker from './DatePicker'
import { deleteLocalFile, uploadLocalFile } from '../lib/localFiles'
import CompetitorMultiSelect from './CompetitorMultiSelect'

type RequirementDraft = Pick<Requirement, 'version' | 'name' | 'content' | 'priority' | 'status' | 'competitorIds'> & { launchDate: string }

interface Props {
  requirement: Requirement
  requirements: Requirement[]
  competitors: Competitor[]
  onStatusChange: (reqId: string, status: RequirementStatus) => void
  onUpdateAttachments: (reqId: string, attachments: RequirementAttachment[]) => void
  onUpdateRequirement: (reqId: string, patch: Partial<Requirement>) => void
  onClose: () => void
}

export default function RequirementDetailPage({ requirement, requirements, competitors, onStatusChange, onUpdateAttachments, onUpdateRequirement, onClose }: Props) {
  const [editingRequirement, setEditingRequirement] = useState(false)
  const [draft, setDraft] = useState<RequirementDraft>({ version: requirement.version, name: requirement.name, content: requirement.content, priority: requirement.priority, status: requirement.status, launchDate: requirement.launchDate || '', competitorIds: requirement.competitorIds || [] })
  const [draftAttachments, setDraftAttachments] = useState<RequirementAttachment[]>(requirement.attachments || [])
  const [newAttachmentIds, setNewAttachmentIds] = useState<string[]>([])
  const [editAttachmentError, setEditAttachmentError] = useState('')
  const bodyRef = useRef<HTMLElement>(null)
  useEffect(() => {
    setDraft({ version: requirement.version, name: requirement.name, content: requirement.content, priority: requirement.priority, status: requirement.status, launchDate: requirement.launchDate || '', competitorIds: requirement.competitorIds || [] })
    setDraftAttachments(requirement.attachments || [])
    setNewAttachmentIds([])
  }, [requirement])

  function updateDraft(patch: Partial<RequirementDraft>) {
    setDraft((value) => ({ ...value, ...patch }))
  }

  function openRequirementEditor() {
    setDraft({ version: requirement.version, name: requirement.name, content: requirement.content, priority: requirement.priority, status: requirement.status, launchDate: requirement.launchDate || '', competitorIds: requirement.competitorIds || [] })
    setDraftAttachments(requirement.attachments || [])
    setNewAttachmentIds([])
    setEditAttachmentError('')
    setEditingRequirement(true)
  }

  function closeRequirementEditor() {
    void Promise.all(newAttachmentIds.map((id) => deleteLocalFile(id)))
    setNewAttachmentIds([])
    setEditAttachmentError('')
    setEditingRequirement(false)
  }

  async function addEditAttachments(files: FileList | null) {
    if (!files) return
    const incoming = Array.from(files)
    const valid = incoming.filter((file) => file.size > 0 && file.size <= 15 * 1024 * 1024)
    if (valid.length !== incoming.length) setEditAttachmentError('空文件或超过 15 MB 的文件未添加')
    if (draftAttachments.length + valid.length > 20) return setEditAttachmentError('需求最多保留 20 个附件')
    const results = await Promise.allSettled(valid.map((file) => uploadLocalFile(file, { spaceId: requirement.spaceId, entityType: 'requirement', entityId: requirement.id, pathSegments: ['需求', draft.name.trim() || requirement.name, '关联资料'] })))
    const next = results.flatMap((result) => result.status === 'fulfilled' ? [{ ...result.value, id: result.value.fileId }] : []) as RequirementAttachment[]
    if (next.length) {
      setDraftAttachments((current) => [...current, ...next])
      setNewAttachmentIds((current) => [...current, ...next.map((item) => item.fileId || item.id)])
      setEditAttachmentError('')
    }
    if (results.length !== next.length) setEditAttachmentError('部分文件上传失败，请重试')
  }

  function removeEditAttachment(attachment: RequirementAttachment) {
    const fileId = attachment.fileId || attachment.id
    if (newAttachmentIds.includes(fileId)) {
      void deleteLocalFile(fileId)
      setNewAttachmentIds((current) => current.filter((id) => id !== fileId))
    }
    setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id))
  }

  function saveRequirementEdit() {
    if (!draft.name.trim()) return
    const competitorIds = draft.competitorIds || []
    const keptIds = new Set(draftAttachments.map((attachment) => attachment.id))
    void Promise.all((requirement.attachments || []).filter((attachment) => !keptIds.has(attachment.id)).map((attachment) => deleteLocalFile(attachment.fileId || attachment.id)))
    onUpdateRequirement(requirement.id, { version: draft.version.trim() || 'V', name: draft.name.trim(), content: draft.content.trim(), priority: draft.priority, status: draft.status, launchDate: draft.launchDate || undefined, competitorIds })
    onUpdateAttachments(requirement.id, draftAttachments)
    setNewAttachmentIds([])
    setEditingRequirement(false)
  }

  return (
    <div className="requirement-detail-page">
      <header className="requirement-detail-page__head">
        <div className="requirement-detail-page__head-main">
          <button className="icon-btn requirement-detail-page__back" type="button" onClick={onClose} title="返回需求池" aria-label="返回需求池">
            <Icon name="arrowLeft" size={16} />
          </button>
        <div className="requirement-detail-page__identity">
            <div className="requirement-detail-page__eyebrow">需求详情</div>
            <div className="requirement-detail-page__meta-row"><span className="requirement-detail-page__version">{requirement.version}</span><span className={`pri pri--${requirement.priority.toLowerCase()}`}>{requirement.priority}</span></div>
            <h1><span className="requirement-detail-page__name">{requirement.name}</span></h1>
          </div>
        </div>
        <button type="button" className="icon-btn requirement-detail-page__edit-button" onClick={openRequirementEditor} title="编辑需求" aria-label="编辑需求"><Icon name="edit" size={15} /></button>
      </header>

      <main className="requirement-detail-page__body" ref={bodyRef}>
        <ReqTrack
          spaceId={requirement.spaceId}
          requirements={requirements}
          competitors={competitors}
          onStatusChange={onStatusChange}
          focusId={requirement.id}
          onUpdateAttachments={onUpdateAttachments}
        />
      </main>
      {editingRequirement && <div className="overlay requirement-edit-overlay" onClick={closeRequirementEditor}><form className="modal modal--wide project-task-create-modal requirement-edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveRequirementEdit() }}><div className="project-task-create-modal__content"><div className="modal__title">编辑需求</div><div className="form-row requirement-form-meta-row"><div className="requirement-form-version"><div className="field-label">需求版本</div><input className="text-input" value={draft.version} onChange={(event) => updateDraft({ version: event.target.value })} /></div><div className="requirement-form-priority"><div className="field-label">优先级</div><div className="chip-row">{(['P0', 'P1', 'P2', 'P3'] as const).map((priority) => <button type="button" className={`chip${draft.priority === priority ? ' chip--on' : ''}`} key={priority} onClick={() => updateDraft({ priority })}>{priority}</button>)}</div></div></div><div className="field-label collection-field-gap">需求名称 <span className="field-required">*</span></div><input className="text-input" value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} autoFocus required /><div className="field-label collection-field-gap">需求内容</div><textarea className="text-area" rows={5} value={draft.content} onChange={(event) => updateDraft({ content: event.target.value })} /><div className="requirement-edit-inline-fields"><div><div className="field-label">预计上线时间</div><DatePicker value={draft.launchDate.slice(0, 10)} onChange={(value) => updateDraft({ launchDate: value })} label="预计上线日期" /></div><div><div className="field-label">关联竞品</div><CompetitorMultiSelect options={competitors.filter((competitor) => competitor.spaceId === requirement.spaceId)} value={draft.competitorIds || []} onChange={(value) => updateDraft({ competitorIds: value })} /></div></div><div className="field-label collection-field-gap">关联资料</div><label className="attachment-picker"><input type="file" multiple onChange={(event) => { void addEditAttachments(event.target.files); event.currentTarget.value = '' }} /><span className="attachment-picker__icon">+</span><span><strong>添加关联资料</strong><small>支持同时选择多个关联资料</small></span></label>{draftAttachments.length > 0 && <div className="attachment-list">{draftAttachments.map((attachment) => <div className="attachment-item" key={attachment.id}>{attachment.kind === 'image' ? <img className="attachment-item__thumb" src={attachment.url} alt={attachment.name} /> : <div className="attachment-item__file-icon">文件</div>}<div className="attachment-item__meta"><span>{attachment.name}</span><small>{Math.ceil(attachment.size / 1024)} KB</small></div><button type="button" className="attachment-item__remove" onClick={() => removeEditAttachment(attachment)} aria-label={`删除关联资料 ${attachment.name}`}>×</button></div>)}</div>}{editAttachmentError && <div className="form-error">{editAttachmentError}</div>}</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={closeRequirementEditor}>取消</button><button type="submit" className="btn-primary" disabled={!draft.name.trim()}>保存</button></div></form></div>}
    </div>
  )
}
