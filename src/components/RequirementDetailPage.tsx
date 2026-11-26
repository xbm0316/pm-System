import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { useAttachmentDraft } from '../lib/useAttachmentDraft'
import AttachmentPicker from './AttachmentPicker'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Button } from '@astryxdesign/core/Button'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import PriorityBadge from './PriorityBadge'
import ReqTrack from './ReqTrack'
import type { Competitor, Requirement, RequirementAttachment, RequirementStatus } from '../lib/store'
import DatePicker from './DatePicker'
import { deleteLocalFile } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'
import CompetitorMultiSelect from './CompetitorMultiSelect'
import RichTextField from './RichTextField'

type RequirementDraft = Pick<Requirement, 'version' | 'name' | 'content' | 'priority' | 'status' | 'competitorIds'> & { launchDate: string }

interface Props {
  requirement: Requirement
  requirements: Requirement[]
  competitors: Competitor[]
  onStatusChange: (reqId: string, status: RequirementStatus) => void
  onUpdateAttachments: (reqId: string, attachments: RequirementAttachment[]) => void
  onUpdateRequirement: (reqId: string, patch: Partial<Requirement>) => Promise<void>
  onClose: () => void
}

export default function RequirementDetailPage({ requirement, requirements, competitors, onStatusChange, onUpdateAttachments, onUpdateRequirement, onClose }: Props) {
  const [editingRequirement, setEditingRequirement] = useState(false)
  const [draft, setDraft] = useState<RequirementDraft>({ version: requirement.version, name: requirement.name, content: requirement.content, priority: requirement.priority, status: requirement.status, launchDate: requirement.launchDate || '', competitorIds: requirement.competitorIds || [] })
  const [draftAttachments, setDraftAttachments] = useState<RequirementAttachment[]>(requirement.attachments || [])
  const attachmentDraft = useAttachmentDraft({ maxSize: 15 })
  const bodyRef = useRef<HTMLElement>(null)
  useEffect(() => {
    setDraft({ version: requirement.version, name: requirement.name, content: requirement.content, priority: requirement.priority, status: requirement.status, launchDate: requirement.launchDate || '', competitorIds: requirement.competitorIds || [] })
    setDraftAttachments(requirement.attachments || [])
  }, [requirement.id])

  function updateDraft(patch: Partial<RequirementDraft>) {
    setDraft((value) => ({ ...value, ...patch }))
  }

  function openRequirementEditor() {
    setDraft({ version: requirement.version, name: requirement.name, content: requirement.content, priority: requirement.priority, status: requirement.status, launchDate: requirement.launchDate || '', competitorIds: requirement.competitorIds || [] })
    setDraftAttachments(requirement.attachments || [])
    attachmentDraft.reset()
    setEditingRequirement(true)
  }

  function closeRequirementEditor() {
    if (attachmentDraft.saving) return
    attachmentDraft.reset()
    setEditingRequirement(false)
  }

  function removeEditAttachment(attachment: RequirementAttachment) {
    setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id))
  }

  async function saveRequirementEdit() {
    const name = draft.name.trim()
    if (!name) return
    const saved = await attachmentDraft.save({
      spaceId: requirement.spaceId, entityType: 'requirement', entityId: requirement.id,
      pathSegments: ['需求', name, '关联资料'],
    }, async (added) => {
      await onUpdateRequirement(requirement.id, {
        version: draft.version.trim() || 'V', name, content: draft.content.trim(), priority: draft.priority,
        status: draft.status, launchDate: draft.launchDate || undefined, competitorIds: draft.competitorIds || [],
      })
      onUpdateAttachments(requirement.id, [...draftAttachments, ...added])
    })
    if (!saved) return
    const keptIds = new Set(draftAttachments.map((attachment) => attachment.id))
    void Promise.allSettled((requirement.attachments || []).filter((attachment) => !keptIds.has(attachment.id)).map((attachment) => deleteLocalFile(attachment.fileId || attachment.id)))
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
      {editingRequirement && <WorkspaceOverlay label="编辑需求" onClose={closeRequirementEditor}><form className="modal modal--wide project-task-create-modal requirement-edit-modal" onSubmit={(event) => { event.preventDefault(); void saveRequirementEdit() }}><div className="project-task-create-modal__content"><Heading level={3} accessibilityLevel={2} className="modal__title">编辑需求</Heading><div className="form-row requirement-form-meta-row"><div className="requirement-form-version"><div className="field-label">需求版本</div><TextInput label="需求版本" isLabelHidden width="100%" value={draft.version} onChange={(nextValue) => updateDraft({ version: nextValue })} /></div><div className="requirement-form-priority"><div className="field-label">优先级</div><SegmentedControl label="优先级" size="sm" value={draft.priority} onChange={(priority) => updateDraft({ priority: priority as Requirement['priority'] })}>
                      {['P0', 'P1', 'P2', 'P3'].map((priority) => <SegmentedControlItem key={priority} value={priority} label={priority} />)}
                    </SegmentedControl></div></div><div className="field-label collection-field-gap">需求名称 <span className="field-required">*</span></div><TextInput label="需求名称" value={draft.name} isLabelHidden width="100%" isRequired hasAutoFocus onChange={(nextValue) => updateDraft({ name: nextValue })} /><RichTextField label="需求内容" value={draft.content} placeholder="背景、目标、验收标准…" minHeight={180} onChange={(nextValue) => updateDraft({ content: nextValue })} /><div className="requirement-edit-inline-fields"><div><div className="field-label">预计上线时间</div><DatePicker value={draft.launchDate.slice(0, 10)} onChange={(value) => updateDraft({ launchDate: value })} label="预计上线日期" /></div><div><div className="field-label">关联竞品</div><CompetitorMultiSelect options={competitors.filter((competitor) => competitor.spaceId === requirement.spaceId)} value={draft.competitorIds || []} onChange={(value) => updateDraft({ competitorIds: value })} /></div></div><div className="field-label collection-field-gap">关联资料</div><AttachmentPicker label="添加关联资料" files={attachmentDraft.files} onRemove={attachmentDraft.remove} isDisabled={attachmentDraft.saving} onFiles={(files) => attachmentDraft.add(files, draftAttachments)} />{draftAttachments.length > 0 && <FileAttachmentList files={draftAttachments} onDelete={attachmentDraft.saving ? undefined : (attachment) => removeEditAttachment(attachment as RequirementAttachment)} />}{attachmentDraft.error && <Banner status="error" title={<>{attachmentDraft.error}</>} />}</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" isDisabled={attachmentDraft.saving} onClick={closeRequirementEditor} /><Button label="保存" variant="primary" type="submit" isLoading={attachmentDraft.saving} isDisabled={!draft.name.trim()} /></div></form></WorkspaceOverlay>}
    </div>
  )
}
