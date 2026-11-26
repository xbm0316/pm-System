import { Heading } from '@astryxdesign/core/Text'
import { Banner } from '@astryxdesign/core/Banner'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { useAttachmentDraft } from '../lib/useAttachmentDraft'
import ConfirmDataDeletion from './ConfirmDataDeletion'
import AttachmentPicker from './AttachmentPicker'
import WorkspaceDialog, { WorkspaceOverlay } from './WorkspaceDialog'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Button } from '@astryxdesign/core/Button'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import PriorityBadge from './PriorityBadge'
import DatePicker from './DatePicker'
import DateRangeField from './DateRangeField'
import { TASK_STATUSES, type ProjectIssue, type ProjectIssueStatus, type ProjectTask, type ProjectTaskAttachment, type TaskStatus } from '../lib/store'
import { deleteLocalFile } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'
import RichTextField, { RichTextContent } from './RichTextField'

type TaskTab = 'content' | 'issues'

interface Props {
  spaceId: string
  projectName?: string
  task: ProjectTask
  issues: ProjectIssue[]
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onAddIssue: (issue: ProjectIssue) => void
  onUpdateIssue: (issueId: string, patch: Partial<ProjectIssue>) => void
  onUpdateTask: (taskId: string, patch: Partial<ProjectTask>) => void
  onClose: () => void
}

const issueStatuses: ProjectIssueStatus[] = ['待处理', '处理中', '已处理']

