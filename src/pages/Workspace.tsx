import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Icon from '../components/Icon'
import ReqPool from '../components/ReqPool'
import CompAnalysis from '../components/CompAnalysis'
import RequirementDetailPage from '../components/RequirementDetailPage'
import ProjectManagerBoard from '../components/ProjectManagerBoard'
import SummaryWorkspace from '../components/SummaryWorkspace'
import { WORKSPACE_TABS, MENUS, type Space, type Requirement, type RequirementStatus, type Competitor, type Retro, type RequirementPrd, type MeetingRecord, type WorkspaceTabKey, type Project, type ProjectTask, type ProjectIssue, type ProjectSummary } from '../lib/store'
import { fetchRequirements, insertRequirement, updateRequirementStatus, updateRequirementAttachments, fetchCompetitors, insertCompetitor, fetchRetros, insertRetro, deleteRequirementRow } from '../lib/api'

interface Props {
  space: Space
  onBackToHome: () => void
}

export default function Workspace({ space, onBackToHome }: Props) {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>('workbench')
  const [searchQuery, setSearchQuery] = useState('')
  const [reminderCount, setReminderCount] = useState(0)
  const [reminderItems, setReminderItems] = useState<{ id: string; kind: 'task' | 'issue'; title: string; dueDate: string; taskId: string; projectId: string }[]>([])
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [workspaceRevision, setWorkspaceRevision] = useState(0)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryProjects, setSummaryProjects] = useState<Project[]>([])
  const [summaryTasks, setSummaryTasks] = useState<ProjectTask[]>([])
  const [summaryIssues, setSummaryIssues] = useState<ProjectIssue[]>([])
  const [summaryRecords, setSummaryRecords] = useState<ProjectSummary[]>([])
  const [activeMenu, setActiveMenu] = useState('req')
  const [detailTarget, setDetailTarget] = useState<string | null>(null)
  const [addSignal, setAddSignal] = useState<Record<string, number>>({})
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [retros, setRetros] = useState<Retro[]>([])
  const [prdDocs, setPrdDocs] = useState<Record<string, RequirementPrd>>({})

  useEffect(() => {
    void (async () => {
      const [rs, cs, rt] = await Promise.all([fetchRequirements(), fetchCompetitors(), fetchRetros()])
      setRequirements(rs)
      setCompetitors(cs)
      setRetros(rt)
    })()
  }, [])

  const isProductManager = space.types.includes('产品经理')
  const menus = MENUS['产品经理']

  function loadSummaryData() {
    try {
      const raw = localStorage.getItem(`jawcat.project-manager.v3.${space.id}`)
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
      const key = `jawcat.project-manager.v3.${space.id}`
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

  function deleteRequirement(reqId: string) {
    setRequirements((prev) => prev.filter((item) => item.id !== reqId))
    setRetros((prev) => prev.filter((item) => item.reqId !== reqId))
    setDetailTarget((current) => current === reqId ? null : current)
    void deleteRequirementRow(reqId)
  }

  function savePrd(reqId: string, prd: RequirementPrd) {
    setPrdDocs((prev) => ({ ...prev, [reqId]: prd }))
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, prd } : item))
  }

  function updateRequirementMeetings(reqId: string, meetings: MeetingRecord[]) {
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, meetings } : item))
  }

  function updateRequirementFiles(reqId: string, attachments: Requirement['attachments']) {
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, attachments } : item))
    void updateRequirementAttachments(reqId, attachments)
  }

  function renderProductContent() {
    if (detailTarget) {
      const target = requirements.find((item) => item.id === detailTarget)
      if (!target) return null
      return <RequirementDetailPage requirement={{ ...target, prd: prdDocs[target.id] || target.prd }} requirements={requirements} competitors={competitors} retros={retros} onStatusChange={updateReqStatus} onSavePrd={savePrd} onUpdateMeetings={updateRequirementMeetings} onUpdateAttachments={updateRequirementFiles} onAddRetro={(retro) => { setRetros((prev) => [...prev, retro]); void insertRetro(retro) }} onClose={() => setDetailTarget(null)} />
    }
    if (activeMenu === 'req') return <ReqPool spaceId={space.id} requirements={requirements} activeReqId={detailTarget} onAdd={addRequirement} onOpenTrack={setDetailTarget} onDelete={deleteRequirement} openSignal={addSignal.req || 0} searchQuery={searchQuery} />
    if (activeMenu === 'comp') return <CompAnalysis spaceId={space.id} competitors={competitors} onAdd={addCompetitor} openSignal={addSignal.comp || 0} searchQuery={searchQuery} />
    return <div className="empty" style={{ padding: '36px 12px' }}><div style={{ fontSize: 12.5 }}>该模块暂未开放</div></div>
  }

  const view = activeWorkspaceTab === 'retro' ? 'retro' : activeWorkspaceTab === 'knowledge' ? 'knowledge' : activeWorkspaceTab === 'meeting' ? 'meeting' : 'board'
  function changeWorkspaceTab(key: WorkspaceTabKey) {
    setActiveWorkspaceTab(key)
    setDetailTarget(null)
    setOpenTaskId(null)
    setSearchQuery('')
    setWorkspaceRevision((value) => value + 1)
  }

  return <>
    <TopBar title={space.name} workspaceTabs={WORKSPACE_TABS} activeWorkspaceTab={activeWorkspaceTab} onWorkspaceTabChange={changeWorkspaceTab} onBackToHome={onBackToHome} hideTitle searchQuery={searchQuery} onSearchChange={setSearchQuery} reminderCount={reminderCount} reminderItems={reminderItems} onReminderClick={(item) => { setActiveWorkspaceTab('workbench'); setOpenTaskId(item.taskId); setWorkspaceRevision((value) => value + 1) }} onSummaryClick={openSummary} />
    <div className={`main${isProductManager ? ' main--product' : ' main--project'}`}>
      {isProductManager && view === 'board' && <aside className="sidebar">
        <div className="sidebar__head"><span className="sidebar__label">产品工作台</span></div>
        {menus.map((menu) => <button key={menu.key} className={`nav-item${activeMenu === menu.key ? ' nav-item--active' : ''}`} onClick={() => { setActiveMenu(menu.key); setDetailTarget(null) }}><Icon name={menu.icon} size={16} /><span>{menu.label}</span></button>)}
      </aside>}
      <section className={`content${isProductManager ? ' content--product' : ' content--project'}`}>
        {view === 'retro' || view === 'knowledge' || view === 'meeting' ? <ProjectManagerBoard spaceId={space.id} searchQuery={searchQuery} onRemindersChange={setReminderCount} onReminders={setReminderItems} onOpenTask={(taskId) => { setActiveWorkspaceTab('workbench'); setOpenTaskId(taskId) }} onCloseTask={() => setOpenTaskId(null)} view={view} /> : isProductManager ? renderProductContent() : <ProjectManagerBoard spaceId={space.id} searchQuery={searchQuery} onRemindersChange={setReminderCount} onReminders={setReminderItems} openTaskId={openTaskId} onCloseTask={() => setOpenTaskId(null)} view="board" />}
      </section>
    </div>
    {summaryOpen && <SummaryWorkspace projects={summaryProjects} tasks={summaryTasks} issues={summaryIssues} summaries={summaryRecords} onChange={updateSummaryRecords} onClose={() => setSummaryOpen(false)} />}
  </>
}
