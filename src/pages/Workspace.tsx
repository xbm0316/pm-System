import { useEffect, useMemo, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import TopBar from '../components/TopBar'
import ReqPool from '../components/ReqPool'
import CompAnalysis from '../components/CompAnalysis'
import RequirementDetailPage from '../components/RequirementDetailPage'
import ProjectManagerBoard, { normalizeProjectStore } from '../components/ProjectManagerBoard'
import OperationsWorkspace, { normalizeOperationsState, type OperationsState } from '../components/OperationsWorkspace'
import SummaryWorkspace from '../components/SummaryWorkspace'
import TodoWorkspace, { TodoDetailDialog } from '../components/TodoWorkspace'
import WorkspaceDialog, { WorkspaceDialogActions, WorkspaceOverlay } from '../components/WorkspaceDialog'
import { WORKSPACE_TABS, MENUS, type Space, type Requirement, type RequirementStatus, type Competitor, type WorkspaceTabKey, type ProjectStore } from '../lib/store'
import { fetchRequirements, insertRequirement, updateRequirement, updateRequirementStatus, updateRequirementAttachments, fetchCompetitors, insertCompetitor, updateCompetitor, deleteCompetitorRow, deleteRequirementRow } from '../lib/api'
import { deleteLocalFilesForEntity, listLocalFiles } from '../lib/localFiles'
import { normalizeTodos, useTodoReminders, workspaceTodoActions } from '../lib/todos'
import { useWorkspaceSync } from '../lib/workspaceSync'

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
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [productWriteError, setProductWriteError] = useState('')
  const [productLoadError, setProductLoadError] = useState('')
  const [productLoadAttempt, setProductLoadAttempt] = useState(0)
  const [activeMenu, setActiveMenu] = useState(isOperationsManager ? 'ops-knowledge' : isProductManager ? 'req' : 'proj')
  const [detailTarget, setDetailTarget] = useState<string | null>(null)
  const [addSignal, setAddSignal] = useState<Record<string, number>>({})
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const sync = useWorkspaceSync(ownerPhone, space.id)
  const operationsRow = sync.rows?.operations
  const projectRow = sync.rows?.projects
  const todoRow = sync.rows?.todos
  const operations = useMemo(() => normalizeOperationsState(operationsRow?.data), [operationsRow])
  const projects = useMemo(() => normalizeProjectStore(projectRow?.data), [projectRow])
  const todos = useMemo(() => normalizeTodos(todoRow?.data), [todoRow])
  const { saveTodo, deleteTodo, completeTodo } = workspaceTodoActions((change) =>
    sync.update('todos', todoRow?.revision, normalizeTodos, change)
  )

  function patchOperations(change: (state: OperationsState) => OperationsState) {
    return sync.update('operations', operationsRow?.revision, normalizeOperationsState, change)
  }

  function patchProjects(change: (state: ProjectStore) => ProjectStore) {
    return sync.update('projects', projectRow?.revision, normalizeProjectStore, change)
  }
  const todoReminders = useTodoReminders(todos)
  const todoDetail = todos.find((item) => item.id === todoDetailId)

  useEffect(() => {
    if (!isProductManager) return
    let cancelled = false
    void (async () => {
      const [fetchedRequirements, cs] = await Promise.all([fetchRequirements(space.id), fetchCompetitors(space.id)])
      const rs = import.meta.env.DEV && fetchedRequirements.length === 0 ? previewRequirements(space.id) : fetchedRequirements
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
      setProductLoadError('')
    })().catch(() => { if (!cancelled) setProductLoadError('无法读取需求和竞品，请重试') })
    return () => { cancelled = true }
  }, [space.id, isProductManager, productLoadAttempt, sync.imported])

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

  function updateReqStatus(reqId: string, status: RequirementStatus) {
    void updateRequirementStatus(reqId, status).then(() => {
      setRequirements((prev) => prev.map((item) => item.id === reqId ? { ...item, status } : item))
      setProductWriteError('')
    }).catch(() => setProductWriteError('无法同步需求状态，请重试'))
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
      todoReminderError={sync.writeError || sync.loadError}
      onCompleteTodo={(id) => { void completeTodo(id) }}
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
        }
      }}
      onSummaryClick={!sync.rows || isProductManager || isOperationsManager ? undefined : () => setSummaryOpen(true)}
    />
    <div className={`main${isProductManager ? ' main--product' : ' main--project'}`}>
      {!sync.rows && <VStack gap={2} padding={4}>
        {sync.loadError ? <>
          <Banner status="error" title={sync.loadError} />
          <Button label="重试" variant="secondary" onClick={() => void sync.refresh()} />
        </> : <Text role="status">正在读取账号数据…</Text>}
      </VStack>}
      {sync.rows && <>
        {(sync.imported || sync.hasBrowserCopies) && <HStack padding={2} gap={2} hAlign="end" vAlign="center" wrap="wrap">
          {sync.imported ? <Text type="supporting">旧数据导入完成</Text> : <Button label="导入此浏览器的旧数据" variant="ghost" size="sm" onClick={() => setImportOpen(true)} />}
        </HStack>}
        {productWriteError && <Banner status="error" title={productWriteError} />}
        {productLoadError && <HStack padding={2} gap={2} wrap="wrap"><Banner status="error" title={productLoadError} /><Button label="重试" variant="secondary" onClick={() => setProductLoadAttempt((value) => value + 1)} /></HStack>}
        {sync.writeError && !showTodos && <Banner status="error" title={sync.writeError} />}
        <section className={`${contentClass} workspace-module${knowledgeView ? ' content--knowledge' : ''}`} hidden={showTodos}>
          {isOperationsManager ? <OperationsWorkspace key={space.id} state={operations} updateState={patchOperations} spaceId={space.id} activeMenu={activeMenu} searchQuery={searchQuery} /> : isProductManager ? renderProductContent() : (
            <ProjectManagerBoard
              key={space.id}
              store={projects}
              patchStore={patchProjects}
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
          <TodoWorkspace todos={todos} searchQuery={searchQuery} error={sync.writeError} onOpenDetails={setTodoDetailId} onSave={saveTodo} onDelete={deleteTodo} onComplete={completeTodo} />
        </section>}
      </>}
    </div>
    {importOpen && <WorkspaceDialog title="导入此浏览器的旧数据" onClose={() => !sync.importing && setImportOpen(false)}>
      <VStack gap={3}>
        <Text>请在平时使用、能看到完整旧数据的浏览器里导入。已有云端数据的模块会保留当前内容。</Text>
        {sync.writeError && <Banner status="error" title={sync.writeError} />}
        <WorkspaceDialogActions>
          <Button label="取消" variant="ghost" isDisabled={sync.importing} onClick={() => setImportOpen(false)} />
          <Button label="导入旧数据" variant="primary" isLoading={sync.importing} onClick={() => {
            void sync.importFromBrowser().then((success) => { if (success) setImportOpen(false) })
          }} />
        </WorkspaceDialogActions>
      </VStack>
    </WorkspaceDialog>}
    {todoDetail && <TodoDetailDialog todo={todoDetail} onClose={() => setTodoDetailId(null)} />}
    {summaryOpen && <SummaryWorkspace projects={projects.projects} tasks={projects.tasks} issues={projects.issues} summaries={projects.summaries} onChange={(summaries) => patchProjects((current) => ({ ...current, summaries }))} onClose={() => setSummaryOpen(false)} />}
  </div>
}
