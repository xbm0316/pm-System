import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import ReqPool from '../components/ReqPool'
import CompAnalysis from '../components/CompAnalysis'
import RequirementDetailPage from '../components/RequirementDetailPage'
import ProjectManagerBoard from '../components/ProjectManagerBoard'
import OperationsWorkspace from '../components/OperationsWorkspace'
import SummaryWorkspace from '../components/SummaryWorkspace'
import TodoWorkspace, { TodoDetailDialog } from '../components/TodoWorkspace'
import { WorkspaceOverlay } from '../components/WorkspaceDialog'
import { WORKSPACE_TABS, MENUS, type Space, type Requirement, type RequirementStatus, type Competitor, type WorkspaceTabKey, type Project, type ProjectTask, type ProjectIssue, type ProjectSummary } from '../lib/store'
import { fetchRequirements, insertRequirement, updateRequirement, updateRequirementStatus, updateRequirementAttachments, fetchCompetitors, insertCompetitor, updateCompetitor, deleteCompetitorRow, deleteRequirementRow } from '../lib/api'
import { deleteLocalFilesForEntity, listLocalFiles } from '../lib/localFiles'
import { useTodoReminders, useWorkspaceTodos } from '../lib/todos'

const TODO_TAB = { key: 'todos', label: '待办事项', icon: 'check' }

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
  const [showTodos, setShowTodos] = useState(false)
  const [todoDetailId, setTodoDetailId] = useState<string | null>(null)
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
  const { todos, error: todoError, saveTodo, deleteTodo, completeTodo } = useWorkspaceTodos(ownerPhone, space.id)
  const todoReminders = useTodoReminders(todos)
  const todoDetail = todos.find((item) => item.id === todoDetailId)

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

  async function addRequirement(item: Requirement) {
    await insertRequirement(item)
    setRequirements((prev) => [...prev, item])
  }

  async function addCompetitor(item: Competitor) {
    await insertCompetitor(item)
    setCompetitors((prev) => [...prev, item])
  }

  async function updateCompetitorFields(id: string, patch: Partial<Competitor>) {
    await updateCompetitor(id, { name: patch.name, url: patch.url, description: patch.description })
    setCompetitors((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function deleteCompetitor(id: string) {
    await deleteLocalFilesForEntity('competitor', id, space.id)
    await deleteCompetitorRow(id)
    setCompetitors((prev) => prev.filter((item) => item.id !== id))
  }

  async function deleteRequirement(reqId: string) {
    await deleteLocalFilesForEntity('requirement', reqId, space.id)
    await deleteRequirementRow(reqId)
    setRequirements((prev) => prev.filter((item) => item.id !== reqId))
    setDetailTarget((current) => current === reqId ? null : current)
  }

  function updateRequirementFiles(reqId: string, attachments: Requirement['attachments']) {
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, attachments } : item))
    void updateRequirementAttachments(reqId, attachments)
  }

  async function updateRequirementFields(reqId: string, patch: Partial<Requirement>) {
    await updateRequirement(reqId, patch)
    setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, ...patch } : item))
  }

  function renderProductContent() {
    if (detailTarget) {
      const target = requirements.find((item) => item.id === detailTarget)
      if (!target) return null
      return <WorkspaceOverlay label={`需求详情：${target.name}`} onClose={() => setDetailTarget(null)}><div className="requirement-detail-modal-shell"><RequirementDetailPage requirement={target} requirements={requirements} competitors={competitors} onStatusChange={updateReqStatus} onUpdateAttachments={updateRequirementFiles} onUpdateRequirement={updateRequirementFields} onClose={() => setDetailTarget(null)} /></div></WorkspaceOverlay>
    }
    if (activeMenu === 'req') return <ReqPool spaceId={space.id} requirements={requirements} competitors={competitors} activeReqId={detailTarget} onAdd={addRequirement} onOpenTrack={setDetailTarget} onDelete={deleteRequirement} openSignal={addSignal.req || 0} searchQuery={searchQuery} />
    if (activeMenu === 'comp') return <CompAnalysis spaceId={space.id} competitors={competitors} onAdd={addCompetitor} onUpdate={updateCompetitorFields} onDelete={deleteCompetitor} openSignal={addSignal.comp || 0} searchQuery={searchQuery} />
    return <div className="empty" style={{ padding: '36px 12px' }}><div style={{ fontSize: 12.5 }}>该模块暂未开放</div></div>
  }

  const view = activeWorkspaceTab === 'workbench' ? 'board' : activeWorkspaceTab
  const workspaceTabs = isProductManager ? MENUS['产品经理'] : isOperationsManager ? MENUS['独立站电商运营'] : WORKSPACE_TABS
  const activeTopTab = showTodos ? TODO_TAB.key : isProductManager || isOperationsManager ? activeMenu : activeWorkspaceTab
  const contentClass = `content${isProductManager ? ' content--product' : isOperationsManager ? ' content--operations' : ' content--project'}`
  const knowledgeView = isOperationsManager && activeTopTab === 'ops-knowledge'

  function changeWorkspaceTab(key: string) {
    setShowTodos(key === TODO_TAB.key)
    setSearchQuery('')
    if (key === TODO_TAB.key) return
    if (isProductManager || isOperationsManager) {
      setActiveMenu(key)
      setDetailTarget(null)
      return
    }
    setActiveWorkspaceTab(key as WorkspaceTabKey)
    setDetailTarget(null)
    setOpenTaskId(null)
    setWorkspaceRevision((value) => value + 1)
  }

  return <div className="workspace-frame">
    <TopBar
      title={space.name}
      workspaceTabs={[...workspaceTabs, TODO_TAB]}
      activeWorkspaceTab={activeTopTab}
      onWorkspaceTabChange={changeWorkspaceTab}
      onBackToHome={onBackToHome}
      hideTitle
      searchQuery={searchQuery}
      searchLabel={showTodos ? '搜索待办事项' : knowledgeView ? '搜索资料' : isOperationsManager ? '搜索运营记录' : isProductManager ? '搜索需求与竞品' : '搜索项目内容'}
      onSearchChange={setSearchQuery}
      reminderCount={isProductManager ? reminderItems.length : reminderCount}
      reminderItems={reminderItems}
      todoReminders={todoReminders}
      todoReminderError={todoError}
      onCompleteTodo={completeTodo}
      onOpenTodoDetails={setTodoDetailId}
      todoDetailsOpen={Boolean(todoDetail)}
      onReminderClick={(item) => {
        setShowTodos(false)
        if (item.kind === 'requirement' && item.reqId) {
          setActiveMenu('req')
          setDetailTarget(item.reqId)
        } else if (item.taskId) {
          setActiveWorkspaceTab('workbench')
          setOpenTaskId(item.taskId)
          setWorkspaceRevision((value) => value + 1)
        }
      }}
      onSummaryClick={isProductManager || isOperationsManager ? undefined : openSummary}
    />
    <div className={`main${isProductManager ? ' main--product' : ' main--project'}`}>
      <section className={`${contentClass} workspace-module${knowledgeView ? ' content--knowledge' : ''}`} hidden={showTodos}>
        {isOperationsManager ? <OperationsWorkspace key={space.id} ownerPhone={ownerPhone} spaceId={space.id} activeMenu={activeMenu} searchQuery={searchQuery} /> : isProductManager ? renderProductContent() : (
          <ProjectManagerBoard
            key={space.id}
            ownerPhone={ownerPhone}
            spaceId={space.id}
            searchQuery={searchQuery}
            onRemindersChange={setReminderCount}
            onReminders={setReminderItems}
            onOpenTask={view !== 'board' ? (taskId) => { setActiveWorkspaceTab('workbench'); setOpenTaskId(taskId) } : undefined}
            openTaskId={view === 'board' ? openTaskId : undefined}
            onCloseTask={() => setOpenTaskId(null)}
            view={view}
          />
        )}
      </section>
      {showTodos && <section className={`${contentClass} content--todos`}>
        <TodoWorkspace todos={todos} searchQuery={searchQuery} error={todoError} onOpenDetails={setTodoDetailId} onSave={saveTodo} onDelete={deleteTodo} onComplete={completeTodo} />
      </section>}
    </div>
    {todoDetail && <TodoDetailDialog todo={todoDetail} onClose={() => setTodoDetailId(null)} />}
    {summaryOpen && <SummaryWorkspace projects={summaryProjects} tasks={summaryTasks} issues={summaryIssues} summaries={summaryRecords} onChange={updateSummaryRecords} onClose={() => setSummaryOpen(false)} />}
  </div>
}
