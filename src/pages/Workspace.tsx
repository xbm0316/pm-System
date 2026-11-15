import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Icon from '../components/Icon'
import ReqPool from '../components/ReqPool'
import CompAnalysis from '../components/CompAnalysis'
import RequirementDetailPage from '../components/RequirementDetailPage'
import ProjectManagerBoard from '../components/ProjectManagerBoard'
import { WORKSPACE_TABS, MENUS, type Space, type Requirement, type RequirementStatus, type Competitor, type Retro, type RequirementPrd, type MeetingRecord, type WorkspaceTabKey } from '../lib/store'
import { fetchRequirements, insertRequirement, updateRequirementStatus, fetchCompetitors, insertCompetitor, fetchRetros, insertRetro, deleteRequirementRow } from '../lib/api'

interface Props {
  space: Space
  onBackToHome: () => void
}

export default function Workspace({ space, onBackToHome }: Props) {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>('workbench')
  const [searchQuery, setSearchQuery] = useState('')
  const [reminderCount, setReminderCount] = useState(0)
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

  function renderProductContent() {
    if (detailTarget) {
      const target = requirements.find((item) => item.id === detailTarget)
      if (!target) return null
      return <RequirementDetailPage requirement={{ ...target, prd: prdDocs[target.id] || target.prd }} requirements={requirements} competitors={competitors} retros={retros} onStatusChange={updateReqStatus} onSavePrd={savePrd} onUpdateMeetings={updateRequirementMeetings} onAddRetro={(retro) => { setRetros((prev) => [...prev, retro]); void insertRetro(retro) }} onClose={() => setDetailTarget(null)} />
    }
    if (activeMenu === 'req') return <ReqPool spaceId={space.id} requirements={requirements} activeReqId={detailTarget} onAdd={addRequirement} onOpenTrack={setDetailTarget} onDelete={deleteRequirement} openSignal={addSignal.req || 0} searchQuery={searchQuery} />
    if (activeMenu === 'comp') return <CompAnalysis spaceId={space.id} competitors={competitors} onAdd={addCompetitor} openSignal={addSignal.comp || 0} searchQuery={searchQuery} />
    return <div className="empty" style={{ padding: '36px 12px' }}><div style={{ fontSize: 12.5 }}>该模块暂未开放</div></div>
  }

  const view = activeWorkspaceTab === 'retro' ? 'retro' : activeWorkspaceTab === 'knowledge' ? 'knowledge' : activeWorkspaceTab === 'workbench' ? 'board' : 'coming-soon'

  return <>
    <TopBar title={space.name} workspaceTabs={WORKSPACE_TABS} activeWorkspaceTab={activeWorkspaceTab} onWorkspaceTabChange={(key) => { setActiveWorkspaceTab(key); setDetailTarget(null) }} onBackToHome={onBackToHome} hideTitle searchQuery={searchQuery} onSearchChange={setSearchQuery} reminderCount={reminderCount} />
    <div className={`main${isProductManager ? ' main--product' : ' main--project'}`}>
      {isProductManager && view === 'board' && <aside className="sidebar">
        <div className="sidebar__head"><span className="sidebar__label">产品工作台</span></div>
        {menus.map((menu) => <button key={menu.key} className={`nav-item${activeMenu === menu.key ? ' nav-item--active' : ''}`} onClick={() => { setActiveMenu(menu.key); setDetailTarget(null) }}><Icon name={menu.icon} size={16} /><span>{menu.label}</span></button>)}
      </aside>}
      <section className={`content${isProductManager ? ' content--product' : ' content--project'}`}>
        {view === 'retro' || view === 'knowledge' ? <ProjectManagerBoard spaceId={space.id} searchQuery={searchQuery} onRemindersChange={setReminderCount} view={view} /> : view === 'coming-soon' ? <div className="empty" style={{ flex: 1 }}><div>{activeWorkspaceTab === 'meeting' ? '会议纪要模块将在后续迭代中开放' : '周报编写模块将在后续迭代中开放'}</div></div> : isProductManager ? renderProductContent() : <ProjectManagerBoard spaceId={space.id} searchQuery={searchQuery} onRemindersChange={setReminderCount} view="board" />}
      </section>
    </div>
  </>
}
