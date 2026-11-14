import { useState, useEffect } from 'react'
import TopBar from '../components/TopBar'
import Icon from '../components/Icon'
import ReqPool from '../components/ReqPool'
import CompAnalysis from '../components/CompAnalysis'
import RequirementDetailPage from '../components/RequirementDetailPage'
import ProjectManagerBoard from '../components/ProjectManagerBoard'
import {
  MENUS,
  type Space,
  type TypeName,
  type Requirement,
  type RequirementStatus,
  type Competitor,
  type Retro,
  type RequirementPrd,
  type MeetingRecord,
} from '../lib/store'
import {
  fetchRequirements,
  insertRequirement,
  updateRequirementStatus,
  fetchCompetitors,
  insertCompetitor,
  fetchRetros,
  insertRetro,
  deleteRequirementRow,
} from '../lib/api'

interface Props {
  space: Space
  theme: 'light' | 'dark'
  onThemeChange: (t: 'light' | 'dark') => void
  onBackToHome: () => void
}

export default function Workspace({
  space,
  theme,
  onThemeChange,
  onBackToHome,
}: Props) {
  const [activeType, setActiveType] = useState<TypeName>(space.types[0])
  const [openKeys, setOpenKeys] = useState<string[]>([MENUS[space.types[0]][0].key])
  const [collapsed, setCollapsed] = useState(false)
  const [addSignal, setAddSignal] = useState<Record<string, number>>({})
  const [detailTarget, setDetailTarget] = useState<string | null>(null)
  const [prdDocs, setPrdDocs] = useState<Record<string, RequirementPrd>>({})
  const [switching, setSwitching] = useState(false)

  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [retros, setRetros] = useState<Retro[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      const [rs, cs, rt] = await Promise.all([
        fetchRequirements(),
        fetchCompetitors(),
        fetchRetros(),
      ])
      setRequirements(rs)
      setCompetitors(cs)
    setRetros(rt)
    })()
  }, [])

  const menus = MENUS[activeType] || []
  const activeMenu = menus.find((menu) => openKeys.includes(menu.key)) || null
  const isProductManager = activeType === '产品经理'
  const isProjectManager = activeType === '项目经理'
  const isDirectType = isProductManager || isProjectManager

  function switchType(t: TypeName) {
    setSwitching(true)
    setActiveType(t)
    setDetailTarget(null)
    const first = MENUS[t]?.[0]
    if (first) {
      setOpenKeys([first.key])
    }
    window.setTimeout(() => setSwitching(false), 220)
  }

  function toggleMenu(key: string) {
    if (openKeys.includes(key)) return
    setSwitching(true)
    setDetailTarget(null)
    setOpenKeys([key])
    window.setTimeout(() => setSwitching(false), 220)
  }

  function updateReqStatus(reqId: string, status: RequirementStatus) {
    setRequirements((prev) => prev.map((r) => (r.id === reqId ? { ...r, status } : r)))
    updateRequirementStatus(reqId, status)
  }

  function addRequirement(r: Requirement) {
    setRequirements((prev) => [...prev, r])
    insertRequirement(r)
  }

  function addCompetitor(c: Competitor) {
    setCompetitors((prev) => [...prev, c])
    insertCompetitor(c)
  }

  function deleteRequirement(reqId: string) {
    setRequirements((prev) => prev.filter((requirement) => requirement.id !== reqId))
    setRetros((prev) => prev.filter((retro) => retro.reqId !== reqId))
    setDetailTarget((current) => current === reqId ? null : current)
    setPrdDocs((prev) => {
      const next = { ...prev }
      delete next[reqId]
      return next
    })
    deleteRequirementRow(reqId)
  }

  function savePrd(reqId: string, prd: RequirementPrd) {
    setPrdDocs((prev) => ({ ...prev, [reqId]: prd }))
    setRequirements((prev) => prev.map((requirement) => requirement.id === reqId ? { ...requirement, prd } : requirement))
  }

  function updateRequirementMeetings(reqId: string, meetings: MeetingRecord[]) {
    setRequirements((prev) => prev.map((requirement) => requirement.id === reqId ? { ...requirement, meetings } : requirement))
  }

  function triggerAdd(menuKey: string) {
    setAddSignal((prev) => ({ ...prev, [menuKey]: (prev[menuKey] || 0) + 1 }))
  }

  function needsAddBtn(menuKey: string) {
    return menuKey === 'req' || menuKey === 'comp'
  }

  function renderCardContent(menuKey: string) {
    if (menuKey === 'req') {
      return (
        <ReqPool
          spaceId={space.id}
          requirements={requirements}
          activeReqId={detailTarget}
          onAdd={addRequirement}
          onOpenTrack={(reqId) => setDetailTarget(reqId)}
          onDelete={deleteRequirement}
          openSignal={addSignal['req'] || 0}
          searchQuery={searchQuery}
        />
      )
    }
    if (menuKey === 'comp') {
      return (
        <CompAnalysis
          spaceId={space.id}
          competitors={competitors}
          onAdd={addCompetitor}
          openSignal={addSignal['comp'] || 0}
          searchQuery={searchQuery}
        />
      )
    }
    return (
      <div className="empty" style={{ padding: '36px 12px' }}>
        <div style={{ fontSize: 12.5 }}>该模块暂未开放</div>
      </div>
    )
  }

  return (
    <>
      <TopBar
        title={space.name}
        types={space.types}
        activeType={activeType}
        onTypeChange={switchType}
        theme={theme}
        onThemeChange={onThemeChange}
        onBackToHome={onBackToHome}
        hideTitle
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sidebarCollapsed={collapsed}
        onToggleSidebar={() => setCollapsed(false)}
      />

      <div className={`main${isProductManager ? ' main--product' : ''}${isProjectManager ? ' main--project' : ''}`}>
        {!isDirectType && <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
          <div className="sidebar__head">
            <button
              className="icon-btn"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? '展开菜单' : '收起菜单'}
            >
              <Icon name={collapsed ? 'panelRight' : 'panelLeft'} size={15} />
            </button>
          </div>

          {menus.map((m) => {
            const on = openKeys.includes(m.key)
            return (
              <button
                key={m.key}
                className={`nav-item${on ? ' nav-item--active' : ''}${collapsed ? ' nav-item--icon' : ''}`}
                onClick={() => toggleMenu(m.key)}
                title={collapsed ? m.label : undefined}
              >
                {on && !collapsed && <span className="nav-item__bar" />}
                <Icon name={m.icon} size={collapsed ? 17 : 16} />
                {!collapsed && <span>{m.label}</span>}
                {on && collapsed && <span className="nav-item__dot" />}
              </button>
            )
          })}
        </aside>}

        <section className={`content${isProductManager ? ' content--product' : ''}${isProjectManager ? ' content--project' : ''}`}>
          {isProjectManager ? (
            <ProjectManagerBoard spaceId={space.id} searchQuery={searchQuery} />
          ) : isProductManager && detailTarget ? (() => {
            const target = requirements.find((requirement) => requirement.id === detailTarget)
            if (!target) return null
            return (
              <RequirementDetailPage
                requirement={{ ...target, prd: prdDocs[target.id] || target.prd }}
                requirements={requirements}
                competitors={competitors}
                retros={retros}
                onStatusChange={updateReqStatus}
                onSavePrd={(reqId, prd) => savePrd(reqId, prd)}
                onUpdateMeetings={updateRequirementMeetings}
                onAddRetro={(retro) => {
                  setRetros((prev) => [...prev, retro])
                  insertRetro(retro)
                }}
                onClose={() => setDetailTarget(null)}
              />
            )
          })() : !activeMenu ? (
            <div className="empty" style={{ flex: 1 }}>
              <div>没有打开的菜单</div>
              <div className="empty__hint">点击左侧菜单打开对应内容</div>
            </div>
          ) : (
            <div className={`cards${switching ? ' cards--switching' : ''}`}>
                    <div
                      className="card card--entering"
                      >
                        <div className="card__head">
                          <span className="card__title">{activeMenu.label}</span>
                          <div className="card__spacer" />
                          {needsAddBtn(activeMenu.key) && (
                            <button
                              className={`card__act${activeMenu.key === 'req' ? ' card__act--wide' : ''}`}
                              onClick={() => triggerAdd(activeMenu.key)}
                              title={activeMenu.key === 'req' ? '新增需求' : '新增'}
                            >
                              <Icon name="plus" size={15} />
                              {activeMenu.key === 'req' && <span>新增需求</span>}
                            </button>
                          )}
                        </div>
                        <div className="card__body">
                          {renderCardContent(activeMenu.key)}
                        </div>
                      </div>
            </div>
          )}
        </section>
      </div>

    </>
  )
}