export default function ProjectTaskDetailPage({ spaceId, projectName, task, issues, onStatusChange, onAddIssue, onUpdateIssue, onUpdateTask, onClose }: Props) {
  const [tab, setTab] = useState<TaskTab>('content')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [issueEndDate, setIssueEndDate] = useState('')
  const [openIssueId, setOpenIssueId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(task.name)
  const [draftContent, setDraftContent] = useState(task.content)
  const [draftStartDate, setDraftStartDate] = useState(task.startDate || '')
  const [draftEndDate, setDraftEndDate] = useState(task.endDate || '')
  const [deleteAttachment, setDeleteAttachment] = useState<ProjectTaskAttachment | null>(null)
  const attachmentDraft = useAttachmentDraft({ maxSize: 15, maxTotal: 50 })
  const bodyRef = useRef<HTMLElement>(null)
  const taskIssues = issues.filter((issue) => issue.taskId === task.id).sort((a, b) => b.createdAt - a.createdAt)
  const openIssue = taskIssues.find((issue) => issue.id === openIssueId)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [tab])

  useEffect(() => {
    setDraftName(task.name)
    setDraftContent(task.content)
    setDraftStartDate(task.startDate || '')
    setDraftEndDate(task.endDate || '')
  }, [task.id])

  async function saveTask() {
    const name = draftName.trim()
    if (!name) return
    const saved = await attachmentDraft.save({
      spaceId, entityType: 'task', entityId: task.id,
      pathSegments: ['项目', projectName || task.projectId, '任务', name],
    }, (attachments) => onUpdateTask(task.id, {
      name,
      content: draftContent.trim(),
      startDate: draftStartDate,
      endDate: draftEndDate,
      ...(attachments.length ? { attachments: [...(task.attachments || []), ...attachments] } : {}),
    }))
    if (saved) setEditing(false)
  }

  function cancelEditing() {
    if (attachmentDraft.saving) return
    setDraftName(task.name)
    setDraftContent(task.content)
    setDraftStartDate(task.startDate || '')
    setDraftEndDate(task.endDate || '')
    attachmentDraft.reset()
    setEditing(false)
  }

  async function removeAttachment(attachment: ProjectTaskAttachment) {
    await deleteLocalFile(attachment.fileId || attachment.id)
    onUpdateTask(task.id, { attachments: (task.attachments || []).filter((item) => item.id !== attachment.id) })
    setDeleteAttachment(null)
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
          <IconButton label="返回项目" variant="ghost" size="sm" icon={<Icon name="arrowLeft" size={16} />} type="button" isDisabled={attachmentDraft.saving} onClick={onClose} className="requirement-detail-page__back" />
          <div className="requirement-detail-page__identity">
            <div className="requirement-detail-page__eyebrow">任务详情</div>
            <h1>
              <span className="project-task-detail-page__name">{task.name}</span>
              <PriorityBadge priority={task.priority} />
            </h1>
          </div>
        </div>
        <div className="requirement-detail-page__tabs">
          <TabList value={tab} onChange={(value) => setTab(value as TaskTab)} role="tablist" hasDivider>
            <Tab value="content" label="任务内容" panelId="task-content-panel" />
            <Tab value="issues" label="问题台账" panelId="task-issues-panel" />
          </TabList>
        </div>
      </header>

      <main className="requirement-detail-page__body" ref={bodyRef}>
        {tab === 'content' && (
          <div className="project-task-content" id="task-content-panel" role="tabpanel" aria-label="任务内容">
            <div className="project-task-content__toolbar">
              {!editing ? <IconButton label="编辑任务" variant="ghost" size="sm" icon={<Icon name="edit" size={15} />} type="button" onClick={() => setEditing(true)} /> : <><IconButton label="保存任务" variant="ghost" size="sm" icon={<Icon name="check" size={15} />} type="button" isLoading={attachmentDraft.saving} onClick={() => void saveTask()} /><IconButton label="取消编辑" variant="ghost" size="sm" icon={<Icon name="close" size={15} />} type="button" isDisabled={attachmentDraft.saving} onClick={cancelEditing} /></>}
            </div>
            <section className="project-task-section">
              <div className="project-task-section__label">任务标题</div>
              {editing ? <TextInput label="任务名称" value={draftName} isLabelHidden width="100%" onChange={setDraftName} /> : <div className="project-task-section__title">{task.name}</div>}
            </section>
            <section className="project-task-section">
              {editing ? (
                <DateRangeField
                  label="任务排期"
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={(start, end) => {
                    setDraftStartDate(start)
                    setDraftEndDate(end)
                  }}
                />
              ) : (
                <>
                  <div className="project-task-section__label">任务排期</div>
                  <div className="project-task-section__text">{task.startDate || task.endDate ? `${task.startDate || '未设置'} 至 ${task.endDate || '未设置'}` : '暂未设置任务排期'}</div>
                </>
              )}
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
              <div className="progress-percent-field">任务进度 <NumberInput label="任务进度" value={task.progress || 0} isLabelHidden width="100%" min={0} max={100} isWheelEnabled={false} onChange={(nextValue) => onUpdateTask(task.id, { progress: Math.min(100, Math.max(0, nextValue || 0)) })} /><span>%</span></div>
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务内容</div>
              {editing ? <RichTextField label="任务内容" value={draftContent} placeholder="目标、验收标准或执行说明…" minHeight={180} onChange={setDraftContent} /> : task.content ? <RichTextContent value={task.content} className="project-task-section__text" /> : <div className="project-task-section__text">暂未填写任务说明</div>}
              {!editing && task.detail && <RichTextContent value={task.detail} className="project-task-section__detail" />}
            </section>
            <section className="project-task-section">
              <div className="project-task-section__label">任务相关文件</div>
              {task.attachments && task.attachments.length > 0 ? <FileAttachmentList files={task.attachments} onDelete={editing && !attachmentDraft.saving ? (attachment) => setDeleteAttachment(attachment as ProjectTaskAttachment) : undefined} /> : <div className="project-task-section__text">暂无相关文件</div>}
              {attachmentDraft.error && <Banner status="error" title={<>{attachmentDraft.error}</>} />}
              {editing && <AttachmentPicker label="添加任务附件" files={attachmentDraft.files} onRemove={attachmentDraft.remove} isDisabled={attachmentDraft.saving} onFiles={(files) => attachmentDraft.add(files, task.attachments)} />}
            </section>
          </div>
        )}

        {tab === 'issues' && (
          <div className="project-issues" id="task-issues-panel" role="tabpanel" aria-label="问题台账">
            <section className="project-task-section">
              <div className="project-task-section__label">问题台账</div>
              <div className="project-issue-form">
                <TextInput label="问题标题" isLabelHidden width="100%" value={title} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addIssue() } }} placeholder="问题标题" onChange={setTitle} />
                <RichTextField label="补充问题描述（可选）" value={description} placeholder="补充问题描述（可选）" minHeight={120} onChange={setDescription} />
                <div className="project-issue-form__date">截止日期<DatePicker value={issueEndDate} onChange={setIssueEndDate} label="截止日期" /></div>
                <div className="project-issue-form__actions"><Button label="添加问题" variant="primary" type="button" onClick={addIssue} style={{ opacity: title.trim() ? 1 : .45 }} /></div>
              </div>
            </section>
            <section className="project-issue-list">
              {taskIssues.length === 0 ? <div className="project-issues__empty">暂未记录问题</div> : taskIssues.map((issue) => (
                <ClickableCard label={`查看问题 ${issue.title}`} padding={0} className="project-issue" key={issue.id} onClick={() => setOpenIssueId(issue.id)}>
                  <div className="project-issue__top"><div className="project-issue__title">{issue.title}</div><div className="project-issue-status-list">{issueStatuses.map((status) => <button type="button" key={status} className={`project-task-status project-issue-status${status === issue.status ? ' project-task-status--active project-task-status--current' : ''}`} onClick={() => onUpdateIssue(issue.id, { status })}><span className="project-task-status__dot"><Icon name="check" size={11} /></span><span>{status}</span></button>)}</div></div>
                  {issue.description && <RichTextContent value={issue.description} className="project-issue__description" />}
                  {issue.endDate && <div className="project-issue__date">截止于 {issue.endDate}</div>}
                  <div className="project-issue__date">{new Date(issue.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
                </ClickableCard>
              ))}
            </section>
          </div>
        )}
      </main>
      {openIssue && <WorkspaceDialog title={openIssue.title} purpose="info" onClose={() => setOpenIssueId(null)}>
        <VStack gap={2}>
          <Text>状态：{openIssue.status}</Text>
          {openIssue.endDate && <Text>截止日期：{openIssue.endDate}</Text>}
          {openIssue.description && <RichTextContent value={openIssue.description} className="project-issue__description" />}
        </VStack>
      </WorkspaceDialog>}
      {deleteAttachment && <ConfirmDataDeletion title={'删除附件「' + deleteAttachment.name + '」？'} onClose={() => setDeleteAttachment(null)} onDelete={() => removeAttachment(deleteAttachment)} />}
    </div>
  )
}
