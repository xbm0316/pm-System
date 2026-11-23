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

function statusKey(status: RequirementStatus) {
  return status === '调研中' ? 'research' : status === '已评审' ? 'reviewed' : status === '开发中' ? 'development' : status === '测试中' ? 'testing' : 'live'
}

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
        <div className="progress">
          <div className="progress__track">
            {REQ_STATUSES.slice(0, -1).map((_, i) => (
              <div
                key={`connector-${i}`}
                className={`progress__connector progress__connector--${statusKey(REQ_STATUSES[i])}${i < idx ? ' progress__connector--done' : ''}`}
                style={{ left: `${i * 25}%`, width: '25%' }}
              />
            ))}
            {REQ_STATUSES.map((st, i) => {
              const done = i <= idx
              return (
                <div
                  key={st}
                  className={`progress__node progress__node--${statusKey(st)}${i === 0 ? ' progress__node--first' : ''}${i === REQ_STATUSES.length - 1 ? ' progress__node--last' : ''}`}
                  style={{ left: `${(i / (REQ_STATUSES.length - 1)) * 100}%` }}
                >
                  <div className="progress__dot-wrap">
                    <div className={`progress__dot${done ? ' progress__dot--done' : ''}${i === idx ? ' progress__dot--current' : ''}`} />
                  </div>
                  <div className="progress__label-row">
                    <span className={`progress__label${done ? ' progress__label--done' : ''}${i === idx ? ' progress__label--current' : ''}`}>
                      {st}
                    </span>
                    <button
                      className={`progress__check${i === idx ? ' progress__check--done' : ''}`}
                      onClick={() => onStatusChange(r.id, st)}
                      title={`标记为${st}`}
                    >
                      <Icon name="check" size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="track-detail__content">
          <div className="track-detail__launch-inline"><span className="field-label">预计上线时间</span><strong>{r.launchDate ? r.launchDate.slice(0, 10) : '未设置'}</strong></div>
          <div className="field-label">需求内容</div>
          <div className="track-detail__text">{r.content || '暂无需求内容'}</div>
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
                <span className={`pri pri--${r.priority.toLowerCase()}`}>{r.priority}</span>
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
