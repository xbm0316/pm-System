import { useMemo, useState } from 'react'
import Icon from './Icon'
import DateRangePicker from './DateRangePicker'
import type { Project, ProjectIssue, ProjectSummary, ProjectSummaryRow, ProjectTask } from '../lib/store'

interface Props {
  projects: Project[]
  tasks: ProjectTask[]
  issues: ProjectIssue[]
  summaries: ProjectSummary[]
  onChange: (summaries: ProjectSummary[]) => void
  onClose: () => void
}

function dayDiff(date: string, endDate: string) {
  if (!date) return 0
  return Math.max(0, Math.ceil((new Date(`${endDate}T23:59:59`).getTime() - new Date(`${date}T23:59:59`).getTime()) / 86400000))
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString('zh-CN')
}

function SummaryTable({ title, rows, pending = false }: { title: string; rows: ProjectSummaryRow[]; pending?: boolean }) {
  return <section className="summary-section"><h3>{title}</h3>{rows.length ? <div className="summary-table-wrap"><table className="summary-table"><thead><tr><th>序号</th><th>名称</th><th>{pending ? '预计完成时间' : title.includes('任务') ? '完成时间' : '解决时间'}</th>{pending && <th>延期天数</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.name}</td><td>{row.date || '未设置'}</td>{pending && <td>{row.overdueDays || 0}</td>}</tr>)}</tbody></table></div> : <div className="summary-empty">暂无记录</div>}</section>
}

