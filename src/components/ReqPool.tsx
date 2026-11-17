import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import Icon from './Icon'
import DatePicker from './DatePicker'
import CompetitorMultiSelect from './CompetitorMultiSelect'
import {
  REQ_STATUSES,
  PRIORITIES,
  type Requirement,
  type RequirementAttachment,
  type Priority,
  type RequirementStatus,
  type Competitor,
  uid,
} from '../lib/store'
import { deleteLocalFile, uploadLocalFile } from '../lib/localFiles'

interface Props {
  spaceId: string
  requirements: Requirement[]
  onAdd: (r: Requirement) => void
  onOpenTrack: (reqId: string) => void
  onDelete: (reqId: string) => void
  activeReqId: string | null
  openSignal: number
  searchQuery?: string
  competitors: Competitor[]
}

interface MiniScrollbarProps {
  viewportRef: RefObject<HTMLDivElement>
  orientation: 'vertical' | 'horizontal'
}

function MiniScrollbar({ viewportRef, orientation }: MiniScrollbarProps) {
  const [metrics, setMetrics] = useState({ viewport: 0, content: 0, scroll: 0 })
  const [dragging, setDragging] = useState(false)

  const refresh = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setMetrics(orientation === 'vertical'
      ? { viewport: el.clientHeight, content: el.scrollHeight, scroll: el.scrollTop }
      : { viewport: el.clientWidth, content: el.scrollWidth, scroll: el.scrollLeft })
  }, [orientation, viewportRef])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    refresh()
    el.addEventListener('scroll', refresh, { passive: true })
    const observer = new ResizeObserver(refresh)
    observer.observe(el)
    const mutationObserver = new MutationObserver(refresh)
    mutationObserver.observe(el, { childList: true, subtree: true })
    return () => {
      el.removeEventListener('scroll', refresh)
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [refresh, viewportRef])

  if (metrics.content <= metrics.viewport + 1) return null

  const trackSize = metrics.viewport
  const thumbSize = Math.min(56, Math.max(18, trackSize * metrics.viewport / metrics.content))
  const maxThumbOffset = Math.max(0, trackSize - thumbSize)
  const maxScroll = Math.max(1, metrics.content - metrics.viewport)
  const thumbOffset = maxThumbOffset * metrics.scroll / maxScroll

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const startPoint = orientation === 'vertical' ? event.clientY : event.clientX
    const startScroll = metrics.scroll
    const ratio = maxScroll / Math.max(1, maxThumbOffset)
    setDragging(true)

    function move(moveEvent: PointerEvent) {
      const point = orientation === 'vertical' ? moveEvent.clientY : moveEvent.clientX
      const el = viewportRef.current
      if (!el) return
      const nextScroll = startScroll + (point - startPoint) * ratio
      if (orientation === 'vertical') el.scrollTop = nextScroll
      else el.scrollLeft = nextScroll
    }

    function stop() {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div className={`mini-scrollbar mini-scrollbar--${orientation}${dragging ? ' is-dragging' : ''}`} aria-hidden="true">
      <div
        className="mini-scrollbar__thumb"
        style={orientation === 'vertical'
          ? { height: `${thumbSize}px`, transform: `translateY(${thumbOffset}px)` }
          : { width: `${thumbSize}px`, transform: `translateX(${thumbOffset}px)` }}
        onPointerDown={startDrag}
      />
    </div>
  )
}

interface StatusGroupProps {
  status: RequirementStatus
  items: Requirement[]
  activeReqId: string | null
  onOpenTrack: (reqId: string) => void
  onRequestDelete: (req: Requirement) => void
  onAddChild: (version: string) => void
}

function versionParts(version: string) {
  const match = version.match(/\d+(?:\.\d+)*/)
  return match ? match[0].split('.').map((part) => Number(part)) : []
}

function compareRequirements(a: Requirement, b: Requirement) {
  const aParts = versionParts(a.version)
  const bParts = versionParts(b.version)
  const length = Math.max(aParts.length, bParts.length)
  for (let index = 0; index < length; index += 1) {
    const aPart = aParts[index] || 0
    const bPart = bParts[index] || 0
    if (aPart !== bPart) return bPart - aPart
  }
  return b.createdAt - a.createdAt
}

