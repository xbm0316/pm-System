import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import ProjectTaskDetailPage from './ProjectTaskDetailPage'
import { PRIORITIES, REQ_STATUSES, uid, type Priority, type Project, type ProjectIssue, type ProjectStore, type ProjectTask, type RequirementStatus } from '../lib/store'

interface Props {
  spaceId: string
  searchQuery?: string
}

const STORAGE_PREFIX = 'jawcat.project-manager.v3.'

function readStore(spaceId: string): ProjectStore {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`)
    if (!raw) return { projects: [], tasks: [], issues: [] }
    const parsed = JSON.parse(raw) as Partial<ProjectStore>
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    }
  } catch {
    return { projects: [], tasks: [], issues: [] }
  }
}

function statusClass(status: RequirementStatus) {
  return status === '调研中' ? 'research' : status === '已评审' ? 'reviewed' : status === '开发中' ? 'development' : status === '测试中' ? 'testing' : 'live'
}

export default function ProjectManagerBoard({ spaceId, searchQuery = '' }: Props) {
  const [store, setStore] = useState<ProjectStore>(() => readStore(spaceId))
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => readStore(spaceId).projects.find((project) => !project.archivedAt)?.id || null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [projectName, setProjectName] = useState('')
  const [taskName, setTaskName] = useState('')
  const [taskContent, setTaskContent] = useState('')
  const [taskDetail, setTaskDetail] = useState('')
  const [taskStartDate, setTaskStartDate] = useState('')
  const [taskEndDate, setTaskEndDate] = useState('')
  const [taskPriority, setTaskPriority] = useState<Priority>('P1')

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${spaceId}`, JSON.stringify(store))
  }, [spaceId, store])

  useEffect(() => {
    const current = store.projects.find((project) => project.id === activeProjectId && !project.archivedAt)
    if (!current) setActiveProjectId(store.projects.find((project) => !project.archivedAt)?.id || null)
    if (detailTaskId && !store.tasks.some((task) => task.id === detailTaskId)) setDetailTaskId(null)
  }, [store.projects, store.tasks, activeProjectId, detailTaskId])

  const query = searchQuery.trim().toLocaleLowerCase()
  const projects = store.projects.filter((project) => !project.archivedAt)
  const archivedProjects = store.projects.filter((project) => project.archivedAt).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0))
  const activeProject = projects.find((project) => project.id === activeProjectId) || null
  const activeTask = store.tasks.find((task) => task.id === detailTaskId) || null
  const visibleTasks = useMemo(() => {
    if (!activeProject) return []
    return store.tasks
      .filter((task) => task.projectId === activeProject.id)
      .filter((task) => !query || [task.name, task.content, task.detail, task.priority, task.status].join(' ').toLocaleLowerCase().includes(query))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [activeProject, query, store.tasks])

  function patchStore(updater: (current: ProjectStore) => ProjectStore) {
    setStore((current) => updater(current))
  }

  function createProject() {
    const name = projectName.trim()
    if (!name) return
    const project: Project = { id: uid(), spaceId, name, createdAt: Date.now() }
    patchStore((current) => ({ ...current, projects: [...current.projects, project] }))
    setActiveProjectId(project.id)
    setProjectName('')
    setShowCreateProject(false)
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
    if (!name || !activeProject) return
    const task: ProjectTask = { id: uid(), projectId: activeProject.id, name, content: taskContent.trim(), detail: taskDetail.trim(), startDate: taskStartDate, endDate: taskEndDate, priority: taskPriority, status: '调研中', createdAt: Date.now() }
    patchStore((current) => ({ ...current, tasks: [...current.tasks, task] }))
    setTaskName('')
    setTaskContent('')
    setTaskDetail('')
    setTaskStartDate('')
    setTaskEndDate('')
    setTaskPriority('P1')
    setShowCreateTask(false)
  }

  function updateTaskStatus(taskId: string, status: RequirementStatus) {
    patchStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status } : task) }))
  }

  function updateTask(taskId: string, patch: Partial<ProjectTask>) {
    patchStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task) }))
  }

  function addIssue(issue: ProjectIssue) {
    patchStore((current) => ({ ...current, issues: [...current.issues, issue] }))
  }

  function updateIssue(issueId: string, patch: Partial<ProjectIssue>) {
    patchStore((current) => ({ ...current, issues: current.issues.map((issue) => issue.id === issueId ? { ...issue, ...patch } : issue) }))
  }

  if (activeTask) {
    return <ProjectTaskDetailPage task={activeTask} issues={store.issues} onStatusChange={updateTaskStatus} onAddIssue={addIssue} onUpdateIssue={updateIssue} onUpdateTask={updateTask} onClose={() => setDetailTaskId(null)} />
  }

  return (
    <div className="project-manager-board">
      <div className="project-manager__head">
        <div className="project-manager__tabs" role="tablist" aria-label="项目列表">
          {projects.map((project) => (
            <div className={`project-tab-wrap${activeProject?.id === project.id ? ' project-tab-wrap--active' : ''}`} key={project.id}>
              <button type="button" role="tab" aria-selected={activeProject?.id === project.id} className="project-tab" onClick={() => { setActiveProjectId(project.id); setDetailTaskId(null) }}>{project.name}</button>
              <button type="button" className="project-tab__delete" title={`归档项目 ${project.name}`} aria-label={`归档项目 ${project.name}`} onClick={() => setDeleteTarget(project)}><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <button type="button" className="project-manager__add" onClick={() => setShowCreateProject(true)} title="新增项目" aria-label="新增项目"><Icon name="plus" size={16} /></button>
          <button type="button" className="project-manager__archive" onClick={() => setShowArchive(true)} title="查看归档项目" aria-label="查看归档项目"><Icon name="archive" size={15} /></button>
        </div>
      </div>

      {!activeProject ? (
        <div className="project-manager__empty"><div className="project-manager__empty-icon"><Icon name="grid" size={18} /></div><div>还没有项目</div><span>点击上方 + 新增项目后开始管理任务</span></div>
      ) : (
        <div className="project-manager__body">
          <div className="project-manager__project-title"><div><div className="project-manager__eyebrow">当前项目</div><h1>{activeProject.name}</h1></div><button type="button" className="btn-primary project-manager__task-add" onClick={() => setShowCreateTask(true)}><Icon name="plus" size={14} /> 新增任务</button></div>
          <div className="status-groups-shell project-task-groups-shell">
            <div className="status-groups project-task-groups">
              {REQ_STATUSES.map((status) => {
                const tasks = visibleTasks.filter((task) => task.status === status)
                return <div className={`status-group status-group--${statusClass(status)}`} key={status}>
                  <div className="status-group__head"><span className="status-group__name">{status}</span><span className="status-group__count">{tasks.length}</span></div>
                  <div className="status-group__body-shell"><div className="status-group__body">{tasks.length === 0 ? <div className="status-group__empty">暂无任务</div> : tasks.map((task) => <button type="button" className="req-card project-task-card" key={task.id} onClick={() => setDetailTaskId(task.id)}><div className="req-card__top"><span className="req-card__ver">任务</span><span className={`pri pri--${task.priority.toLowerCase()}`}>{task.priority}</span></div><div className="req-card__name">{task.name}</div>{task.content && <div className="req-card__content">{task.content}</div>}</button>)}</div></div>
                </div>
              })}
            </div>
          </div>
        </div>
      )}

      {showCreateProject && <div className="overlay" onClick={() => setShowCreateProject(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">新增项目</div><div className="field-label">项目名称</div><input className="text-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="输入项目名称" autoFocus /><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowCreateProject(false)}>取消</button><button type="button" className="btn-primary" onClick={createProject} style={{ opacity: projectName.trim() ? 1 : .45 }}>创建项目</button></div></div></div>}
      {showCreateTask && <div className="overlay" onClick={() => setShowCreateTask(false)}><div className="modal modal--wide" onClick={(event) => event.stopPropagation()}><div className="modal__title">新增任务</div><div className="field-label">任务名称</div><input className="text-input" value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="一句话描述要完成的任务" autoFocus /><div className="field-label" style={{ marginTop: 16 }}>任务排期</div><div className="project-task-schedule-edit"><label>开始日期<input className="text-input" type="date" value={taskStartDate} onChange={(event) => setTaskStartDate(event.target.value)} /></label><label>结束日期<input className="text-input" type="date" value={taskEndDate} onChange={(event) => setTaskEndDate(event.target.value)} /></label></div><div className="field-label" style={{ marginTop: 16 }}>任务说明</div><textarea className="text-area" rows={3} value={taskContent} onChange={(event) => setTaskContent(event.target.value)} placeholder="目标、验收标准或执行说明…" /><div className="field-label" style={{ marginTop: 16 }}>补充详情</div><textarea className="text-area" rows={3} value={taskDetail} onChange={(event) => setTaskDetail(event.target.value)} placeholder="可选：负责人、依赖和备注…" /><div className="field-label" style={{ marginTop: 16 }}>优先级</div><div className="chip-row">{PRIORITIES.map((priority) => <button type="button" className={`chip${taskPriority === priority ? ' chip--on' : ''}`} key={priority} onClick={() => setTaskPriority(priority)}>{priority}</button>)}</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowCreateTask(false)}>取消</button><button type="button" className="btn-primary" onClick={createTask} style={{ opacity: taskName.trim() ? 1 : .45 }}>创建任务</button></div></div></div>}
      {deleteTarget && <div className="overlay" onClick={() => setDeleteTarget(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认归档项目？</div><div className="delete-confirm-modal__text">归档「{deleteTarget.name}」后，它会从当前项目列表隐藏，可在归档列表中恢复。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={() => archiveProject(deleteTarget)}>确认归档</button></div></div></div>}
      {showArchive && <div className="overlay" onClick={() => setShowArchive(false)}><div className="modal project-archive-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">归档项目</div>{archivedProjects.length === 0 ? <div className="project-archive__empty">暂无归档项目</div> : <div className="project-archive__list">{archivedProjects.map((project) => <div className="project-archive__item" key={project.id}><div><div className="project-archive__name">{project.name}</div><div className="project-archive__date">归档于 {new Date(project.archivedAt || project.createdAt).toLocaleDateString('zh-CN')}</div></div><button type="button" className="btn-ghost" onClick={() => restoreProject(project)}>恢复</button></div>)}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowArchive(false)}>关闭</button></div></div></div>}
    </div>
  )
}
