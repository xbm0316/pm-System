import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import AttachmentPicker from './AttachmentPicker'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import BoardLaneHeading from './BoardLaneHeading'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { IconButton } from '@astryxdesign/core/IconButton'
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import ProjectTaskDetailPage from './ProjectTaskDetailPage'
import RetroWorkspace from './RetroWorkspace'
import KnowledgeWorkspace from './KnowledgeWorkspace'
import MeetingWorkspace from './MeetingWorkspace'
import DateRangeField from './DateRangeField'
import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, uid, type KnowledgeResource, type Priority, type Project, type ProjectIssue, type ProjectStatus, type ProjectStore, type ProjectTask, type TaskStatus, type WorkspaceCollectionType, type WorkspaceRetro } from '../lib/store'
import { deleteLocalFile, listLocalFiles, localFileUrl, uploadLocalFile } from '../lib/localFiles'
import { deleteLocalFilesForEntity } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'

interface Props {
  spaceId: string
  ownerPhone: string
  searchQuery?: string
  onRemindersChange?: (count: number) => void
  onReminders?: (items: { id: string; kind: 'task' | 'issue'; title: string; dueDate: string; taskId: string; projectId: string }[]) => void
  openTaskId?: string | null
  onOpenTask?: (taskId: string) => void
  onCloseTask?: () => void
  view?: 'board' | 'retro' | 'knowledge' | 'meeting'
}

const STORAGE_PREFIX = 'jawcat.project-manager.v4.'
const LEGACY_STORAGE_PREFIX = 'jawcat.project-manager.v3.'

function clearLegacyProjectStorage() {
  if (typeof window === 'undefined') return
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith(LEGACY_STORAGE_PREFIX)) localStorage.removeItem(key)
  }
}

function normalizeTaskStatus(status: unknown): TaskStatus {
  if (TASK_STATUSES.includes(status as TaskStatus)) return status as TaskStatus
  if (status === '实施中' || status === '调试中' || status === '验收中' || status === '质保中' || status === '开发中' || status === '测试中') return '处理中'
  if (status === '任务结束' || status === '已上线') return '处理完成'
  return '调研中'
}

function normalizeAttachment<T extends { id: string; fileId?: string; url?: string }>(attachment: T): T {
  const fileId = attachment.fileId || attachment.id
  return { ...attachment, fileId, url: fileId ? localFileUrl(fileId) : attachment.url } as T
}

function readStore(ownerPhone: string, spaceId: string): ProjectStore {
  try {
    const scopedKey = `${STORAGE_PREFIX}${ownerPhone}.${spaceId}`
    const legacyKey = `${STORAGE_PREFIX}${spaceId}`
    const raw = localStorage.getItem(scopedKey) || (ownerPhone === '13610392041' ? localStorage.getItem(legacyKey) : null)
    if (!raw) return { projects: [], tasks: [], issues: [], retroTypes: [], retros: [], knowledgeTypes: [], knowledgeResources: [], meetings: [], summaries: [] }
    const parsed = JSON.parse(raw) as Partial<ProjectStore>
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects.map((project) => ({ ...project, status: PROJECT_STATUSES.includes(project.status as ProjectStatus) ? project.status as ProjectStatus : '调研中', attachments: Array.isArray(project.attachments) ? project.attachments.filter((attachment) => !String(attachment.url || '').startsWith('data:')).map(normalizeAttachment) : undefined })) : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((task) => ({ ...task, status: normalizeTaskStatus(task.status), attachments: Array.isArray(task.attachments) ? task.attachments.filter((attachment) => !String(attachment.url || '').startsWith('data:')).map(normalizeAttachment) : undefined })) : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((issue) => ({ ...issue, status: (issue.status as string) === '已解决' ? '已处理' : issue.status || '待处理' })) : [],
      retroTypes: Array.isArray(parsed.retroTypes) ? parsed.retroTypes : [],
      retros: Array.isArray(parsed.retros) ? parsed.retros.map((retro) => ({ ...retro, attachments: Array.isArray(retro.attachments) ? retro.attachments.filter((attachment) => !String(attachment.url || '').startsWith('data:')).map(normalizeAttachment) : undefined })) : [],
      knowledgeTypes: Array.isArray(parsed.knowledgeTypes) ? parsed.knowledgeTypes : [],
      knowledgeResources: Array.isArray(parsed.knowledgeResources) ? parsed.knowledgeResources.filter((resource) => !resource.dataUrl).map((resource) => ({ ...resource, fileUrl: resource.fileId ? localFileUrl(resource.fileId) : resource.fileUrl })) : [],
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
      summaries: Array.isArray(parsed.summaries) ? parsed.summaries : [],
    }
  } catch {
    return { projects: [], tasks: [], issues: [], retroTypes: [], retros: [], knowledgeTypes: [], knowledgeResources: [], meetings: [], summaries: [] }
  }
}