function StatusGroup({ status, items, activeReqId, onOpenTrack, onRequestDelete, onAddChild }: StatusGroupProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  return (
    <div className={`status-group status-group--${status === '调研中' ? 'research' : status === '已评审' ? 'reviewed' : status === '开发中' ? 'development' : status === '测试中' ? 'testing' : 'live'}`}>
      <div className="status-group__head">
        <span className="status-group__name">{status}</span>
        <span className="status-group__count">{items.length}</span>
      </div>
      <div className="status-group__body-shell">
        <div className="status-group__body" ref={bodyRef}>
          {items.length === 0 ? (
            <div className="status-group__empty">暂无需求</div>
          ) : items.map((r) => (
            <div className="req-card-wrap" key={r.id}>
              <div
                className={`req-card${activeReqId === r.id ? ' req-card--selected' : ''}`}
                onClick={() => onOpenTrack(r.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenTrack(r.id)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={activeReqId === r.id}
                aria-label={`${r.name}，查看需求追踪`}
              >
                <div className="req-card__top">
                  <span className="req-card__ver">{r.version}</span>
                  <span className={`pri pri--${r.priority.toLowerCase()}`}>{r.priority}</span>
                </div>
                <div className="req-card__name">{r.name}</div>
                {r.content && <div className="req-card__content">{r.content}</div>}
              </div>
              <div className="req-card__bottom-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="req-card__add" onClick={() => onAddChild(r.version)} title={`基于 ${r.version} 新增需求`} aria-label={`基于 ${r.version} 新增需求`}>
                  <Icon name="plus" size={14} />
                </button>
                <button type="button" className="req-card__delete" onClick={() => onRequestDelete(r)} title={`删除 ${r.name}`} aria-label={`删除 ${r.name}`}>
                  <span className="icon-circle"><Icon name="trash" size={13} /></span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <MiniScrollbar viewportRef={bodyRef} orientation="vertical" />
      </div>
    </div>
  )
}

export default function ReqPool({ spaceId, requirements, onAdd, onOpenTrack, onDelete, activeReqId, openSignal, searchQuery = '', competitors }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [version, setVersion] = useState('V')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Priority>('P1')
  const [launchDate, setLaunchDate] = useState('')
  const [competitorIds, setCompetitorIds] = useState<string[]>([])
  const [attachments, setAttachments] = useState<RequirementAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null)
  const [draftId, setDraftId] = useState(() => uid())

  const consumedSignal = useRef(openSignal)

  useEffect(() => {
    if (openSignal !== consumedSignal.current) {
      consumedSignal.current = openSignal
      if (openSignal > 0) {
        openCreate()
      }
    }
  }, [openSignal])

  const query = searchQuery.trim().toLocaleLowerCase()
  const list = requirements
    .filter((r) => r.spaceId === spaceId)
    .filter((r) => !query || [r.name, r.content, r.version, r.priority, r.status].join(' ').toLocaleLowerCase().includes(query))
    .sort(compareRequirements)
  const groupsRef = useRef<HTMLDivElement>(null)

  function nextChildVersion(parentVersion: string) {
    const match = parentVersion.trim().match(/^v?(\d+(?:\.\d+)*)$/i)
    if (!match) return `${parentVersion.trim() || 'V'}.1`
    const base = match[1]
    const prefix = new RegExp(`^v?${base.replace(/\./g, '\\.')}(?:\\.(\\d+))$`, 'i')
    const max = requirements
      .filter((requirement) => requirement.spaceId === spaceId)
      .map((requirement) => requirement.version.match(prefix)?.[1])
      .filter(Boolean)
      .reduce((current, value) => Math.max(current, Number(value)), 0)
    return `V${base}.${max + 1}`
  }

  function openCreate(prefillVersion = 'V') {
    setVersion(prefillVersion)
    setName('')
    setContent('')
    setPriority('P1')
    setDraftId(uid())
    setAttachments([])
    setAttachmentError('')
    setLaunchDate('')
    setCompetitorIds([])
    setShowForm(true)
  }

  function submit() {
    if (!name.trim()) return
    onAdd({
      id: draftId,
      spaceId,
      version: version.trim() || 'V',
      name: name.trim(),
      content: content.trim(),
      priority,
      status: '调研中',
      createdAt: Date.now(),
      launchDate: launchDate || undefined,
      competitorIds: competitorIds.length ? competitorIds : undefined,
      attachments,
    })
    setShowForm(false)
    setVersion('V')
    setName('')
    setContent('')
    setPriority('P1')
    setLaunchDate('')
    setCompetitorIds([])
    setAttachments([])
    setAttachmentError('')
    setDraftId(uid())
  }

  function closeForm() {
    void Promise.all(attachments.map((attachment) => deleteLocalFile(attachment.fileId || attachment.id)))
    setShowForm(false)
    setAttachments([])
    setAttachmentError('')
    setDraftId(uid())
  }

  async function addAttachments(files: FileList | null) {
    if (!files) return
    const incoming = Array.from(files)
    const valid = incoming.filter((file) => file.size > 0 && file.size <= 15 * 1024 * 1024)
    if (valid.length !== incoming.length) setAttachmentError('空文件或超过 15 MB 的文件未添加')
    if (attachments.length + valid.length > 20) return setAttachmentError('需求最多保留 20 个附件')
    if (attachments.reduce((total, item) => total + item.size, 0) + valid.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) return setAttachmentError('需求附件总大小不能超过 50 MB')
    if (valid.length === incoming.length) setAttachmentError('')
    const requirementName = name.trim() || draftId
    const results = await Promise.allSettled(valid.map((file) => uploadLocalFile(file, { spaceId, entityType: 'requirement', entityId: draftId, pathSegments: ['需求', requirementName, '关联文件'] })))
    const next = results.flatMap((result) => result.status === 'fulfilled' ? [{ ...result.value, id: result.value.fileId }] : []) as RequirementAttachment[]
    const failed = results.length - next.length
    if (next.length) setAttachments((prev) => [...prev, ...next])
    if (failed) setAttachmentError(`${failed} 个文件上传失败，请确认已选择本地文件夹并授予写入权限`)
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id)
      void deleteLocalFile(item?.fileId || item?.id)
      return prev.filter((a) => a.id !== id)
    })
  }

  function formatSize(size: number) {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="req-pool-page">
      <div className="req-pool-toolbar"><div className="req-pool-toolbar__title">需求池</div><button type="button" className="btn-primary" onClick={() => openCreate()}><Icon name="plus" size={14} /> 新增需求</button></div>
      <div className="status-groups-shell req-pool-shell">
        <div className="status-groups" ref={groupsRef}>
          {REQ_STATUSES.map((st) => (
            <StatusGroup
              key={st}
              status={st}
              items={list.filter((r) => r.status === st)}
              activeReqId={activeReqId}
              onOpenTrack={onOpenTrack}
              onRequestDelete={setDeleteTarget}
              onAddChild={(parentVersion) => openCreate(nextChildVersion(parentVersion))}
            />
          ))}
        </div>
        <MiniScrollbar viewportRef={groupsRef} orientation="horizontal" />
      </div>

      {showForm && (
        <div className="overlay" onClick={closeForm}>
          <div className="modal modal--wide project-task-create-modal requirement-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="project-task-create-modal__content">
            <div className="modal__title">新增需求</div>

            <div className="form-row requirement-form-meta-row">
              <div className="requirement-form-version">
                <div className="field-label">需求版本</div>
                <input
                  className="text-input"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </div>
              <div className="requirement-form-priority">
                <div className="field-label">优先级</div>
                <div className="chip-row">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`chip${priority === p ? ' chip--on' : ''}`}
                      onClick={() => setPriority(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="field-label collection-field-gap">需求名称</div>
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="一句话说清要做什么"
              autoFocus
            />

            <div className="field-label" style={{ marginTop: 16 }}>
              需求内容
            </div>
            <textarea
              className="text-area"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="背景、目标、验收标准…"
            />

            <div className="requirement-create-inline-fields">
              <div><div className="field-label" style={{ marginTop: 16 }}>预计上线时间</div><DatePicker value={launchDate.slice(0, 10)} onChange={setLaunchDate} label="预计上线日期" /></div>
              <div><div className="field-label" style={{ marginTop: 16 }}>关联竞品</div><CompetitorMultiSelect options={competitors.filter((competitor) => competitor.spaceId === spaceId)} value={competitorIds} onChange={setCompetitorIds} /></div>
            </div>

            <div className="attachment-field">
              <div className="field-label">关联资料</div>
              <label className="attachment-picker">
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    addAttachments(e.target.files)
                    e.currentTarget.value = ''
                  }}
                />
                <span className="attachment-picker__icon">+</span>
                <span>
                  <strong>添加关联资料</strong>
                  <small>支持同时选择多个关联资料，当前仅本地预览</small>
                </span>
              </label>
              {attachments.length > 0 && (
                <div className="attachment-list">
                  {attachments.map((attachment) => (
                    <div className="attachment-item" key={attachment.id}>
                      {attachment.kind === 'image' ? (
                        <img className="attachment-item__thumb" src={attachment.url} alt={attachment.name} />
                      ) : (
                        <div className="attachment-item__file-icon">文件</div>
                      )}
                      <div className="attachment-item__meta">
                        <span>{attachment.name}</span>
                        <small>{formatSize(attachment.size)}</small>
                      </div>
                      <button
                        type="button"
                        className="attachment-item__remove"
                        onClick={() => removeAttachment(attachment.id)}
                        aria-label={`删除附件 ${attachment.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {attachmentError && <div className="form-error" role="alert">{attachmentError}</div>}
            </div>

            </div>
            <div className="modal__actions">
              <button className="btn-ghost" onClick={closeForm}>
                取消
              </button>
              <button
                className="btn-primary"
                onClick={submit}
                style={{ opacity: name.trim() ? 1 : 0.45 }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__title">确认删除需求？</div>
            <div className="delete-confirm-modal__text">删除「{deleteTarget.name}」后，对应的需求追踪、PRD 和复盘记录也会一并移除。</div>
            <div className="modal__actions">
              <button className="btn-ghost" type="button" onClick={() => setDeleteTarget(null)}>取消</button>
              <button className="btn-primary btn-primary--danger" type="button" onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null) }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
