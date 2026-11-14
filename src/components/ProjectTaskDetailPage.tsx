import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Icon from './Icon'
import { REQ_STATUSES, type ProjectIssue, type ProjectIssueStatus, type ProjectTask, type ProjectTaskAttachment, type RequirementStatus } from '../lib/store'

type TaskTab = 'content' | 'issues'

interface Props {
  task: ProjectTask
  issues: ProjectIssue[]
  onStatusChange: (taskId: string, status: RequirementStatus) => void
  onAddIssue: (issue: ProjectIssue) => void
  onUpdateIssue: (issueId: string, patch: Partial<ProjectIssue>) => void
  onUpdateTask: (taskId: string, patch: Partial<ProjectTask>) => void
  onClose: () => void
}

const issueStatuses: ProjectIssueStatus[] = ['待处理', '处理中', '已解决']

export default function ProjectTaskDetailPage({ task, issues, onStatusChange, onAddIssue, onUpdateIssue, onUpdateTask, onClose }: Props) {
  const [tab, setTab] = useState<TaskTab>('content')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(task.name)
  const [draftContent, setDraftContent] = useState(task.content)
  const [draftStartDate, setDraftStartDate] = useState(task.startDate || '')
  const [draftEndDate, setDraftEndDate] = useState(task.endDate || '')
  const [previewAttachment, setPreviewAttachment] = useState<ProjectTaskAttachment | null>(null)
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

  function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    Promise.all(files.map((file) => new Promise<ProjectTaskAttachment>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        url: String(reader.result || ''),
        kind: file.type.startsWith('image/') ? 'image' : 'file',
      })
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }))).then((attachments) => onUpdateTask(task.id, { attachments: [...(task.attachments || []), ...attachments] }))
    event.target.value = ''
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
    })
    setTitle('')
    setDescription('')
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
              {editing ? <div className="project-task-schedule-edit"><label>开始日期<input className="text-input" type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} /></label><label>结束日期<input className="text-input" type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} /></label></div> : <div className="project-task-section__text">{task.startDate || task.endDate ? `${task.startDate || '未设置'} 至 ${task.endDate || '未设置'}` : '暂未设置任务排期'}</div>}
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务进度</div>
              <div className="project-task-status-list">
                {REQ_STATUSES.map((status) => {
                  const active = REQ_STATUSES.indexOf(status) <= REQ_STATUSES.indexOf(task.status)
                  return (
                    <button key={status} type="button" className={`project-task-status${active ? ' project-task-status--active' : ''}${task.status === status ? ' project-task-status--current' : ''}`} onClick={() => onStatusChange(task.id, status)}>
                      <span className="project-task-status__dot"><Icon name="check" size={11} /></span>
                      <span>{status}</span>
                    </button>
                  )
                })}
              </div>
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务内容</div>
              {editing ? <textarea className="text-area project-task-edit-textarea" rows={6} value={draftContent} onChange={(event) => setDraftContent(event.target.value)} /> : <><div className="project-task-section__text">{task.content || '暂未填写任务说明'}</div>{task.detail && <div className="project-task-section__detail">{task.detail}</div>}</>}
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务相关文件</div>
              {task.attachments && task.attachments.length > 0 ? <div className="project-task-attachments">{task.attachments.map((attachment) => <button className="project-task-attachment" type="button" key={attachment.id} onClick={() => setPreviewAttachment(attachment)}>{attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name} /> : <span className="project-task-attachment__file">文件</span>}<span>{attachment.name}</span></button>)}</div> : <div className="project-task-section__text">暂无相关文件</div>}
              {editing && <label className="project-task-upload"><Icon name="plus" size={14} /> 添加文件<input type="file" multiple onChange={addAttachments} /></label>}
            </section>
          </div>
        )}

        {tab === 'issues' && (
          <div className="project-issues">
            <section className="project-task-section">
              <div className="project-task-section__label">问题台账</div>
              <div className="project-issues__hint">记录执行过程中发现的问题、处理进展和解决结果。</div>
              <div className="project-issue-form">
                <input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="问题标题" />
                <textarea className="text-area" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="补充问题描述（可选）" />
                <div className="project-issue-form__actions"><button type="button" className="btn-primary" onClick={addIssue} style={{ opacity: title.trim() ? 1 : .45 }}>添加问题</button></div>
              </div>
            </section>
            <section className="project-issue-list">
              {taskIssues.length === 0 ? <div className="project-issues__empty">暂未记录问题</div> : taskIssues.map((issue) => (
                <article className="project-issue" key={issue.id}>
                  <div className="project-issue__top"><div className="project-issue__title">{issue.title}</div><select className="project-issue__status" value={issue.status} onChange={(event) => onUpdateIssue(issue.id, { status: event.target.value as ProjectIssueStatus })}>{issueStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                  {issue.description && <div className="project-issue__description">{issue.description}</div>}
                  <div className="project-issue__date">{new Date(issue.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
                </article>
              ))}
            </section>
          </div>
        )}
      </main>
      {previewAttachment && <div className="overlay" onClick={() => setPreviewAttachment(null)}><div className="modal attachment-preview" onClick={(event) => event.stopPropagation()}><div className="modal__title">{previewAttachment.name}</div>{previewAttachment.kind === 'image' ? <img className="attachment-preview__image" src={previewAttachment.url} alt={previewAttachment.name} /> : <div className="attachment-preview__file"><span className="attachment-preview__file-icon">文件</span><span>{previewAttachment.type || '未知文件类型'}</span><span>{previewAttachment.size ? `${Math.ceil(previewAttachment.size / 1024)} KB` : '大小未知'}</span></div>}<div className="modal__actions"><a className="btn-ghost attachment-preview__download" href={previewAttachment.url} download={previewAttachment.name}>下载附件</a><button className="btn-primary" type="button" onClick={() => setPreviewAttachment(null)}>关闭</button></div></div></div>}
    </div>
  )
}
