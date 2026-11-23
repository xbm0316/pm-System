import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@astryxdesign/core/Table'
import { Selector } from '@astryxdesign/core/Selector'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { Button } from '@astryxdesign/core/Button'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { useMemo, useState } from 'react'
import Icon from './Icon'
import DateRangeField from './DateRangeField'
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
  return <section className="summary-section"><h3>{title}</h3>{rows.length ? <div className="summary-table-wrap"><Table density="compact" className="summary-table"><TableHeader><TableRow><TableHeaderCell>序号</TableHeaderCell><TableHeaderCell>名称</TableHeaderCell><TableHeaderCell>{pending ? '预计完成时间' : title.includes('任务') ? '完成时间' : '解决时间'}</TableHeaderCell>{pending && <TableHeaderCell>延期天数</TableHeaderCell>}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={row.id}><TableCell>{index + 1}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.date || '未设置'}</TableCell>{pending && <TableCell>{row.overdueDays || 0}</TableCell>}</TableRow>)}</TableBody></Table></div> : <div className="summary-empty">暂无记录</div>}</section>
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
    const completedTasks = projectTasks.filter((task) => task.status === '处理完成' && (task.updatedAt || task.createdAt) >= new Date(`${startDate}T00:00:00`).getTime() && (task.updatedAt || task.createdAt) <= new Date(`${endDate}T23:59:59`).getTime()).map((task) => ({ id: task.id, name: task.name, date: formatDate(task.updatedAt || task.createdAt) }))
    const pendingTasks = projectTasks.filter((task) => task.status !== '处理完成' && task.endDate && task.endDate >= startDate && task.endDate <= endDate).map((task) => ({ id: task.id, name: task.name, date: task.endDate || '', overdueDays: task.endDate && task.endDate < new Date().toISOString().slice(0, 10) ? dayDiff(task.endDate, new Date().toISOString().slice(0, 10)) : 0 }))
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
    const completedTasks = projectTasks.filter((task) => task.status === '处理完成' && (task.updatedAt || task.createdAt) >= new Date(`${summary.startDate}T00:00:00`).getTime() && (task.updatedAt || task.createdAt) <= new Date(`${summary.endDate}T23:59:59`).getTime()).map((task) => ({ id: task.id, name: task.name, date: formatDate(task.updatedAt || task.createdAt) }))
    const pendingTasks = projectTasks.filter((task) => task.status !== '处理完成' && task.endDate && task.endDate >= summary.startDate && task.endDate <= summary.endDate).map((task) => ({ id: task.id, name: task.name, date: task.endDate || '', overdueDays: task.endDate && task.endDate < new Date().toISOString().slice(0, 10) ? dayDiff(task.endDate, new Date().toISOString().slice(0, 10)) : 0 }))
    const completedIssues = projectIssues.filter((issue) => issue.status === '已处理' && (issue.updatedAt || issue.createdAt) >= new Date(`${summary.startDate}T00:00:00`).getTime() && (issue.updatedAt || issue.createdAt) <= new Date(`${summary.endDate}T23:59:59`).getTime()).map((issue) => ({ id: issue.id, name: issue.title, date: formatDate(issue.updatedAt || issue.createdAt) }))
    const pendingIssues = projectIssues.filter((issue) => issue.status !== '已处理' && issue.endDate && issue.endDate >= summary.startDate && issue.endDate <= summary.endDate).map((issue) => ({ id: issue.id, name: issue.title, date: issue.endDate || '', overdueDays: issue.endDate && issue.endDate < new Date().toISOString().slice(0, 10) ? dayDiff(issue.endDate, new Date().toISOString().slice(0, 10)) : 0 }))
    const next = { ...summary, projectProgress: `${project.progress || 0}%`, projectStatus: project.status, projectProgressPercent: project.progress || 0, completedTasks, pendingTasks, completedIssues, pendingIssues }
    onChange(summaries.map((item) => item.id === summary.id ? next : item)); setDetail(next)
  }
  function removeSummary(summary: ProjectSummary) { onChange(summaries.filter((item) => item.id !== summary.id)); setDeleteTarget(null); setDetail(null) }

    return <WorkspaceOverlay label="项目总结" onClose={onClose}><div className="modal modal--wide summary-list-modal"><div className="summary-list-head"><div><Heading level={3} accessibilityLevel={2} className="modal__title">总结记录</Heading><div className="collection-detail__meta">按项目查看已生成的阶段总结</div></div><Button label="新增总结" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={openCreate} /></div><div className="summary-project-filter"><Selector label="项目" width="100%" value={projectId} onChange={setProjectId} options={projects.map(({ id, name }) => ({ value: id, label: name }))} /></div><div className="summary-list">{projectSummaries.length ? projectSummaries.map((summary) => <ClickableCard padding={0} className="summary-list__item" key={summary.id} label={`查看 ${summary.startDate} 至 ${summary.endDate} 的总结`} onClick={() => setDetail(summary)}><div className="summary-list__item-main"><span>{summary.startDate} 至 {summary.endDate}</span><strong>{projects.find((project) => project.id === summary.projectId)?.name || '项目总结'}</strong><small>任务 {summary.completedTasks.length + summary.pendingTasks.length} · 问题 {summary.completedIssues.length + summary.pendingIssues.length}</small></div><div className="summary-list__actions"><IconButton label={`重新同步总结 ${summary.startDate} 至 ${summary.endDate}`} variant="ghost" className="summary-list__sync" type="button" onClick={() => syncSummary(summary)} size="sm" icon={<Icon name="refresh" size={13} />} /><IconButton label={`删除总结 ${summary.startDate} 至 ${summary.endDate}`} variant="ghost" className="summary-list__delete" type="button" onClick={() => setDeleteTarget(summary)} size="sm" icon={<Icon name="trash" size={13} />} /></div></ClickableCard>) : <div className="summary-empty">暂无总结记录</div>}</div><div className="modal__actions"><Button label="关闭" variant="primary" type="button" onClick={onClose} /></div></div>
    {showCreate && <WorkspaceOverlay label="新增总结" onClose={() => setShowCreate(false)}><form className="modal modal--wide summary-create-modal" onSubmit={(event) => { event.preventDefault(); createSummary() }}><Heading level={3} accessibilityLevel={2} className="modal__title">新增总结</Heading><div className="field-label">项目</div><Selector label="项目" isLabelHidden width="100%" value={projectId} onChange={setProjectId} options={projects.map(({ id, name }) => ({ value: id, label: name }))} />
      <div className="collection-field-gap">
        <DateRangeField
          label="总结时间段"
          startDate={startDate}
          endDate={endDate}
          required
          onChange={(start, end) => {
            setStartDate(start)
            setEndDate(end)
            setError('')
          }}
        />
      </div>
      {error && <Banner status="error" title={<>{error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setShowCreate(false)} /><Button label="生成总结" variant="primary" type="submit" /></div></form></WorkspaceOverlay>}
    {detail && <WorkspaceOverlay label={projects.find((project) => project.id === detail.projectId)?.name || '项目总结'} onClose={() => setDetail(null)}><div className="modal modal--wide summary-detail-modal"><div className="summary-list-head"><div><Heading level={3} accessibilityLevel={2} className="modal__title">{projects.find((project) => project.id === detail.projectId)?.name || '项目总结'}</Heading><div className="collection-detail__meta">{detail.startDate} 至 {detail.endDate}</div></div></div><section className="summary-progress"><h3>项目状态</h3><div>{detail.projectStatus || projects.find((project) => project.id === detail.projectId)?.status || '暂无状态'} · {detail.projectProgressPercent ?? projects.find((project) => project.id === detail.projectId)?.progress ?? detail.projectProgress}</div></section><SummaryTable title="完成的任务" rows={detail.completedTasks} /><SummaryTable title="未完成的任务" rows={detail.pendingTasks} pending /><SummaryTable title="完成的问题" rows={detail.completedIssues} /><SummaryTable title="未完成的问题" rows={detail.pendingIssues} pending /><div className="modal__actions"><Button label="重新同步" variant="ghost" icon={<Icon name="refresh" size={13} />} type="button" onClick={() => syncSummary(detail)} /><Button label="删除总结" variant="ghost" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteTarget(detail)} className="btn-ghost--danger" /><Button label="关闭" variant="primary" type="button" onClick={() => setDetail(null)} /></div></div></WorkspaceOverlay>}
    {deleteTarget && <WorkspaceOverlay label="确认删除总结？" onClose={() => setDeleteTarget(null)}><div className="modal delete-confirm-modal"><Heading level={3} accessibilityLevel={2} className="modal__title">确认删除总结？</Heading><div className="delete-confirm-modal__text">删除「{deleteTarget.startDate} 至 {deleteTarget.endDate}」的总结后无法恢复。</div><div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={() => setDeleteTarget(null)} /><Button label="确认删除" variant="destructive" type="button" onClick={() => removeSummary(deleteTarget)} /></div></div></WorkspaceOverlay>}
  </WorkspaceOverlay>
}
