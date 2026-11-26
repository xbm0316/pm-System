import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { MultiSelector } from '@astryxdesign/core/MultiSelector'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useMemo, useState } from 'react'
import Icon from './Icon'
import RichTextField, { RichTextContent } from './RichTextField'
import { richTextPlainText } from '../lib/richText'
import DateRangePicker from './DateRangePicker'
import DatePicker from './DatePicker'
import { uid, type ProjectTask, type WorkspaceMeeting } from '../lib/store'

interface Props {
  spaceId: string
  meetings: WorkspaceMeeting[]
  tasks: ProjectTask[]
  onChange: (meetings: WorkspaceMeeting[]) => Promise<void>
  onOpenTask: (taskId: string) => void
  searchQuery?: string
}

export default function MeetingWorkspace({ spaceId, meetings, tasks, onChange, onOpenTask, searchQuery = '' }: Props) {
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null)
  const [detail, setDetail] = useState<WorkspaceMeeting | null>(null)
  const [editing, setEditing] = useState<WorkspaceMeeting | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceMeeting | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [content, setContent] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [error, setError] = useState('')

  const visibleMeetings = useMemo(() => meetings.filter((item) => (!filterStartDate || item.date >= filterStartDate) && (!filterEndDate || item.date <= filterEndDate)).filter((item) => !searchQuery.trim() || `${item.title} ${richTextPlainText(item.content)}`.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt), [filterEndDate, filterStartDate, meetings, searchQuery])
  function openCreate() { setEditing(null); setTitle(''); setDate(''); setContent(''); setSelectedTaskIds([]); setError(''); setDialog('create') }
  function openEdit(item: WorkspaceMeeting) { setEditing(item); setTitle(item.title); setDate(item.date); setContent(item.content); setSelectedTaskIds(item.taskIds || []); setError(''); setDialog('edit'); setDetail(null) }
  function closeDialog() { setDialog(null); setEditing(null); setError('') }
  async function saveMeeting() {
    if (!title.trim()) return setError('请输入会议标题')
    if (!date) return setError('请选择会议时间')
    const now = Date.now()
    const next: WorkspaceMeeting = { id: editing?.id ?? uid(), spaceId, title: title.trim(), date, content: content.trim(), taskIds: selectedTaskIds, createdAt: editing?.createdAt ?? now, updatedAt: now }
    try {
      await onChange(editing ? meetings.map((item) => item.id === editing.id ? next : item) : [next, ...meetings])
      closeDialog()
      if (editing) setDetail(next)
    } catch {
      setError('无法保存会议，请重试')
    }
  }

  async function removeMeeting(item: WorkspaceMeeting) {
    try {
      await onChange(meetings.filter((entry) => entry.id !== item.id))
      setDeleteTarget(null)
      setDetail(null)
    } catch {
      setError('无法删除会议，请重试')
    }
  }
  return <div className="meeting-page collection-page collection-page--board">
    <div className="meeting-toolbar collection-board-toolbar"><div className="meeting-toolbar__title collection-board-title">会议纪要</div><div className="meeting-toolbar__actions"><DateRangePicker startDate={filterStartDate} endDate={filterEndDate} onApply={(start, end) => { setFilterStartDate(start); setFilterEndDate(end) }} label="筛选时间" /><Button label="新增会议" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={openCreate} /></div></div>
    <div className="meeting-grid collection-board-scroll">{visibleMeetings.length === 0 ? <div className="meeting-empty">暂无会议记录</div> : visibleMeetings.map((item) => <article className="meeting-card-wrap" key={item.id}><ClickableCard label={`查看会议 ${item.title}`} padding={0} className="meeting-card" onClick={() => setDetail(item)}><div className="meeting-card__top"><span className="meeting-card__date">{item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString('zh-CN') : '未设置时间'}</span><Icon name="chat" size={15} /></div><h3>{item.title}</h3><p className={!item.content ? 'meeting-card__empty-note' : undefined} onClick={(event) => { if (!item.content) { event.stopPropagation(); openEdit(item) } }}>{item.content || '点击填写会议纪要'}</p>{item.taskIds?.length ? <div className="meeting-card__links">关联 {item.taskIds.length} 个任务</div> : null}</ClickableCard><div className="meeting-card__actions" onClick={(event) => event.stopPropagation()}><IconButton label={`编辑会议 ${item.title}`} variant="ghost" size="sm" icon={<Icon name="edit" size={13} />} type="button" onClick={() => openEdit(item)} /><IconButton label={`删除会议 ${item.title}`} variant="ghost" size="sm" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteTarget(item)} /></div></article>)}</div>
    {dialog && <WorkspaceOverlay label={editing ? '编辑会议' : '新增会议'} onClose={closeDialog}><form className="modal modal--wide meeting-modal" onSubmit={(event) => { event.preventDefault(); saveMeeting() }}><Heading level={3} accessibilityLevel={2} className="modal__title">{editing ? '编辑会议' : '新增会议'}</Heading><div className="field-label">会议标题 <span className="field-required">*</span></div><TextInput label="会议标题" value={title} isLabelHidden width="100%" isRequired hasAutoFocus placeholder="输入会议标题" onChange={(nextValue) => { setTitle(nextValue); setError('') }} /><div className="field-label collection-field-gap">会议时间 <span className="field-required">*</span></div><DatePicker value={date} onChange={(value) => { setDate(value); setError('') }} label="会议日期" required /><div className="field-label collection-field-gap">关联任务</div><MultiSelector label="关联任务" isLabelHidden width="100%" placeholder="选择关联任务" hasSearch value={selectedTaskIds} onChange={setSelectedTaskIds} options={tasks.map(({ id, name }) => ({ value: id, label: name }))} /><div className="field-hint">按住 Command / Ctrl 可多选任务</div><RichTextField label="会议纪要" value={content} placeholder="可在会议结束后补充纪要" minHeight={180} onChange={setContent} />{error && <Banner status="error" title={<>{error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={closeDialog} /><Button label={editing ? '保存' : '创建会议'} variant="primary" type="submit" /></div></form></WorkspaceOverlay>}
    {detail && <WorkspaceOverlay label={detail.title} onClose={() => setDetail(null)}><div className="modal modal--wide meeting-detail-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">{detail.title}</Heading><div className="collection-detail__meta">{detail.date ? new Date(`${detail.date}T00:00:00`).toLocaleDateString('zh-CN') : '未设置时间'}</div>{detail.taskIds?.length ? <div className="meeting-detail__tasks"><div className="field-label">关联任务</div>{detail.taskIds.map((taskId) => { const task = tasks.find((item) => item.id === taskId); return task ? <Button label={task.name} variant="ghost" className="meeting-task-link" type="button" key={taskId} onClick={() => { setDetail(null); onOpenTask(taskId) }} /> : null })}</div> : null}<div className="collection-detail__content">{detail.content || '暂无会议纪要'}</div><div className="modal__actions"><Button label="删除" variant="ghost" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteTarget(detail)} className="btn-ghost--danger" /><Button label="编辑" variant="ghost" icon={<Icon name="edit" size={13} />} type="button" onClick={() => openEdit(detail)} /><Button label="关闭" variant="primary" type="button" onClick={() => setDetail(null)} /></div></div></WorkspaceOverlay>}
    {deleteTarget && <WorkspaceOverlay label="确认删除会议？" onClose={() => setDeleteTarget(null)}><div className="modal delete-confirm-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">确认删除会议？</Heading><div className="delete-confirm-modal__text">删除「{deleteTarget.title}」后无法恢复。</div>{error && <Banner status="error" title={error} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setDeleteTarget(null)} /><Button label="确认删除" variant="destructive" type="button" onClick={() => removeMeeting(deleteTarget)} /></div></div></WorkspaceOverlay>}
  </div>
}
