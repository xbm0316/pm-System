import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Icon from './Icon'
import DatePicker from './DatePicker'
import DateRangePicker from './DateRangePicker'
import { TASK_STATUSES, type ProjectIssue, type ProjectIssueStatus, type ProjectTask, type ProjectTaskAttachment, type TaskStatus } from '../lib/store'
import { deleteLocalFile, uploadLocalFile } from '../lib/localFiles'

type TaskTab = 'content' | 'issues'

interface Props {
  spaceId: string
  task: ProjectTask
  issues: ProjectIssue[]
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onAddIssue: (issue: ProjectIssue) => void
  onUpdateIssue: (issueId: string, patch: Partial<ProjectIssue>) => void
  onUpdateTask: (taskId: string, patch: Partial<ProjectTask>) => void
  onClose: () => void
}

const issueStatuses: ProjectIssueStatus[] = ['待处理', '处理中', '已处理']

export default function ProjectTaskDetailPage({ spaceId, task, issues, onStatusChange, onAddIssue, onUpdateIssue, onUpdateTask, onClose }: Props) {
  const [tab, setTab] = useState<TaskTab>('content')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [issueEndDate, setIssueEndDate] = useState('')
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(task.name)
  const [draftContent, setDraftContent] = useState(task.content)
  const [draftStartDate, setDraftStartDate] = useState(task.startDate || '')
  const [draftEndDate, setDraftEndDate] = useState(task.endDate || '')
  const [previewAttachment, setPreviewAttachment] = useState<ProjectTaskAttachment | null>(null)
  const [deleteAttachment, setDeleteAttachment] = useState<ProjectTaskAttachment | null>(null)
  const [attachmentError, setAttachmentError] = useState('')
  const bodyRef = useRef<HTMLElement>(null)
  const taskIssues = issues.filter((issue) => issue.taskId === task.id).sort((a, b) => b.createdAt - a.createdAt)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [tab])

  useEffect(() => {
    setDraftName(task.name)
    setDraftContent(task.content)
    setDraftStartDate(task.startDate || '')
    setDraftEndDate(task.endDate || '')
  }, [task.id])

  function saveTask() {
    const name = draftName.trim()
    if (!name) return
    onUpdateTask(task.id, {
      name,
      content: draftContent.trim(),
      startDate: draftStartDate,
      endDate: draftEndDate,
    })
    setEditing(false)
  }

  function cancelEditing() {
    setDraftName(task.name)
    setDraftContent(task.content)
    setDraftStartDate(task.startDate || '')
    setDraftEndDate(task.endDate || '')
    setEditing(false)
  }

  async function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const existing = task.attachments || []
    const incoming = files.filter((file) => file.size > 0 && file.size <= 15 * 1024 * 1024)
    if (incoming.length !== files.length) setAttachmentError('空文件或超过 15 MB 的文件未添加')
    if (existing.length + incoming.length > 20) {
      setAttachmentError('任务最多保留 20 个附件')
      event.target.value = ''
      return
    }
    if (existing.reduce((total, item) => total + item.size, 0) + incoming.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      setAttachmentError('任务附件总大小不能超过 50 MB')
      event.target.value = ''
      return
    }
    if (incoming.length === files.length) setAttachmentError('')
    const results = await Promise.allSettled(incoming.map((file) => uploadLocalFile(file, { spaceId, entityType: 'task', entityId: task.id })))
    const attachments = results.flatMap((result) => result.status === 'fulfilled' ? [{ ...result.value, id: result.value.fileId }] : []) as ProjectTaskAttachment[]
    const failed = results.length - attachments.length
    if (attachments.length) onUpdateTask(task.id, { attachments: [...(task.attachments || []), ...attachments] })
    if (failed) setAttachmentError(`${failed} 个文件上传失败，请确认已选择本地文件夹并授予写入权限`)
    event.target.value = ''
  }

  function removeAttachment(attachment: ProjectTaskAttachment) {
    void deleteLocalFile(attachment.fileId || attachment.id)
    onUpdateTask(task.id, { attachments: (task.attachments || []).filter((item) => item.id !== attachment.id) })
    setDeleteAttachment(null)
    if (previewAttachment?.id === attachment.id) setPreviewAttachment(null)
  }

  function addIssue() {
    if (!title.trim()) return
    onAddIssue({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      taskId: task.id,
      title: title.trim(),
      description: description.trim(),
      status: '待处理',
      createdAt: Date.now(),
      endDate: issueEndDate || undefined,
    })
    setTitle('')
    setDescription('')
    setIssueEndDate('')
  }

  return (
    <div className="requirement-detail-page project-task-detail-page">
      <header className="requirement-detail-page__head">
        <div className="requirement-detail-page__head-main">
          <button className="icon-btn requirement-detail-page__back" type="button" onClick={onClose} title="返回项目" aria-label="返回项目">
            <Icon name="arrowLeft" size={16} />
          </button>
          <div className="requirement-detail-page__identity">
            <div className="requirement-detail-page__eyebrow">任务详情</div>
            <h1>
              <span className="project-task-detail-page__name">{task.name}</span>
              <span className={`pri pri--${task.priority.toLowerCase()}`}>{task.priority}</span>
            </h1>
          </div>
        </div>
        <div className="requirement-detail-page__tabs" role="tablist" aria-label="任务详情模块">
          <button type="button" role="tab" aria-selected={tab === 'content'} className={`detail-tab${tab === 'content' ? ' detail-tab--active' : ''}`} onClick={() => setTab('content')}>任务内容</button>
          <button type="button" role="tab" aria-selected={tab === 'issues'} className={`detail-tab${tab === 'issues' ? ' detail-tab--active' : ''}`} onClick={() => setTab('issues')}>问题台账</button>
        </div>
      </header>

      <main className="requirement-detail-page__body" ref={bodyRef}>
        {tab === 'content' && (
          <div className="project-task-content">
            <div className="project-task-content__toolbar">
              {!editing ? <button className="icon-btn" type="button" onClick={() => setEditing(true)} title="编辑任务" aria-label="编辑任务"><Icon name="edit" size={15} /></button> : <><button className="icon-btn" type="button" onClick={saveTask} title="保存任务" aria-label="保存任务"><Icon name="check" size={15} /></button><button className="icon-btn" type="button" onClick={cancelEditing} title="取消编辑" aria-label="取消编辑"><Icon name="close" size={15} /></button></>}
            </div>
            <section className="project-task-section">
              <div className="project-task-section__label">任务标题</div>
              {editing ? <input className="text-input project-task-edit-input" value={draftName} onChange={(event) => setDraftName(event.target.value)} /> : <div className="project-task-section__title">{task.name}</div>}
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务排期</div>
              {editing ? <DateRangePicker startDate={draftStartDate} endDate={draftEndDate} onApply={(start, end) => { setDraftStartDate(start); setDraftEndDate(end) }} label="选择任务排期" /> : <div className="project-task-section__text">{task.startDate || task.endDate ? `${task.startDate || '未设置'} 至 ${task.endDate || '未设置'}` : '暂未设置任务排期'}</div>}
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务进度</div>
              <div className="project-task-status-list">
                {TASK_STATUSES.map((status) => {
                  const active = TASK_STATUSES.indexOf(status) <= TASK_STATUSES.indexOf(task.status)
                  return (
                    <button key={status} type="button" className={`project-task-status${active ? ' project-task-status--active' : ''}${task.status === status ? ' project-task-status--current' : ''}`} onClick={() => onStatusChange(task.id, status)}>
                      <span className="project-task-status__dot"><Icon name="check" size={11} /></span>
                      <span>{status}</span>
                    </button>
                  )
                })}
              </div>
              <label className="progress-percent-field">任务进度 <input type="number" min="0" max="100" value={task.progress || 0} onChange={(event) => onUpdateTask(task.id, { progress: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} /><span>%</span></label>
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务内容</div>
              {editing ? <textarea className="text-area project-task-edit-textarea" rows={6} value={draftContent} onChange={(event) => setDraftContent(event.target.value)} /> : <><div className="project-task-section__text">{task.content || '暂未填写任务说明'}</div>{task.detail && <div className="project-task-section__detail">{task.detail}</div>}</>}
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务相关文件</div>
              {task.attachments && task.attachments.length > 0 ? <div className="project-task-attachments">{task.attachments.map((attachment) => <div className="project-task-attachment-wrap" key={attachment.id}><button className="project-task-attachment" type="button" onClick={() => setPreviewAttachment(attachment)}>{attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name} /> : <span className="project-task-attachment__file">文件</span>}<span>{attachment.name}</span></button>{editing && <button type="button" className="project-task-attachment__remove" onClick={() => setDeleteAttachment(attachment)} title={`删除附件 ${attachment.name}`} aria-label={`删除附件 ${attachment.name}`}><Icon name="trash" size={13} /></button>}</div>)}</div> : <div className="project-task-section__text">暂无相关文件</div>}
              {attachmentError && <div className="form-error" role="alert">{attachmentError}</div>}
              {editing && <label className="project-task-upload"><Icon name="plus" size={14} /> 添加多个文件<input type="file" multiple onChange={addAttachments} /></label>}
            </section>
          </div>
        )}

        {tab === 'issues' && (
          <div className="project-issues">
            <section className="project-task-section">
              <div className="project-task-section__label">问题台账</div>
              <div className="project-issues__hint">记录执行过程中发现的问题、处理进展和解决结果。</div>
              <div className="project-issue-form">
                <input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addIssue() } }} placeholder="问题标题" />
                <textarea className="text-area" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="补充问题描述（可选）" />
                <label className="project-issue-form__date">截止日期<DatePicker value={issueEndDate} onChange={setIssueEndDate} label="截止日期" /></label>
                <div className="project-issue-form__actions"><button type="button" className="btn-primary" onClick={addIssue} style={{ opacity: title.trim() ? 1 : .45 }}>添加问题</button></div>
              </div>
            </section>
            <section className="project-issue-list">
              {taskIssues.length === 0 ? <div className="project-issues__empty">暂未记录问题</div> : taskIssues.map((issue) => (
                <article className="project-issue" key={issue.id}>
                  <div className="project-issue__top"><div className="project-issue__title">{issue.title}</div><div className="project-issue-status-list">{issueStatuses.map((status) => <button type="button" key={status} className={`project-task-status project-issue-status${status === issue.status ? ' project-task-status--active project-task-status--current' : ''}`} onClick={() => onUpdateIssue(issue.id, { status })}><span className="project-task-status__dot"><Icon name="check" size={11} /></span><span>{status}</span></button>)}</div></div>
                  {issue.description && <div className="project-issue__description">{issue.description}</div>}
                  {issue.endDate && <div className="project-issue__date">截止于 {issue.endDate}</div>}
                  <div className="project-issue__date">{new Date(issue.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
                </article>
              ))}
            </section>
          </div>
        )}
      </main>
      {previewAttachment && <div className="overlay" onClick={() => setPreviewAttachment(null)}><div className="modal attachment-preview" onClick={(event) => event.stopPropagation()}><div className="modal__title">{previewAttachment.name}</div>{previewAttachment.kind === 'image' ? <img className="attachment-preview__image" src={previewAttachment.url} alt={previewAttachment.name} /> : <div className="attachment-preview__file"><span className="attachment-preview__file-icon">文件</span><span>{previewAttachment.type || '未知文件类型'}</span><span>{previewAttachment.size ? `${Math.ceil(previewAttachment.size / 1024)} KB` : '大小未知'}</span></div>}<div className="modal__actions"><a className="btn-ghost attachment-preview__download" href={previewAttachment.url} download={previewAttachment.name}>下载附件</a><button className="btn-ghost btn-ghost--danger" type="button" onClick={() => { setDeleteAttachment(previewAttachment); setPreviewAttachment(null) }}><Icon name="trash" size={13} /> 删除</button><button className="btn-primary" type="button" onClick={() => setPreviewAttachment(null)}>关闭</button></div></div></div>}
      {deleteAttachment && <div className="overlay" onClick={() => setDeleteAttachment(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除附件？</div><div className="delete-confirm-modal__text">删除「{deleteAttachment.name}」后无法恢复。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteAttachment(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={() => removeAttachment(deleteAttachment)}>确认删除</button></div></div></div>}
    </div>
  )
}
