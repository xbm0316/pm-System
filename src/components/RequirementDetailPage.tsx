import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import AttachmentPicker from './AttachmentPicker'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Button } from '@astryxdesign/core/Button'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import PriorityBadge from './PriorityBadge'
import ReqTrack from './ReqTrack'
import type { Competitor, Requirement, RequirementAttachment, RequirementStatus } from '../lib/store'
import DatePicker from './DatePicker'
import { deleteLocalFile, uploadLocalFile } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'
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

  async function addEditAttachments(files: File[]) {
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
          <IconButton label="返回需求池" variant="ghost" size="sm" icon={<Icon name="arrowLeft" size={16} />} type="button" onClick={onClose} className="requirement-detail-page__back" />
        <div className="requirement-detail-page__identity">
            <div className="requirement-detail-page__eyebrow">需求详情</div>
            <div className="requirement-detail-page__meta-row"><span className="requirement-detail-page__version">{requirement.version}</span><PriorityBadge priority={requirement.priority} /></div>
            <h1><span className="requirement-detail-page__name">{requirement.name}</span></h1>
          </div>
        </div>
        <IconButton label="编辑需求" variant="ghost" size="sm" icon={<Icon name="edit" size={15} />} type="button" onClick={openRequirementEditor} className="requirement-detail-page__edit-button" />
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
      {editingRequirement && <WorkspaceOverlay label="编辑需求" onClose={closeRequirementEditor}><form className="modal modal--wide project-task-create-modal requirement-edit-modal" onSubmit={(event) => { event.preventDefault(); saveRequirementEdit() }}><div className="project-task-create-modal__content"><Heading level={3} accessibilityLevel={2} className="modal__title">编辑需求</Heading><div className="form-row requirement-form-meta-row"><div className="requirement-form-version"><div className="field-label">需求版本</div><TextInput label="需求版本" isLabelHidden width="100%" value={draft.version} onChange={(nextValue) => updateDraft({ version: nextValue })} /></div><div className="requirement-form-priority"><div className="field-label">优先级</div><SegmentedControl label="优先级" size="sm" value={draft.priority} onChange={(priority) => updateDraft({ priority: priority as Requirement['priority'] })}>
                      {['P0', 'P1', 'P2', 'P3'].map((priority) => <SegmentedControlItem key={priority} value={priority} label={priority} />)}
                    </SegmentedControl></div></div><div className="field-label collection-field-gap">需求名称 <span className="field-required">*</span></div><TextInput label="需求名称" value={draft.name} isLabelHidden width="100%" isRequired hasAutoFocus onChange={(nextValue) => updateDraft({ name: nextValue })} /><div className="field-label collection-field-gap">需求内容</div><TextArea label="需求内容" isLabelHidden width="100%" rows={5} value={draft.content} onChange={(nextValue) => updateDraft({ content: nextValue })} /><div className="requirement-edit-inline-fields"><div><div className="field-label">预计上线时间</div><DatePicker value={draft.launchDate.slice(0, 10)} onChange={(value) => updateDraft({ launchDate: value })} label="预计上线日期" /></div><div><div className="field-label">关联竞品</div><CompetitorMultiSelect options={competitors.filter((competitor) => competitor.spaceId === requirement.spaceId)} value={draft.competitorIds || []} onChange={(value) => updateDraft({ competitorIds: value })} /></div></div><div className="field-label collection-field-gap">关联资料</div><AttachmentPicker label="添加关联资料" onFiles={(files) => void addEditAttachments(files)} />{draftAttachments.length > 0 && <FileAttachmentList files={draftAttachments} onDelete={(attachment) => removeEditAttachment(attachment as RequirementAttachment)} />}{editAttachmentError && <Banner status="error" title={<>{editAttachmentError}</>} />}</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={closeRequirementEditor} /><Button label="保存" variant="primary" type="submit" isDisabled={!draft.name.trim()} /></div></form></WorkspaceOverlay>}
    </div>
  )
}
