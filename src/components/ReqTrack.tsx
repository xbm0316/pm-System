import { useEffect, useState } from 'react'
import Icon from './Icon'
import DatePicker from './DatePicker'
import {
  REQ_STATUSES,
  type Requirement,
  type RequirementStatus,
  type RequirementAttachment,
  type Competitor,
  type MeetingRecord,
  uid,
} from '../lib/store'
import { deleteLocalFile } from '../lib/localFiles'

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
  onUpdateMeetings: (reqId: string, meetings: MeetingRecord[]) => void
  onUpdateAttachments: (reqId: string, attachments: RequirementAttachment[]) => void
}

export default function ReqTrack({ spaceId, requirements, onStatusChange, focusId, searchQuery = '', competitors, onUpdateMeetings, onUpdateAttachments }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<RequirementAttachment | null>(null)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingContent, setMeetingContent] = useState('')
  const [deleteAttachment, setDeleteAttachment] = useState<RequirementAttachment | null>(null)

  useEffect(() => {
    if (!previewAttachment) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreviewAttachment(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewAttachment])

  const query = searchQuery.trim().toLocaleLowerCase()
  const spaceList = requirements.filter((r) => r.spaceId === spaceId)
  const list = spaceList
    .filter((r) => !query || [r.name, r.content, r.version, r.priority, r.status].join(' ').toLocaleLowerCase().includes(query))
    .sort((a, b) => b.createdAt - a.createdAt)
  const detail = spaceList.find((r) => r.id === (detailId || focusId))
  const current = detail || (focusId ? spaceList.find((r) => r.id === focusId) : null)

  function addMeeting(r: Requirement) {
    if (!meetingTitle.trim() && !meetingContent.trim()) return
    const meeting: MeetingRecord = { id: uid(), title: meetingTitle.trim() || '会议记录', date: meetingDate, content: meetingContent.trim() }
    onUpdateMeetings(r.id, [...(r.meetings || []), meeting])
    setMeetingTitle('')
    setMeetingDate('')
    setMeetingContent('')
    setShowMeetingForm(false)
  }

  if (detail || (focusId && current)) {
    const r = detail || current!
    const idx = REQ_STATUSES.indexOf(r.status)
    const relatedCompetitors = r.competitorIds && r.competitorIds.length > 0
      ? competitors.filter((competitor) => r.competitorIds?.includes(competitor.id))
      : competitors.filter((competitor) => competitor.spaceId === spaceId)
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

        {r.content && (
          <div className="track-detail__content">
            <div className="field-label">需求内容</div>
            <div className="track-detail__text">{r.content}</div>
          </div>
        )}

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
            <div className="track-attachment-list">
              {r.attachments.map((attachment) => (
                <div className="track-attachment-wrap" key={`related-${attachment.id}`}>
                <button className="track-attachment" type="button" onClick={() => setPreviewAttachment(attachment)}>
                  {attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name} /> : <span className="track-attachment__file">文件</span>}
                  <span>{attachment.name}</span>
                </button>
                <button type="button" className="track-attachment__remove" onClick={() => setDeleteAttachment(attachment)} title={`删除附件 ${attachment.name}`} aria-label={`删除附件 ${attachment.name}`}><Icon name="trash" size={13} /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="track-detail__empty">暂无关联资料</div>
          )}
        </div>
        <div className="track-detail__meeting">
          <div className="track-detail__meeting-head"><div className="field-label">会议记录</div><button type="button" className="icon-btn" onClick={() => setShowMeetingForm((value) => !value)} title="新增会议记录" aria-label="新增会议记录"><Icon name="plus" size={14} /></button></div>
          {showMeetingForm && <div className="track-meeting-form"><input className="text-input" value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="会议主题" /><DatePicker value={meetingDate} onChange={setMeetingDate} label="会议日期" /><textarea className="text-area" rows={3} value={meetingContent} onChange={(event) => setMeetingContent(event.target.value)} placeholder="记录会议结论、决策和待办…" /><div className="track-meeting-form__actions"><button type="button" className="btn-ghost" onClick={() => setShowMeetingForm(false)}>取消</button><button type="button" className="btn-primary" onClick={() => addMeeting(r)} style={{ opacity: meetingTitle.trim() || meetingContent.trim() ? 1 : .45 }}>保存记录</button></div></div>}
          {(r.meetings || []).length > 0 ? <div className="track-meeting-list">{(r.meetings || []).map((meeting) => <article className="track-meeting" key={meeting.id}><div className="track-meeting__top"><strong>{meeting.title}</strong>{meeting.date && <time>{meeting.date}</time>}</div><div>{meeting.content || '暂无会议内容'}</div></article>)}</div> : !showMeetingForm && <div className="track-detail__empty">暂无会议记录</div>}
        </div>
        </div>
        {previewAttachment && (
        <div className="overlay" onClick={() => setPreviewAttachment(null)}>
          <div className="modal attachment-preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">{previewAttachment.name}</div>
            {previewAttachment.kind === 'image' ? (
              <img className="attachment-preview__image" src={previewAttachment.url} alt={previewAttachment.name} />
            ) : (
              <div className="attachment-preview__file">
                <span className="attachment-preview__file-icon">文件</span>
                <span>{previewAttachment.type || '未知文件类型'}</span>
                <span>{previewAttachment.size ? `${Math.ceil(previewAttachment.size / 1024)} KB` : '大小未知'}</span>
              </div>
            )}
            <div className="modal__actions">
              <a className="btn-ghost attachment-preview__download" href={previewAttachment.url} download={previewAttachment.name}>下载附件</a>
              <button className="btn-ghost btn-ghost--danger" onClick={() => { setDeleteAttachment(previewAttachment); setPreviewAttachment(null) }}><Icon name="trash" size={13} /> 删除</button>
              <button className="btn-primary" onClick={() => setPreviewAttachment(null)}>关闭</button>
            </div>
          </div>
        </div>
        )}
        {deleteAttachment && <div className="overlay" onClick={() => setDeleteAttachment(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除附件？</div><div className="delete-confirm-modal__text">删除「{deleteAttachment.name}」后无法恢复。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteAttachment(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={() => { void deleteLocalFile(deleteAttachment.fileId || deleteAttachment.id); onUpdateAttachments(r.id, (r.attachments || []).filter((item) => item.id !== deleteAttachment.id)); setDeleteAttachment(null) }}>确认删除</button></div></div></div>}
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
