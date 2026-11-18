import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import ReqPool from '../components/ReqPool'
import CompAnalysis from '../components/CompAnalysis'
import RequirementDetailPage from '../components/RequirementDetailPage'
import ProjectManagerBoard from '../components/ProjectManagerBoard'
import OperationsWorkspace from '../components/OperationsWorkspace'
import SummaryWorkspace from '../components/SummaryWorkspace'
import { WORKSPACE_TABS, MENUS, type Space, type Requirement, type RequirementStatus, type Competitor, type WorkspaceTabKey, type Project, type ProjectTask, type ProjectIssue, type ProjectSummary } from '../lib/store'
import { fetchRequirements, insertRequirement, updateRequirement, updateRequirementStatus, updateRequirementAttachments, fetchCompetitors, insertCompetitor, updateCompetitor, deleteCompetitorRow, deleteRequirementRow } from '../lib/api'
import { deleteLocalFilesForEntity, listLocalFiles } from '../lib/localFiles'

function previewRequirements(spaceId: string): Requirement[] {
  const now = Date.now()
  return (['调研中', '已评审', '开发中', '测试中', '已上线'] as RequirementStatus[]).flatMap((status, statusIndex) => Array.from({ length: 10 }, (_, index) => ({
    id: `preview-req-${spaceId}-${statusIndex + 1}-${index + 1}`,
    spaceId,
    version: `V${statusIndex + 1}.${index + 1}`,
    name: `${status}测试需求 ${index + 1}`,
    content: `用于预览 ${status} 状态下的需求卡片、详情和 PRD 交互。`,
    priority: (['P0', 'P1', 'P2', 'P3'] as const)[index % 4],
    status,
    createdAt: now - (statusIndex * 10 + index) * 60 * 60 * 1000,
    launchDate: status === '已上线' ? new Date(now - index * 24 * 60 * 60 * 1000).toISOString() : new Date(now + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
  })))
}

interface Props {
  space: Space
  ownerPhone: string
  onBackToHome: () => void
}

export default function Workspace({ space, ownerPhone, onBackToHome }: Props) {
  const isProductManager = space.types.includes('产品经理')
  const isOperationsManager = !isProductManager && space.types.includes('独立站电商运营')
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>('workbench')
  const [searchQuery, setSearchQuery] = useState('')
  const [reminderCount, setReminderCount] = useState(0)
  const [reminderItems, setReminderItems] = useState<{ id: string; kind: 'task' | 'issue' | 'requirement'; title: string; dueDate: string; taskId?: string; reqId?: string; projectId?: string }[]>([])
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [workspaceRevision, setWorkspaceRevision] = useState(0)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryProjects, setSummaryProjects] = useState<Project[]>([])
  const [summaryTasks, setSummaryTasks] = useState<ProjectTask[]>([])
  const [summaryIssues, setSummaryIssues] = useState<ProjectIssue[]>([])
  const [summaryRecords, setSummaryRecords] = useState<ProjectSummary[]>([])
  const [activeMenu, setActiveMenu] = useState(isOperationsManager ? 'ops-knowledge' : isProductManager ? 'req' : 'proj')
  const [detailTarget, setDetailTarget] = useState<string | null>(null)
  const [addSignal, setAddSignal] = useState<Record<string, number>>({})
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])

  useEffect(() => {
    setActiveWorkspaceTab('workbench')
    setActiveMenu(isOperationsManager ? 'ops-knowledge' : isProductManager ? 'req' : 'proj')
    setDetailTarget(null)
    setOpenTaskId(null)
    setSearchQuery('')
    setRequirements([])
    setCompetitors([])
    let cancelled = false
    void (async () => {
      const fetchedRequirements = await fetchRequirements(space.id)
      const rs = import.meta.env.DEV && isProductManager && fetchedRequirements.length === 0 ? previewRequirements(space.id) : fetchedRequirements
      const cs = await fetchCompetitors(space.id)
      const requirementsWithLocalFiles = await Promise.all(rs.map(async (requirement) => ({
        ...requirement,
        attachments: await listLocalFiles('requirement', requirement.id) as Requirement['attachments'],
      })))
      const competitorsWithLocalFiles = await Promise.all(cs.map(async (competitor) => ({
        ...competitor,
        image: (await listLocalFiles('competitor', competitor.id))[0] as Competitor['image'],
      })))
      if (cancelled) return
      setRequirements(requirementsWithLocalFiles)
      setCompetitors(competitorsWithLocalFiles)
    })()
    return () => { cancelled = true }
  }, [ownerPhone, space.id, isOperationsManager, isProductManager])

  useEffect(() => {
    if (!isProductManager) return
    const now = Date.now()
    const requirementsWithinDay = requirements
      .filter((item) => item.launchDate)
      .map((item) => ({ item, time: new Date(item.launchDate as string).getTime() }))
      .filter(({ time }) => time > now && time - now < 24 * 60 * 60 * 1000)
      .map(({ item }) => ({ id: `requirement-${item.id}`, kind: 'requirement' as const, title: item.name, dueDate: (item.launchDate as string).slice(0, 10), reqId: item.id }))
    setReminderItems(requirementsWithinDay)
  }, [isProductManager, requirements])

  function loadSummaryData() {
    try {
      const raw = localStorage.getItem(`jawcat.project-manager.v4.${ownerPhone}.${space.id}`)
      const parsed = raw ? JSON.parse(raw) as Partial<{ projects: Project[]; tasks: ProjectTask[]; issues: ProjectIssue[]; summaries: ProjectSummary[] }> : {}
      setSummaryProjects(Array.isArray(parsed.projects) ? parsed.projects : [])
      setSummaryTasks(Array.isArray(parsed.tasks) ? parsed.tasks : [])
      setSummaryIssues(Array.isArray(parsed.issues) ? parsed.issues : [])
      setSummaryRecords(Array.isArray(parsed.summaries) ? parsed.summaries : [])
    } catch {
      setSummaryProjects([]); setSummaryTasks([]); setSummaryIssues([]); setSummaryRecords([])
    }
  }
  function openSummary() { loadSummaryData(); setSummaryOpen(true) }
  function updateSummaryRecords(next: ProjectSummary[]) {
    setSummaryRecords(next)
    try {
      const key = `jawcat.project-manager.v4.${ownerPhone}.${space.id}`
      const raw = localStorage.getItem(key)
      const parsed = raw ? JSON.parse(raw) : {}
      localStorage.setItem(key, JSON.stringify({ ...parsed, summaries: next }))
    } catch { /* local persistence is best effort */ }
  }

  function updateReqStatus(reqId: string, status: RequirementStatus) {
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, status } : item))
    void updateRequirementStatus(reqId, status)
  }

  function addRequirement(item: Requirement) {
    setRequirements((prev) => [...prev, item])
    void insertRequirement(item)
  }

  function addCompetitor(item: Competitor) {
    setCompetitors((prev) => [...prev, item])
    void insertCompetitor(item)
  }

  function updateCompetitorFields(id: string, patch: Partial<Competitor>) {
    setCompetitors((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item))
    void updateCompetitor(id, { name: patch.name, url: patch.url, description: patch.description })
  }

  function deleteCompetitor(id: string) {
    setCompetitors((prev) => prev.filter((item) => item.id !== id))
    void deleteCompetitorRow(id)
    void deleteLocalFilesForEntity('competitor', id)
  }

  function deleteRequirement(reqId: string) {
    setRequirements((prev) => prev.filter((item) => item.id !== reqId))
    setDetailTarget((current) => current === reqId ? null : current)
    void deleteRequirementRow(reqId)
    void deleteLocalFilesForEntity('requirement', reqId)
  }

  function updateRequirementFiles(reqId: string, attachments: Requirement['attachments']) {
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, attachments } : item))
    void updateRequirementAttachments(reqId, attachments)
  }

  function updateRequirementFields(reqId: string, patch: Partial<Requirement>) {
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, ...patch } : item))
    void updateRequirement(reqId, patch)
  }

  function renderProductContent() {
    if (detailTarget) {
      const target = requirements.find((item) => item.id === detailTarget)
      if (!target) return null
      return <RequirementDetailPage requirement={target} requirements={requirements} competitors={competitors} onStatusChange={updateReqStatus} onUpdateAttachments={updateRequirementFiles} onUpdateRequirement={updateRequirementFields} onClose={() => setDetailTarget(null)} />
    }
    if (activeMenu === 'req') return <ReqPool spaceId={space.id} requirements={requirements} competitors={competitors} activeReqId={detailTarget} onAdd={addRequirement} onOpenTrack={setDetailTarget} onDelete={deleteRequirement} openSignal={addSignal.req || 0} searchQuery={searchQuery} />
    if (activeMenu === 'comp') return <CompAnalysis spaceId={space.id} competitors={competitors} onAdd={addCompetitor} onUpdate={updateCompetitorFields} onDelete={deleteCompetitor} openSignal={addSignal.comp || 0} searchQuery={searchQuery} />
    return <div className="empty" style={{ padding: '36px 12px' }}><div style={{ fontSize: 12.5 }}>该模块暂未开放</div></div>
  }

  const view = activeWorkspaceTab === 'retro' ? 'retro' : activeWorkspaceTab === 'knowledge' ? 'knowledge' : activeWorkspaceTab === 'meeting' ? 'meeting' : 'board'
  const workspaceTabs = isProductManager ? MENUS['产品经理'] : isOperationsManager ? MENUS['独立站电商运营'] : WORKSPACE_TABS
  const activeTopTab = isProductManager || isOperationsManager ? activeMenu : activeWorkspaceTab

  function changeWorkspaceTab(key: string) {
    if (isProductManager || isOperationsManager) {
      setActiveMenu(key)
      setDetailTarget(null)
      setSearchQuery('')
      return
    }
    setActiveWorkspaceTab(key as WorkspaceTabKey)
    setDetailTarget(null)
    setOpenTaskId(null)
    setSearchQuery('')
    setWorkspaceRevision((value) => value + 1)
  }

  return <>
    <TopBar title={space.name} workspaceTabs={workspaceTabs} activeWorkspaceTab={activeTopTab} onWorkspaceTabChange={changeWorkspaceTab} onBackToHome={onBackToHome} hideTitle searchQuery={searchQuery} onSearchChange={setSearchQuery} reminderCount={isProductManager ? reminderItems.length : reminderCount} reminderItems={isProductManager ? reminderItems : reminderItems} hideReminder={isOperationsManager} onReminderClick={(item) => { if (item.kind === 'requirement' && item.reqId) { setActiveMenu('req'); setDetailTarget(item.reqId) } else if (item.taskId) { setActiveWorkspaceTab('workbench'); setOpenTaskId(item.taskId); setWorkspaceRevision((value) => value + 1) } }} onSummaryClick={isProductManager || isOperationsManager ? undefined : openSummary} />
    <div className={`main${isProductManager ? ' main--product' : ' main--project'}`}>
      <section className={`content${isProductManager ? ' content--product' : isOperationsManager ? ' content--operations' : ' content--project'}`}>
        {isOperationsManager ? <OperationsWorkspace key={space.id} ownerPhone={ownerPhone} spaceId={space.id} activeMenu={activeMenu} searchQuery={searchQuery} /> : isProductManager ? renderProductContent() : view === 'retro' || view === 'knowledge' || view === 'meeting' ? <ProjectManagerBoard key={space.id} ownerPhone={ownerPhone} spaceId={space.id} searchQuery={searchQuery} onRemindersChange={setReminderCount} onReminders={setReminderItems} onOpenTask={(taskId) => { setActiveWorkspaceTab('workbench'); setOpenTaskId(taskId) }} onCloseTask={() => setOpenTaskId(null)} view={view} /> : <ProjectManagerBoard key={space.id} ownerPhone={ownerPhone} spaceId={space.id} searchQuery={searchQuery} onRemindersChange={setReminderCount} onReminders={setReminderItems} openTaskId={openTaskId} onCloseTask={() => setOpenTaskId(null)} view="board" />}
      </section>
    </div>
    {summaryOpen && <SummaryWorkspace projects={summaryProjects} tasks={summaryTasks} issues={summaryIssues} summaries={summaryRecords} onChange={updateSummaryRecords} onClose={() => setSummaryOpen(false)} />}
  </>
}
