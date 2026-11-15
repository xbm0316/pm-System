import { useMemo, useState } from 'react'
import Icon from './Icon'
import DateRangePicker from './DateRangePicker'
import DatePicker from './DatePicker'
import { uid, type ProjectTask, type WorkspaceMeeting } from '../lib/store'

interface Props {
  spaceId: string
  meetings: WorkspaceMeeting[]
  tasks: ProjectTask[]
  onChange: (meetings: WorkspaceMeeting[]) => void
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

  const visibleMeetings = useMemo(() => meetings.filter((item) => (!filterStartDate || item.date >= filterStartDate) && (!filterEndDate || item.date <= filterEndDate)).filter((item) => !searchQuery.trim() || `${item.title} ${item.content}`.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt), [filterEndDate, filterStartDate, meetings, searchQuery])
  function openCreate() { setEditing(null); setTitle(''); setDate(''); setContent(''); setSelectedTaskIds([]); setError(''); setDialog('create') }
  function openEdit(item: WorkspaceMeeting) { setEditing(item); setTitle(item.title); setDate(item.date); setContent(item.content); setSelectedTaskIds(item.taskIds || []); setError(''); setDialog('edit'); setDetail(null) }
  function closeDialog() { setDialog(null); setEditing(null); setError('') }
  function saveMeeting() {
    if (!title.trim()) return setError('请输入会议标题')
    if (!date) return setError('请选择会议时间')
    const now = Date.now()
    if (editing) { const next = { ...editing, title: title.trim(), date, content: content.trim(), taskIds: selectedTaskIds, updatedAt: now }; onChange(meetings.map((item) => item.id === editing.id ? next : item)); setDetail(next) }
    else onChange([{ id: uid(), spaceId, title: title.trim(), date, content: content.trim(), taskIds: selectedTaskIds, createdAt: now, updatedAt: now }, ...meetings])
    closeDialog()
  }
  function removeMeeting(item: WorkspaceMeeting) { onChange(meetings.filter((entry) => entry.id !== item.id)); setDeleteTarget(null); setDetail(null) }

  return <div className="meeting-page collection-page collection-page--board">
    <div className="meeting-toolbar collection-board-toolbar"><div className="meeting-toolbar__title collection-board-title">会议纪要</div><div className="meeting-toolbar__actions"><DateRangePicker startDate={filterStartDate} endDate={filterEndDate} onApply={(start, end) => { setFilterStartDate(start); setFilterEndDate(end) }} label="筛选时间" /><button type="button" className="btn-primary" onClick={openCreate}><Icon name="plus" size={14} /> 新增会议</button></div></div>
    <div className="meeting-grid collection-board-scroll">{visibleMeetings.length === 0 ? <div className="meeting-empty">暂无会议记录</div> : visibleMeetings.map((item) => <article className="meeting-card" key={item.id} onClick={() => setDetail(item)} tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetail(item) } }}><div className="meeting-card__top"><span className="meeting-card__date">{item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString('zh-CN') : '未设置时间'}</span><Icon name="chat" size={15} /></div><h3>{item.title}</h3><p className={!item.content ? 'meeting-card__empty-note' : undefined} onClick={(event) => { if (!item.content) { event.stopPropagation(); openEdit(item) } }}>{item.content || '点击填写会议纪要'}</p>{item.taskIds?.length ? <div className="meeting-card__links">关联 {item.taskIds.length} 个任务</div> : null}</article>)}</div>
    {dialog && <div className="overlay" onClick={closeDialog}><form className="modal modal--wide meeting-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveMeeting() }}><div className="modal__title">{editing ? '编辑会议' : '新增会议'}</div><div className="field-label">会议标题 <span className="field-required">*</span></div><input className="text-input" value={title} onChange={(event) => { setTitle(event.target.value); setError('') }} placeholder="输入会议标题" autoFocus required /><div className="field-label collection-field-gap">会议时间 <span className="field-required">*</span></div><DatePicker value={date} onChange={(value) => { setDate(value); setError('') }} label="会议日期" required /><div className="field-label collection-field-gap">关联任务</div><select className="text-input meeting-task-select" multiple value={selectedTaskIds} onChange={(event) => setSelectedTaskIds(Array.from(event.target.selectedOptions, (option) => option.value))}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select><div className="field-hint">按住 Command / Ctrl 可多选任务</div><div className="field-label collection-field-gap">会议纪要</div><textarea className="text-area" rows={8} value={content} onChange={(event) => setContent(event.target.value)} placeholder="可在会议结束后补充纪要" />{error && <div className="form-error" role="alert">{error}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={closeDialog}>取消</button><button type="submit" className="btn-primary">{editing ? '保存' : '创建会议'}</button></div></form></div>}
    {detail && <div className="overlay" onClick={() => setDetail(null)}><div className="modal modal--wide meeting-detail-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">{detail.title}</div><div className="collection-detail__meta">{detail.date ? new Date(`${detail.date}T00:00:00`).toLocaleDateString('zh-CN') : '未设置时间'}</div>{detail.taskIds?.length ? <div className="meeting-detail__tasks"><div className="field-label">关联任务</div>{detail.taskIds.map((taskId) => { const task = tasks.find((item) => item.id === taskId); return task ? <button type="button" className="meeting-task-link" key={taskId} onClick={() => { setDetail(null); onOpenTask(taskId) }}>{task.name}</button> : null })}</div> : null}<div className="collection-detail__content">{detail.content || '暂无会议纪要'}</div><div className="modal__actions"><button type="button" className="btn-ghost btn-ghost--danger" onClick={() => setDeleteTarget(detail)}><Icon name="trash" size={13} /> 删除</button><button type="button" className="btn-ghost" onClick={() => openEdit(detail)}><Icon name="edit" size={13} /> 编辑</button><button type="button" className="btn-primary" onClick={() => setDetail(null)}>关闭</button></div></div></div>}
    {deleteTarget && <div className="overlay" onClick={() => setDeleteTarget(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除会议？</div><div className="delete-confirm-modal__text">删除「{deleteTarget.title}」后无法恢复。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={() => removeMeeting(deleteTarget)}>确认删除</button></div></div></div>}
  </div>
}
