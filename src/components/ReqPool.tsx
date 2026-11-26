import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { useAttachmentDraft } from '../lib/useAttachmentDraft'
import ConfirmDataDeletion from './ConfirmDataDeletion'
import AttachmentPicker from './AttachmentPicker'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import BoardLaneHeading from './BoardLaneHeading'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import Icon from './Icon'
import RichTextField from './RichTextField'
import { richTextPlainText } from '../lib/richText'
import PriorityBadge from './PriorityBadge'
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

interface Props {
  spaceId: string
  requirements: Requirement[]
  onAdd: (r: Requirement) => Promise<void>
  onOpenTrack: (reqId: string) => void
  onDelete: (reqId: string) => Promise<void>
  activeReqId: string | null
  openSignal: number
  searchQuery?: string
  competitors: Competitor[]
}

interface MiniScrollbarProps {
  viewportRef: RefObject<HTMLDivElement | null>
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
    <Card padding={0} variant="muted" className={`status-group status-group--${status === '调研中' ? 'research' : status === '已评审' ? 'reviewed' : status === '开发中' ? 'development' : status === '测试中' ? 'testing' : 'live'}`}>
      <Layout height="fill" header={<LayoutHeader hasDivider padding={3}><BoardLaneHeading name={status} count={items.length} variant={status === '调研中' ? 'neutral' : status === '测试中' ? 'warning' : status === '已上线' ? 'success' : 'accent'} /></LayoutHeader>} content={<LayoutContent padding={2}>
        <div className="status-group__body-shell">
        <div className="status-group__body" ref={bodyRef}>
          {items.length === 0 ? (
            <EmptyState isCompact title="暂无需求" />
          ) : items.map((r) => (
            <div className="req-card-wrap" key={r.id}>
              <ClickableCard label={`${r.name}，查看需求追踪`} padding={0}
                className={`req-card${activeReqId === r.id ? ' req-card--selected' : ''}`}
                onClick={() => onOpenTrack(r.id)}
              >
                <div className="req-card__top">
                  <span className="req-card__ver">{r.version}</span>
                  <PriorityBadge priority={r.priority} />
                </div>
                <div className="req-card__name">{r.name}</div>
                {r.content && <div className="req-card__content">{richTextPlainText(r.content)}</div>}
              </ClickableCard>
              <div className="req-card__bottom-actions" onClick={(event) => event.stopPropagation()}>
                <IconButton label={`基于 ${r.version} 新增需求`} variant="ghost" size="sm" className="req-card__add" icon={<Icon name="plus" size={14} />} type="button" onClick={() => onAddChild(r.version)} />
                <IconButton label={`编辑 ${r.name}`} variant="ghost" size="sm" className="req-card__edit" icon={<Icon name="edit" size={13} />} type="button" onClick={() => onOpenTrack(r.id)} />
                <IconButton label={`删除 ${r.name}`} variant="ghost" size="sm" className="req-card__delete" icon={<Icon name="trash" size={13} />} type="button" onClick={() => onRequestDelete(r)} />
              </div>
            </div>
          ))}
        </div>
        <MiniScrollbar viewportRef={bodyRef} orientation="vertical" />
      </div>
      </LayoutContent>} />
    </Card>
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
  const attachmentDraft = useAttachmentDraft({ maxSize: 15, maxTotal: 50 })
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
    attachmentDraft.reset()
    setLaunchDate('')
    setCompetitorIds([])
    setShowForm(true)
  }

  async function submit() {
    const requirementName = name.trim()
    if (!requirementName) return
    const saved = await attachmentDraft.save({
      spaceId, entityType: 'requirement', entityId: draftId, pathSegments: ['需求', requirementName, '关联文件'],
    }, (attachments) => onAdd({
      id: draftId,
      spaceId,
      version: version.trim() || 'V',
      name: requirementName,
      content: content.trim(),
      priority,
      status: '调研中',
      createdAt: Date.now(),
      launchDate: launchDate || undefined,
      competitorIds: competitorIds.length ? competitorIds : undefined,
      attachments,
    }))
    if (saved) setShowForm(false)
  }

  function closeForm() {
    if (attachmentDraft.saving) return
    setShowForm(false)
    attachmentDraft.reset()
  }

  return (
    <div className="req-pool-page">
      <div className="req-pool-toolbar"><div className="req-pool-toolbar__title">需求池</div><Button label="新增需求" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={() => openCreate()} /></div>
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
        <WorkspaceOverlay label="新增需求" onClose={closeForm}>
          <div className="modal modal--wide project-task-create-modal requirement-create-modal">
            <div className="project-task-create-modal__content">
            <Heading level={3} accessibilityLevel={2} className="modal__title">新增需求</Heading>

            <div className="form-row requirement-form-meta-row">
              <div className="requirement-form-version">
                <div className="field-label">需求版本</div>
                <TextInput label="需求版本" isLabelHidden width="100%" value={version} onChange={setVersion} />
              </div>
              <div className="requirement-form-priority">
                <div className="field-label">优先级</div>
                <SegmentedControl label="优先级" size="sm" value={priority} onChange={(value) => setPriority(value as Priority)}>
                      {PRIORITIES.map((priority) => <SegmentedControlItem key={priority} value={priority} label={priority} />)}
                    </SegmentedControl>
              </div>
            </div>

            <div className="field-label collection-field-gap">需求名称</div>
            <TextInput label="需求名称" isLabelHidden width="100%" value={name} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit() } }} placeholder="一句话说清要做什么" hasAutoFocus onChange={setName} />

            <div className="field-label" style={{ marginTop: 16 }}>
              需求内容
            </div>
            <RichTextField label="需求内容" value={content} placeholder="背景、目标、验收标准…" onChange={setContent} />

            <div className="requirement-create-inline-fields">
              <div><div className="field-label" style={{ marginTop: 16 }}>预计上线时间</div><DatePicker value={launchDate.slice(0, 10)} onChange={setLaunchDate} label="预计上线日期" /></div>
              <div><div className="field-label" style={{ marginTop: 16 }}>关联竞品</div><CompetitorMultiSelect options={competitors.filter((competitor) => competitor.spaceId === spaceId)} value={competitorIds} onChange={setCompetitorIds} /></div>
            </div>

            <div className="attachment-field">
              <div className="field-label">关联资料</div>
              <AttachmentPicker label="添加关联资料" files={attachmentDraft.files} onRemove={attachmentDraft.remove} onFiles={attachmentDraft.add} isDisabled={attachmentDraft.saving} />
              {attachmentDraft.error && <Banner status="error" title={<>{attachmentDraft.error}</>} />}
            </div>

            </div>
            <div className="modal__actions">
              <Button label="取消" variant="ghost" isDisabled={attachmentDraft.saving} onClick={closeForm} />
              <Button label="创建" variant="primary" isLoading={attachmentDraft.saving} onClick={() => void submit()} style={{ opacity: name.trim() ? 1 : 0.45 }} />
            </div>
          </div>
        </WorkspaceOverlay>
      )}
      {deleteTarget && <ConfirmDataDeletion title={'删除需求「' + deleteTarget.name + '」？'} onClose={() => setDeleteTarget(null)} onDelete={() => onDelete(deleteTarget.id)} />}
    </div>
  )
}