function statusClass(status: TaskStatus) {
  return status === '调研中' ? 'research' : status === '处理中' ? 'development' : 'complete'
}

function projectStatusClass(status: ProjectStatus) {
  return status === '调研中' ? 'research' : status === '已启动' ? 'reviewed' : status === '实施中' ? 'development' : status === '调试中' ? 'testing' : status === '验收中' ? 'reviewed' : status === '质保中' ? 'live' : 'complete'
}

export default function ProjectManagerBoard({ ownerPhone, spaceId, searchQuery = '', onRemindersChange, onReminders, openTaskId, onOpenTask, onCloseTask, view = 'board' }: Props) {
  useEffect(() => { clearLegacyProjectStorage() }, [])
  const [store, setStore] = useState<ProjectStore>(() => readStore(ownerPhone, spaceId))
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => readStore(ownerPhone, spaceId).projects.find((project) => !project.archivedAt)?.id || null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [projectParentId, setProjectParentId] = useState<string | undefined>()
  const [projectDetailTarget, setProjectDetailTarget] = useState<Project | null>(null)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectStartDate, setProjectStartDate] = useState('')
  const [projectEndDate, setProjectEndDate] = useState('')
  const [projectCost, setProjectCost] = useState('')
  const [projectRevenue, setProjectRevenue] = useState('')
  const [projectProfit, setProjectProfit] = useState('')
  const [projectFiles, setProjectFiles] = useState<File[]>([])
  const [projectFileError, setProjectFileError] = useState('')
  const [projectDetailEditing, setProjectDetailEditing] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [taskContent, setTaskContent] = useState('')
  const [taskDetail, setTaskDetail] = useState('')
  const [taskStartDate, setTaskStartDate] = useState('')
  const [taskEndDate, setTaskEndDate] = useState('')
  const [taskPriority, setTaskPriority] = useState<Priority>('P1')
  const [taskFiles, setTaskFiles] = useState<File[]>([])
  const [taskFileError, setTaskFileError] = useState('')
  const [showProjectStatus, setShowProjectStatus] = useState(false)
  const [projectProgress, setProjectProgress] = useState(0)
  const [taskFormError, setTaskFormError] = useState('')
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<ProjectTask | null>(null)

  function resetProjectForm(parentId?: string) {
    setProjectParentId(parentId)
    setProjectName(''); setProjectDescription(''); setProjectStartDate(''); setProjectEndDate(''); setProjectCost(''); setProjectRevenue(''); setProjectProfit(''); setProjectFiles([]); setProjectFileError('')
  }

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${ownerPhone}.${spaceId}`, JSON.stringify(store))
  }, [ownerPhone, spaceId, store])

  useEffect(() => {
    const current = store.projects.find((project) => project.id === activeProjectId && !project.archivedAt)
    if (!current) setActiveProjectId(store.projects.find((project) => !project.archivedAt)?.id || null)
    if (detailTaskId && !store.tasks.some((task) => task.id === detailTaskId)) setDetailTaskId(null)
  }, [store.projects, store.tasks, activeProjectId, detailTaskId])

  useEffect(() => {
    if (openTaskId && store.tasks.some((task) => task.id === openTaskId)) setDetailTaskId(openTaskId)
  }, [openTaskId, store.tasks])
  useEffect(() => { if (view !== 'board') setDetailTaskId(null) }, [view])
  useEffect(() => {
    if (!expandedProjectId) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.project-tab-wrap')) setExpandedProjectId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [expandedProjectId])

  const query = searchQuery.trim().toLocaleLowerCase()
  const projects = store.projects.filter((project) => !project.archivedAt)
  const rootProjects = projects.filter((project) => !project.parentId)
  const archivedProjects = store.projects.filter((project) => project.archivedAt).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0))
  const activeProject = projects.find((project) => project.id === activeProjectId) || null
  const activeTask = store.tasks.find((task) => task.id === detailTaskId) || null
  useEffect(() => { setProjectProgress(activeProject?.progress || 0) }, [activeProject?.id, activeProject?.progress])
  const reminders = useMemo(() => {
    const limit = Date.now() + 24 * 60 * 60 * 1000
    const taskItems = store.tasks.filter((task) => task.endDate && task.status !== '处理完成' && new Date(`${task.endDate}T23:59:59`).getTime() <= limit).map((task) => ({ id: `task-${task.id}`, kind: 'task' as const, title: task.name, dueDate: task.endDate as string, taskId: task.id, projectId: task.projectId }))
    const issueItems = store.issues.filter((issue) => issue.status !== '已处理' && issue.endDate && new Date(`${issue.endDate}T23:59:59`).getTime() <= limit).map((issue) => { const task = store.tasks.find((entry) => entry.id === issue.taskId); return { id: `issue-${issue.id}`, kind: 'issue' as const, title: issue.title, dueDate: issue.endDate as string, taskId: issue.taskId, projectId: task?.projectId || '' } })
    return [...taskItems, ...issueItems].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [store.issues, store.tasks])
  const reminderCount = reminders.length
  const visibleTasks = useMemo(() => {
    if (!activeProject) return []
    return store.tasks
      .filter((task) => task.projectId === activeProject.id)
      .filter((task) => !query || [task.name, task.content, task.detail, task.priority, task.status].join(' ').toLocaleLowerCase().includes(query))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [activeProject, query, store.tasks])

  useEffect(() => {
    onRemindersChange?.(reminderCount)
    onReminders?.(reminders)
  }, [onReminders, onRemindersChange, reminderCount, reminders])

  function patchStore(updater: (current: ProjectStore) => ProjectStore) {
    setStore((current) => updater(current))
  }

  async function createProject() {
    const name = projectName.trim()
    if (!name) return
    const project: Project = { id: uid(), spaceId, name, parentId: projectParentId, description: projectDescription.trim(), startDate: projectStartDate || undefined, endDate: projectEndDate || undefined, cost: projectCost.trim(), revenue: projectRevenue.trim(), profit: projectProfit.trim(), progress: 0, status: '调研中', createdAt: Date.now() }
    const results = projectFiles.length ? await Promise.allSettled(projectFiles.map((file) => uploadLocalFile(file, { spaceId, entityType: 'project', entityId: project.id, pathSegments: ['项目', name, '关联文件'] }))) : []
    const attachments = results.flatMap((result) => result.status === 'fulfilled' ? [{ ...result.value, id: result.value.fileId }] : [])
    if (results.some((result) => result.status === 'rejected')) setProjectFileError('部分附件上传失败，请确认已选择本地文件夹并授予写入权限')
    const finalProject = attachments.length ? { ...project, attachments } : project
    patchStore((current) => ({ ...current, projects: [...current.projects, finalProject] }))
    setActiveProjectId(project.id)
    if (projectParentId) setExpandedProjectId(projectParentId)
    setProjectName('')
    resetProjectForm()
    setShowCreateProject(false)
  }

  async function openProjectDetail(project: Project) {
    let localAttachments: NonNullable<ProjectTask['attachments']> = []
    try {
      localAttachments = await listLocalFiles('project', project.id) as NonNullable<ProjectTask['attachments']>
    } catch {
      localAttachments = []
    }
    const attachments = localAttachments?.length ? localAttachments : project.attachments
    setProjectDetailTarget(attachments?.length ? { ...project, attachments } : project)
    setProjectDetailEditing(false)
  }

  function startProjectEdit() {
    if (!projectDetailTarget) return
    setProjectName(projectDetailTarget.name); setProjectDescription(projectDetailTarget.description || ''); setProjectStartDate(projectDetailTarget.startDate || ''); setProjectEndDate(projectDetailTarget.endDate || ''); setProjectCost(projectDetailTarget.cost || ''); setProjectRevenue(projectDetailTarget.revenue || ''); setProjectProfit(projectDetailTarget.profit || '')
    setProjectDetailEditing(true)
  }

  function saveProjectEdit() {
    if (!projectDetailTarget || !projectName.trim()) return
    const next = { ...projectDetailTarget, name: projectName.trim(), description: projectDescription.trim(), startDate: projectStartDate || undefined, endDate: projectEndDate || undefined, cost: projectCost.trim(), revenue: projectRevenue.trim(), profit: projectProfit.trim() }
    patchStore((current) => ({ ...current, projects: current.projects.map((project) => project.id === next.id ? next : project) }))
    setProjectDetailTarget(next); setProjectDetailEditing(false); resetProjectForm()
  }

  function archiveProject(project: Project) {
    patchStore((current) => ({ ...current, projects: current.projects.map((item) => item.id === project.id ? { ...item, archivedAt: Date.now() } : item) }))
    setDeleteTarget(null)
    if (activeProjectId === project.id) setDetailTaskId(null)
  }

  function restoreProject(project: Project) {
    patchStore((current) => ({ ...current, projects: current.projects.map((item) => item.id === project.id ? { ...item, archivedAt: undefined } : item) }))
    setActiveProjectId(project.id)
    setShowArchive(false)
  }

  function createTask() {
    const name = taskName.trim()
    if (!name || !taskStartDate || !taskEndDate || !activeProject) {
      setTaskFormError('请填写任务名称、开始日期和结束日期')
      return
    }
    if (taskEndDate < taskStartDate) {
      setTaskFormError('结束日期不能早于开始日期')
      return
    }
    const taskId = uid()
    const finish = (attachments: ProjectTask['attachments']) => {
      const task: ProjectTask = { id: taskId, projectId: activeProject.id, name, content: taskContent.trim(), detail: taskDetail.trim(), startDate: taskStartDate, endDate: taskEndDate, priority: taskPriority, status: '调研中', progress: 0, createdAt: Date.now(), attachments }
      patchStore((current) => ({ ...current, tasks: [...current.tasks, task] }))
      setTaskName(''); setTaskContent(''); setTaskDetail(''); setTaskStartDate(''); setTaskEndDate(''); setTaskPriority('P1'); setTaskFiles([]); setTaskFileError(''); setTaskFormError(''); setShowCreateTask(false)
    }
    if (taskFiles.length) {
      void Promise.allSettled(taskFiles.map((file) => uploadLocalFile(file, { spaceId, entityType: 'task', entityId: taskId, pathSegments: ['项目', activeProject.name, '任务', name] }))).then(async (results) => {
        if (results.some((result) => result.status === 'rejected')) {
          await Promise.all(results.flatMap((result) => result.status === 'fulfilled' ? [deleteLocalFile(result.value.fileId)] : []))
          setTaskFileError('部分文件上传失败，请确认已选择本地文件夹并授予写入权限')
          return
        }
        finish(results.flatMap((result) => result.status === 'fulfilled' ? [{ ...result.value, id: result.value.fileId }] : []) as ProjectTask['attachments'])
      })
      return
    }
    finish(undefined)
  }

  function deleteTask(task: ProjectTask) {
    void deleteLocalFilesForEntity('task', task.id)
    patchStore((current) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== task.id),
      issues: current.issues.filter((issue) => issue.taskId !== task.id),
    }))
    if (detailTaskId === task.id) setDetailTaskId(null)
    setDeleteTaskTarget(null)
  }

  function updateTaskStatus(taskId: string, status: TaskStatus) {
    patchStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status, updatedAt: Date.now() } : task) }))
  }

  function updateTask(taskId: string, patch: Partial<ProjectTask>) {
    patchStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task) }))
  }

  function addIssue(issue: ProjectIssue) {
    patchStore((current) => ({ ...current, issues: [...current.issues, issue] }))
  }

  function updateIssue(issueId: string, patch: Partial<ProjectIssue>) {
    patchStore((current) => ({ ...current, issues: current.issues.map((issue) => issue.id === issueId ? { ...issue, ...patch, updatedAt: Date.now() } : issue) }))
  }

  function updateProjectStatus(status: ProjectStatus) {
    if (!activeProject) return
    patchStore((current) => ({ ...current, projects: current.projects.map((project) => project.id === activeProject.id ? { ...project, status } : project) }))
    setShowProjectStatus(false)
  }

  function updateProjectProgress(value: string) {
    if (!activeProject) return
    const progress = Math.min(100, Math.max(0, Number(value) || 0))
    setProjectProgress(progress)
    patchStore((current) => ({ ...current, projects: current.projects.map((project) => project.id === activeProject.id ? { ...project, progress } : project) }))
  }

  function updateRetroStore(types: ProjectStore['retroTypes'], retros: ProjectStore['retros']) {
    patchStore((current) => ({ ...current, retroTypes: types, retros }))
  }

  function updateKnowledgeStore(types: ProjectStore['knowledgeTypes'], resources: ProjectStore['knowledgeResources']) {
    patchStore((current) => ({ ...current, knowledgeTypes: types, knowledgeResources: resources }))
  }

  function updateMeetings(meetings: ProjectStore['meetings']) {
    patchStore((current) => ({ ...current, meetings }))
  }

  if (activeTask) {
    return <ProjectTaskDetailPage spaceId={spaceId} projectName={projects.find((project) => project.id === activeTask.projectId)?.name} task={activeTask} issues={store.issues} onStatusChange={updateTaskStatus} onAddIssue={addIssue} onUpdateIssue={updateIssue} onUpdateTask={updateTask} onClose={() => { setDetailTaskId(null); onCloseTask?.() }} />
  }

  if (view === 'retro') {
    return <RetroWorkspace spaceId={spaceId} types={store.retroTypes} retros={store.retros} onChange={updateRetroStore} searchQuery={searchQuery} />
  }

  if (view === 'knowledge') {
    return <KnowledgeWorkspace spaceId={spaceId} types={store.knowledgeTypes} resources={store.knowledgeResources} onChange={updateKnowledgeStore} searchQuery={searchQuery} />
  }

  if (view === 'meeting') {
    return <MeetingWorkspace spaceId={spaceId} meetings={store.meetings} tasks={store.tasks} onChange={updateMeetings} onOpenTask={(taskId) => onOpenTask?.(taskId)} searchQuery={searchQuery} />
  }

  const projectScheduleField = (
    <div className="project-form-schedule">
      <DateRangeField
        label="项目排期"
        startDate={projectStartDate}
        endDate={projectEndDate}
        onChange={(start, end) => {
          setProjectStartDate(start)
          setProjectEndDate(end)
        }}
      />
    </div>
  )

  return (
    <div className="project-manager-board">
      <div className="project-manager__head">
        <div className="project-manager__tabs" role="tablist" aria-label="项目列表">
          {rootProjects.map((rootProject) => {
            const project = activeProject?.parentId === rootProject.id ? activeProject : rootProject
            const childProjects = projects.filter((child) => child.parentId === rootProject.id)
            const expanded = expandedProjectId === rootProject.id
            return <div className={`project-tab-wrap${activeProject?.id === project.id ? ' project-tab-wrap--active' : ''}`} key={rootProject.id}>
              {childProjects.length > 0 && <button type="button" className={`project-tab__expand${expanded ? ' project-tab__expand--open' : ''}`} aria-expanded={expanded} aria-controls={`project-children-${rootProject.id}`} aria-label={`${expanded ? '收起' : '展开'}子项目 ${rootProject.name}`} title="查看子项目" onClick={() => setExpandedProjectId((current) => current === rootProject.id ? null : rootProject.id)}><Icon name="chevronRight" size={13} /></button>}
              <button type="button" role="tab" aria-selected={activeProject?.id === project.id} className="project-tab" onClick={() => { setActiveProjectId(project.id); setDetailTaskId(null); setExpandedProjectId(null) }}>{project.name}</button>
              <button type="button" className="project-tab__add-child" title={`新增 ${project.name} 的子项目`} aria-label={`新增 ${project.name} 的子项目`} onClick={() => { resetProjectForm(project.id); setShowCreateProject(true); setExpandedProjectId(null) }}><Icon name="plus" size={12} /></button>
              <button type="button" className="project-tab__delete" title={`归档项目 ${project.name}`} aria-label={`归档项目 ${project.name}`} onClick={() => { setDeleteTarget(project); setExpandedProjectId(null) }}><Icon name="trash" size={13} /></button>
              {expanded && <div id={`project-children-${rootProject.id}`} className="project-children-popover" role="menu" aria-label={`${rootProject.name} 的子项目`} onClick={(event) => event.stopPropagation()}>
                {activeProject?.parentId === rootProject.id && <button type="button" className="project-children-popover__parent" onClick={() => { setActiveProjectId(rootProject.id); setDetailTaskId(null); setExpandedProjectId(null) }}><Icon name="arrowLeft" size={13} /><span>返回父项目：{rootProject.name}</span></button>}
                <div className="project-children-popover__title">子项目</div>
                {childProjects.map((child) => <button type="button" role="menuitem" className={`project-children-popover__item${activeProject?.id === child.id ? ' project-children-popover__item--active' : ''}`} key={child.id} onClick={() => { setActiveProjectId(child.id); setDetailTaskId(null); setExpandedProjectId(null) }}>{child.name}</button>)}
              </div>}
            </div>
          })}
          <IconButton label="新增项目" size="sm" icon={<Icon name="plus" size={16} />} onClick={() => { resetProjectForm(); setShowCreateProject(true) }} />
          <IconButton label="查看归档项目" size="sm" icon={<Icon name="archive" size={15} />} onClick={() => setShowArchive(true)} />
        </div>
      </div>

      {!activeProject ? (
        <div className="project-manager__empty"><EmptyState title="还没有项目" description="先新增一个项目，再添加需要跟踪的任务。" icon={<Icon name="grid" size={24} />} /></div>
      ) : (
        <div className="project-manager__body">
          <div className="project-manager__project-title"><div><div className="project-manager__eyebrow">当前项目</div><div className="project-manager__project-name-row"><button type="button" className="project-manager__project-name-button" onClick={() => openProjectDetail(activeProject)} title="查看项目详情">{activeProject.name}</button><button type="button" className={`project-status-badge project-status-badge--${projectStatusClass(activeProject.status)}`} onClick={() => setShowProjectStatus(true)} title="修改项目状态">{activeProject.status}<Icon name="chevronDown" size={12} /></button></div></div><Button label="新增任务" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={() => { setTaskFormError(''); setTaskFileError(''); setTaskFiles([]); setShowCreateTask(true) }} className="project-manager__task-add" /></div>
          <div className="status-groups-shell project-task-groups-shell">
            <div className="status-groups project-task-groups">
              {TASK_STATUSES.map((status) => {
                const tasks = visibleTasks.filter((task) => task.status === status)
                return <Card padding={0} variant="muted" className={`status-group status-group--${statusClass(status)}`} key={status}>
                  <div className="status-group__head"><BoardLaneHeading name={status} count={tasks.length} variant={status === '调研中' ? 'neutral' : status === '处理中' ? 'accent' : 'success'} /></div>
                  <div className="status-group__body-shell"><div className="status-group__body">{tasks.length === 0 ? <div className="status-group__empty">暂无任务</div> : tasks.map((task) => <div className="req-card-wrap project-task-card-wrap" key={task.id}><ClickableCard label={`${task.name}，查看任务详情`} padding={0} className="req-card project-task-card" onClick={() => setDetailTaskId(task.id)}><div className="req-card__top"><span className="req-card__ver">任务</span><span className={`pri pri--${task.priority.toLowerCase()}`}>{task.priority}</span></div><div className="req-card__name">{task.name}</div>{task.content && <div className="req-card__content">{task.content}</div>}</ClickableCard><div className="req-card__bottom-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="req-card__delete" onClick={() => setDeleteTaskTarget(task)} title={`删除 ${task.name}`} aria-label={`删除 ${task.name}`}><span className="icon-circle"><Icon name="trash" size={13} /></span></button></div></div>)}</div></div>
                </Card>
              })}
            </div>
          </div>
        </div>
      )}

      {showProjectStatus && activeProject && (
        <WorkspaceOverlay label="项目进度" onClose={() => setShowProjectStatus(false)}>
          <div className="modal modal--wide project-status-modal">
            <Heading level={3} accessibilityLevel={2} className="modal__title">项目进度</Heading>
            <div className="project-status-modal__fields">
              <div>
                <div className="field-label">项目状态</div>
                <div className="project-status-modal__status-scroll">
                  <SegmentedControl label="项目状态" value={activeProject.status} layout="fill" onChange={(status) => updateProjectStatus(status as ProjectStatus)}>
                    {PROJECT_STATUSES.map((status) => <SegmentedControlItem key={status} value={status} label={status} />)}
                  </SegmentedControl>
                </div>
              </div>
              <NumberInput
                label="项目进度"
                value={projectProgress}
                width={180}
                min={0}
                max={100}
                units="%"
                isWheelEnabled={false}
                onChange={(nextValue) => updateProjectProgress(String(nextValue))}
              />
            </div>
            <div className="modal__actions"><Button label="关闭" variant="ghost" type="button" onClick={() => setShowProjectStatus(false)} /></div>
          </div>
        </WorkspaceOverlay>
      )}
      {showCreateProject && <WorkspaceOverlay label="新增项目" onClose={() => setShowCreateProject(false)}><div className="modal modal--wide project-task-create-modal project-form-modal"><div className="project-task-create-modal__content"><Heading level={3} accessibilityLevel={2} className="modal__title">新增项目</Heading><div className="field-label">项目名称</div><TextInput label="项目名称" isLabelHidden width="100%" value={projectName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createProject() } }} placeholder="输入项目名称" hasAutoFocus onChange={setProjectName} /><div className="field-label collection-field-gap">所属父项目</div><TextInput label="父项目" value={projectParentId ? projects.find((project) => project.id === projectParentId)?.name || '' : '顶层项目'} isLabelHidden width="100%" isReadOnly onChange={() => undefined} /><div className="field-label collection-field-gap">项目简介</div><TextArea label="项目简介" isLabelHidden width="100%" rows={3} value={projectDescription} placeholder="输入项目简介" onChange={setProjectDescription} /><div className="project-form-grid">{projectScheduleField}<div>成本<TextInput label="支出" value={projectCost} isLabelHidden width="100%" onChange={setProjectCost} /></div><div>收入<TextInput label="收入" value={projectRevenue} isLabelHidden width="100%" onChange={setProjectRevenue} /></div><div>利润<TextInput label="利润" value={projectProfit} isLabelHidden width="100%" onChange={setProjectProfit} /></div></div><div className="field-label collection-field-gap">关联文件</div><AttachmentPicker label="添加项目关联文件" description={projectFiles.length ? `已选择 ${projectFiles.length} 个文件` : undefined} onFiles={(files) => setProjectFiles((current) => [...current, ...files].slice(0, 20))} />{projectFileError && <Banner status="error" title={<>{projectFileError}</>} />}</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setShowCreateProject(false)} /><Button label="创建项目" variant="primary" type="button" onClick={() => void createProject()} style={{ opacity: projectName.trim() ? 1 : .45 }} /></div></div></WorkspaceOverlay>}
      {projectDetailTarget && <WorkspaceOverlay label="编辑项目" onClose={() => setProjectDetailTarget(null)}><div className="modal modal--wide project-detail-modal">{projectDetailEditing ? <><Heading level={3} accessibilityLevel={2} className="modal__title">编辑项目</Heading><div className="field-label">项目名称</div><TextInput label="项目名称" value={projectName} isLabelHidden width="100%" hasAutoFocus onChange={setProjectName} /><div className="field-label collection-field-gap">项目简介</div><TextArea label="项目说明" value={projectDescription} isLabelHidden width="100%" rows={3} onChange={setProjectDescription} /><div className="project-form-grid">{projectScheduleField}<div>成本<TextInput label="支出" value={projectCost} isLabelHidden width="100%" onChange={setProjectCost} /></div><div>收入<TextInput label="收入" value={projectRevenue} isLabelHidden width="100%" onChange={setProjectRevenue} /></div><div>利润<TextInput label="利润" value={projectProfit} isLabelHidden width="100%" onChange={setProjectProfit} /></div></div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setProjectDetailEditing(false)} /><Button label="保存" variant="primary" type="button" onClick={saveProjectEdit} /></div></> : <><div className="modal__title-row"><Heading level={3} accessibilityLevel={2} className="modal__title">{projectDetailTarget.name}</Heading><IconButton label="编辑项目" variant="ghost" size="sm" icon={<Icon name="edit" size={15} />} type="button" onClick={startProjectEdit} /></div><div className="project-detail-meta">{projectDetailTarget.parentId ? `所属父项目：${projects.find((project) => project.id === projectDetailTarget.parentId)?.name || '未找到'}` : '顶层项目'}</div><div className="project-detail-description">{projectDetailTarget.description || '暂无项目简介'}</div><div className="project-detail-grid"><div><span>项目状态</span><strong>{projectDetailTarget.status}</strong></div><div><span>项目进度</span><strong>{projectDetailTarget.progress || 0}%</strong></div><div><span>项目排期</span><strong>{projectDetailTarget.startDate || '未设置'} 至 {projectDetailTarget.endDate || '未设置'}</strong></div><div><span>成本</span><strong>{projectDetailTarget.cost || '未设置'}</strong></div><div><span>收入</span><strong>{projectDetailTarget.revenue || '未设置'}</strong></div><div><span>利润</span><strong>{projectDetailTarget.profit || '未设置'}</strong></div></div><div className="project-detail-files"><div className="field-label">关联文件</div>{projectDetailTarget.attachments?.length ? <FileAttachmentList files={projectDetailTarget.attachments} /> : <div className="project-detail-files__empty">暂无关联文件</div>}</div><div className="modal__actions"><Button label="关闭" variant="primary" type="button" onClick={() => setProjectDetailTarget(null)} /></div></>}</div></WorkspaceOverlay>}
      {showCreateTask && <WorkspaceOverlay label="新增任务" onClose={() => setShowCreateTask(false)}><div className="modal modal--wide project-task-create-modal"><div className="project-task-create-modal__content"><Heading level={3} accessibilityLevel={2} className="modal__title">新增任务</Heading><div className="field-label">任务名称 <span className="field-required">*</span></div><TextInput label="任务名称" value={taskName} isLabelHidden width="100%" status={taskFormError && !taskName.trim() ? { type: 'error' } : undefined} isRequired hasAutoFocus onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); createTask() } }} placeholder="一句话描述要完成的任务" onChange={(nextValue) => { setTaskName(nextValue); setTaskFormError('') }} />
          <div className="task-schedule-row">
            <DateRangeField
              label="任务排期"
              startDate={taskStartDate}
              endDate={taskEndDate}
              required
              onChange={(start, end) => {
                setTaskStartDate(start)
                setTaskEndDate(end)
                setTaskFormError('')
              }}
            />
            <div>
              <div className="field-label">优先级</div>
              <SegmentedControl label="优先级" value={taskPriority} onChange={(value) => setTaskPriority(value as Priority)}>
                {PRIORITIES.map((priority) => <SegmentedControlItem key={priority} value={priority} label={priority} />)}
              </SegmentedControl>
            </div>
          </div>
          {taskFormError && <Banner status="error" title={<>{taskFormError}</>} />}<div className="field-label" style={{ marginTop: 16 }}>任务说明</div><TextArea label="任务说明" isLabelHidden width="100%" rows={3} value={taskContent} placeholder="目标、验收标准或执行说明…" onChange={setTaskContent} /><div className="field-label" style={{ marginTop: 16 }}>补充详情</div><TextArea label="补充详情" isLabelHidden width="100%" rows={3} value={taskDetail} placeholder="可选：负责人、依赖和备注…" onChange={setTaskDetail} /><div className="field-label" style={{ marginTop: 16 }}>关联文件</div><AttachmentPicker label="添加任务关联文件" description={taskFiles.length ? `已选择 ${taskFiles.length} 个文件` : undefined} onFiles={(files) => setTaskFiles((current) => [...current, ...files].slice(0, 20))} />{taskFileError && <Banner status="error" title={<>{taskFileError}</>} />}</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => { setTaskFiles([]); setTaskFileError(''); setShowCreateTask(false) }} /><Button label="创建任务" variant="primary" type="button" onClick={createTask} style={{ opacity: taskName.trim() && taskStartDate && taskEndDate ? 1 : .45 }} /></div></div></WorkspaceOverlay>}
      {deleteTaskTarget && <WorkspaceOverlay label="确认删除任务？" onClose={() => setDeleteTaskTarget(null)}><div className="modal delete-confirm-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">确认删除任务？</Heading><div className="delete-confirm-modal__text">删除「{deleteTaskTarget.name}」后，任务及其关联的问题记录也会一并移除。</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setDeleteTaskTarget(null)} /><Button label="确认删除" variant="destructive" type="button" onClick={() => deleteTask(deleteTaskTarget)} /></div></div></WorkspaceOverlay>}
      {deleteTarget && <WorkspaceOverlay label="确认归档项目？" onClose={() => setDeleteTarget(null)}><div className="modal delete-confirm-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">确认归档项目？</Heading><div className="delete-confirm-modal__text">归档「{deleteTarget.name}」后，它会从当前项目列表隐藏，可在归档列表中恢复。</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setDeleteTarget(null)} /><Button label="确认归档" variant="destructive" type="button" onClick={() => archiveProject(deleteTarget)} /></div></div></WorkspaceOverlay>}
      {showArchive && <WorkspaceOverlay label="归档项目" onClose={() => setShowArchive(false)}><div className="modal project-archive-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">归档项目</Heading>{archivedProjects.length === 0 ? <div className="project-archive__empty">暂无归档项目</div> : <div className="project-archive__list">{archivedProjects.map((project) => <ClickableCard padding={0} className="project-archive__item" key={project.id} label={`查看归档项目 ${project.name}`} onClick={() => void openProjectDetail(project)}><div><div className="project-archive__name">{project.name}</div><div className="project-archive__date">归档于 {new Date(project.archivedAt || project.createdAt).toLocaleDateString('zh-CN')}</div></div><Button label="恢复" variant="ghost" type="button" onClick={() => restoreProject(project)} /></ClickableCard>)}</div>}<div className="modal__actions"><Button label="关闭" variant="ghost" type="button" onClick={() => setShowArchive(false)} /></div></div></WorkspaceOverlay>}
    </div>
  )
}
