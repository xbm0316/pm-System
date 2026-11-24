import { Heading } from '@astryxdesign/core/Text'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Button } from '@astryxdesign/core/Button'
import { useState } from 'react'
import Icon from './Icon'
import {
  REQ_STATUSES,
  type Requirement,
  type RequirementStatus,
  type RequirementAttachment,
  type Competitor,
} from '../lib/store'
import { deleteLocalFile } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'
import PriorityBadge from './PriorityBadge'
import { Stepper, Step } from '@astryxdesign/core/Stepper'
import { RichTextContent } from './RichTextField'

interface Props {
  spaceId: string
  requirements: Requirement[]
  onStatusChange: (reqId: string, status: RequirementStatus) => void
  focusId: string | null
  searchQuery?: string
  competitors: Competitor[]
  onUpdateAttachments: (reqId: string, attachments: RequirementAttachment[]) => void
}

export default function ReqTrack({ spaceId, requirements, onStatusChange, focusId, searchQuery = '', competitors, onUpdateAttachments }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteAttachment, setDeleteAttachment] = useState<RequirementAttachment | null>(null)

  const query = searchQuery.trim().toLocaleLowerCase()
  const spaceList = requirements.filter((r) => r.spaceId === spaceId)
  const list = spaceList
    .filter((r) => !query || [r.name, r.content, r.version, r.priority, r.status].join(' ').toLocaleLowerCase().includes(query))
    .sort((a, b) => b.createdAt - a.createdAt)
  const detail = spaceList.find((r) => r.id === (detailId || focusId))
  const current = detail || (focusId ? spaceList.find((r) => r.id === focusId) : null)

  if (detail || (focusId && current)) {
    const r = detail || current!
    const idx = REQ_STATUSES.indexOf(r.status)
    const relatedCompetitors = r.competitorIds && r.competitorIds.length > 0
      ? competitors.filter((competitor) => r.competitorIds?.includes(competitor.id))
      : []
    return (
      <>
        <div className="track-detail">
        <div className="progress astryx-req-stepper">
          <Stepper activeStep={idx} label="需求状态" onStepClick={(step) => onStatusChange(r.id, REQ_STATUSES[step])} indicatorPosition="on-track" horizontalOptions={{ minimumStepWidth: 104, collapsedVariant: 'withLabel' }}>
            {REQ_STATUSES.map((status, step) => <Step key={status} step={step} label={status} />)}
          </Stepper>
        </div>

        <div className="track-detail__content">
          <div className="track-detail__launch-inline"><span className="field-label">预计上线时间</span><strong>{r.launchDate ? r.launchDate.slice(0, 10) : '未设置'}</strong></div>
          <div className="field-label">需求内容</div>
          {r.content ? <RichTextContent value={r.content} className="track-detail__text" /> : <div className="track-detail__text">暂无需求内容</div>}
        </div>

        <div className="track-detail__related">
          <div className="field-label">关联竞品</div>
          {relatedCompetitors.length > 0 ? (
            <div className="track-related-list">
              {relatedCompetitors.map((competitor) => (
                <a className="track-related-item" href={competitor.url || undefined} target={competitor.url ? '_blank' : undefined} rel="noreferrer" key={competitor.id}>
                  <span>{competitor.name}</span>
                  {competitor.url && <small>{competitor.url}</small>}
                </a>
              ))}
            </div>
          ) : (
            <div className="track-detail__empty">暂无关联竞品</div>
          )}
        </div>
        <div className="track-detail__related">
          <div className="field-label">关联资料</div>
          {r.attachments && r.attachments.length > 0 ? (
            <FileAttachmentList files={r.attachments} onDelete={(attachment) => setDeleteAttachment(attachment as RequirementAttachment)} />
          ) : (
            <div className="track-detail__empty">暂无关联资料</div>
          )}
        </div>
        </div>
        {deleteAttachment && <WorkspaceOverlay label="确认删除附件？" onClose={() => setDeleteAttachment(null)}><div className="modal delete-confirm-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">确认删除附件？</Heading><div className="delete-confirm-modal__text">删除「{deleteAttachment.name}」后无法恢复。</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setDeleteAttachment(null)} /><Button label="确认删除" variant="destructive" type="button" onClick={() => { void deleteLocalFile(deleteAttachment.fileId || deleteAttachment.id); onUpdateAttachments(r.id, (r.attachments || []).filter((item) => item.id !== deleteAttachment.id)); setDeleteAttachment(null) }} /></div></div></WorkspaceOverlay>}
      </>
    )
  }

  return (
    <>
      {list.length === 0 ? (
        <div className="empty" style={{ padding: '36px 12px' }}>
          <div style={{ fontSize: 12.5 }}>{query ? '没有匹配结果' : '暂无追踪单'}</div>
          {!query && <div className="empty__hint">在需求池新建需求后自动生成</div>}
        </div>
      ) : (
        <div className="comp-grid">
          {list.map((r) => (
            <button key={r.id} className="track-card" onClick={() => setDetailId(r.id)}>
              <div className="track-card__top">
                <span className="track-card__ver">{r.version}</span>
                <PriorityBadge priority={r.priority} />
              </div>
              <div className="track-card__name">{r.name}</div>
              <div className="track-card__status">
                <span className="track-card__dot" />
                {r.status}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