export default function SummaryWorkspace({ projects, tasks, issues, summaries, onChange, onClose }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<ProjectSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)
  const [projectId, setProjectId] = useState(projects.find((project) => !project.archivedAt)?.id || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const projectSummaries = useMemo(() => summaries.filter((item) => !projectId || item.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt), [projectId, summaries])
  const activeProject = projects.find((project) => project.id === projectId)

  function openCreate() { setStartDate(''); setEndDate(''); setError(''); setShowCreate(true) }
  function createSummary() {
    if (!projectId) return setError('请选择项目')
    if (!startDate || !endDate) return setError('请选择总结时间段')
    if (endDate < startDate) return setError('结束日期不能早于开始日期')
    const projectTasks = tasks.filter((task) => task.projectId === projectId)
    const taskIds = new Set(projectTasks.map((task) => task.id))
    const projectIssues = issues.filter((issue) => taskIds.has(issue.taskId))
    const completedTasks = projectTasks.filter((task) => task.status === '任务结束' && (task.updatedAt || task.createdAt) >= new Date(`${startDate}T00:00:00`).getTime() && (task.updatedAt || task.createdAt) <= new Date(`${endDate}T23:59:59`).getTime()).map((task) => ({ id: task.id, name: task.name, date: formatDate(task.updatedAt || task.createdAt) }))
    const pendingTasks = projectTasks.filter((task) => task.status !== '任务结束' && task.endDate && task.endDate >= startDate && task.endDate <= endDate).map((task) => ({ id: task.id, name: task.name, date: task.endDate || '', overdueDays: task.endDate && task.endDate < new Date().toISOString().slice(0, 10) ? dayDiff(task.endDate, new Date().toISOString().slice(0, 10)) : 0 }))
    const completedIssues = projectIssues.filter((issue) => issue.status === '已处理' && (issue.updatedAt || issue.createdAt) >= new Date(`${startDate}T00:00:00`).getTime() && (issue.updatedAt || issue.createdAt) <= new Date(`${endDate}T23:59:59`).getTime()).map((issue) => ({ id: issue.id, name: issue.title, date: formatDate(issue.updatedAt || issue.createdAt) }))
    const pendingIssues = projectIssues.filter((issue) => issue.status !== '已处理' && issue.endDate && issue.endDate >= startDate && issue.endDate <= endDate).map((issue) => ({ id: issue.id, name: issue.title, date: issue.endDate || '', overdueDays: issue.endDate && issue.endDate < new Date().toISOString().slice(0, 10) ? dayDiff(issue.endDate, new Date().toISOString().slice(0, 10)) : 0 }))
    const summary: ProjectSummary = { id: `summary-${Date.now().toString(36)}`, projectId, startDate, endDate, projectProgress: `${activeProject?.progress || 0}%`, projectStatus: activeProject?.status, projectProgressPercent: activeProject?.progress || 0, completedTasks, pendingTasks, completedIssues, pendingIssues, createdAt: Date.now() }
    onChange([summary, ...summaries]); setShowCreate(false); setDetail(summary)
  }
  function syncSummary(summary: ProjectSummary) {
    const project = projects.find((item) => item.id === summary.projectId)
    if (!project) return
    const projectTasks = tasks.filter((task) => task.projectId === summary.projectId)
    const taskIds = new Set(projectTasks.map((task) => task.id))
    const projectIssues = issues.filter((issue) => taskIds.has(issue.taskId))
    const completedTasks = projectTasks.filter((task) => task.status === '任务结束' && (task.updatedAt || task.createdAt) >= new Date(`${summary.startDate}T00:00:00`).getTime() && (task.updatedAt || task.createdAt) <= new Date(`${summary.endDate}T23:59:59`).getTime()).map((task) => ({ id: task.id, name: task.name, date: formatDate(task.updatedAt || task.createdAt) }))
    const pendingTasks = projectTasks.filter((task) => task.status !== '任务结束' && task.endDate && task.endDate >= summary.startDate && task.endDate <= summary.endDate).map((task) => ({ id: task.id, name: task.name, date: task.endDate || '', overdueDays: task.endDate && task.endDate < new Date().toISOString().slice(0, 10) ? dayDiff(task.endDate, new Date().toISOString().slice(0, 10)) : 0 }))
    const completedIssues = projectIssues.filter((issue) => issue.status === '已处理' && (issue.updatedAt || issue.createdAt) >= new Date(`${summary.startDate}T00:00:00`).getTime() && (issue.updatedAt || issue.createdAt) <= new Date(`${summary.endDate}T23:59:59`).getTime()).map((issue) => ({ id: issue.id, name: issue.title, date: formatDate(issue.updatedAt || issue.createdAt) }))
    const pendingIssues = projectIssues.filter((issue) => issue.status !== '已处理' && issue.endDate && issue.endDate >= summary.startDate && issue.endDate <= summary.endDate).map((issue) => ({ id: issue.id, name: issue.title, date: issue.endDate || '', overdueDays: issue.endDate && issue.endDate < new Date().toISOString().slice(0, 10) ? dayDiff(issue.endDate, new Date().toISOString().slice(0, 10)) : 0 }))
    const next = { ...summary, projectProgress: `${project.progress || 0}%`, projectStatus: project.status, projectProgressPercent: project.progress || 0, completedTasks, pendingTasks, completedIssues, pendingIssues }
    onChange(summaries.map((item) => item.id === summary.id ? next : item)); setDetail(next)
  }
  function removeSummary(summary: ProjectSummary) { onChange(summaries.filter((item) => item.id !== summary.id)); setDeleteTarget(null); setDetail(null) }

    return <div className="overlay summary-overlay" onClick={onClose}><div className="modal modal--wide summary-list-modal" onClick={(event) => event.stopPropagation()}><div className="summary-list-head"><div><div className="modal__title">总结记录</div><div className="collection-detail__meta">按项目查看已生成的阶段总结</div></div><button type="button" className="btn-primary" onClick={openCreate}><Icon name="plus" size={14} /> 新增总结</button></div><div className="summary-project-filter"><label>项目<select className="text-input" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div><div className="summary-list">{projectSummaries.length ? projectSummaries.map((summary) => <div className="summary-list__item" key={summary.id}><button type="button" className="summary-list__item-main" onClick={() => setDetail(summary)}><span>{summary.startDate} 至 {summary.endDate}</span><strong>{projects.find((project) => project.id === summary.projectId)?.name || '项目总结'}</strong><small>任务 {summary.completedTasks.length + summary.pendingTasks.length} · 问题 {summary.completedIssues.length + summary.pendingIssues.length}</small></button><div className="summary-list__actions"><button type="button" className="summary-list__sync" onClick={() => syncSummary(summary)} title="重新同步" aria-label={`重新同步总结 ${summary.startDate} 至 ${summary.endDate}`}><Icon name="refresh" size={13} /></button><button type="button" className="summary-list__delete" onClick={() => setDeleteTarget(summary)} title="删除总结" aria-label={`删除总结 ${summary.startDate} 至 ${summary.endDate}`}><Icon name="trash" size={13} /></button></div></div>) : <div className="summary-empty">暂无总结记录</div>}</div><div className="modal__actions"><button type="button" className="btn-primary" onClick={onClose}>关闭</button></div></div>
    {showCreate && <div className="overlay summary-create-overlay" onClick={() => setShowCreate(false)}><form className="modal modal--wide summary-create-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); createSummary() }}><div className="modal__title">新增总结</div><div className="field-label">项目</div><select className="text-input" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><div className="field-label collection-field-gap">总结时间段 <span className="field-required">*</span></div><DateRangePicker startDate={startDate} endDate={endDate} onApply={(start, end) => { setStartDate(start); setEndDate(end) }} label="选择总结时间段" />{error && <div className="form-error">{error}</div>}<div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>取消</button><button type="submit" className="btn-primary">生成总结</button></div></form></div>}
    {detail && <div className="overlay summary-detail-overlay" onClick={() => setDetail(null)}><div className="modal modal--wide summary-detail-modal" onClick={(event) => event.stopPropagation()}><div className="summary-list-head"><div><div className="modal__title">{projects.find((project) => project.id === detail.projectId)?.name || '项目总结'}</div><div className="collection-detail__meta">{detail.startDate} 至 {detail.endDate}</div></div></div><section className="summary-progress"><h3>项目状态</h3><div>{detail.projectStatus || projects.find((project) => project.id === detail.projectId)?.status || '暂无状态'} · {detail.projectProgressPercent ?? projects.find((project) => project.id === detail.projectId)?.progress ?? detail.projectProgress}</div></section><SummaryTable title="完成的任务" rows={detail.completedTasks} /><SummaryTable title="未完成的任务" rows={detail.pendingTasks} pending /><SummaryTable title="完成的问题" rows={detail.completedIssues} /><SummaryTable title="未完成的问题" rows={detail.pendingIssues} pending /><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => syncSummary(detail)}><Icon name="refresh" size={13} /> 重新同步</button><button type="button" className="btn-ghost btn-ghost--danger" onClick={() => setDeleteTarget(detail)}><Icon name="trash" size={13} /> 删除总结</button><button type="button" className="btn-primary" onClick={() => setDetail(null)}>关闭</button></div></div></div>}
    {deleteTarget && <div className="overlay summary-delete-overlay" onClick={() => setDeleteTarget(null)}><div className="modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal__title">确认删除总结？</div><div className="delete-confirm-modal__text">删除「{deleteTarget.startDate} 至 {deleteTarget.endDate}」的总结后无法恢复。</div><div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>取消</button><button type="button" className="btn-primary btn-primary--danger" onClick={() => removeSummary(deleteTarget)}>确认删除</button></div></div></div>}
  </div>
}
