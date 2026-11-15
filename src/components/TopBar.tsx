import { useState } from 'react'
import Icon from './Icon'
import type { WorkspaceTabKey } from '../lib/store'

interface Props {
  title: string
  workspaceTabs?: readonly { key: WorkspaceTabKey; label: string; icon: string }[]
  activeWorkspaceTab?: WorkspaceTabKey
  onWorkspaceTabChange?: (key: WorkspaceTabKey) => void
  onBackToHome?: () => void
  onLogout?: () => void
  searchQuery?: string
  onSearchChange?: (value: string) => void
  reminderCount?: number
  hideTitle?: boolean
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export default function TopBar({ title, workspaceTabs, activeWorkspaceTab, onWorkspaceTabChange, onBackToHome, onLogout, searchQuery = '', onSearchChange, reminderCount = 0, hideTitle = false, sidebarCollapsed, onToggleSidebar }: Props) {
  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery))
  const [reminderOpen, setReminderOpen] = useState(false)

  return (
    <header className={`topbar${workspaceTabs?.length ? ' topbar--workspace' : ''}`}>
      <div className="topbar__left">
        {onToggleSidebar && sidebarCollapsed && <button className="icon-btn" onClick={onToggleSidebar} title="展开菜单"><Icon name="panelRight" size={15} /></button>}
        {!hideTitle && !workspaceTabs?.length && <div className="topbar__title">{title}</div>}
      </div>

      <div className="topbar__center">
        {workspaceTabs?.map((tab) => <button key={tab.key} className={`tab${tab.key === activeWorkspaceTab ? ' tab--active' : ''}`} onClick={() => onWorkspaceTabChange?.(tab.key)}>{tab.label}</button>)}
        {onSearchChange && searchOpen && <label className="topbar__search topbar__search--floating">
          <Icon name="search" size={15} />
          <input autoFocus value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索需求、竞品、任务…" aria-label="全局搜索" />
          {searchQuery && <button type="button" className="topbar__search-clear" onClick={() => onSearchChange('')} aria-label="清空搜索">×</button>}
        </label>}
      </div>

      <div className="topbar__right">
        <div className="topbar__tool-wrap">
          <button className={`icon-btn topbar__tool${reminderCount > 0 ? ' topbar__tool--has-reminders' : ''}`} onClick={() => setReminderOpen((value) => !value)} title="提醒：问题或任务即将过期" aria-label="打开提醒">
            <Icon name="bell" size={16} />
            {reminderCount > 0 && <span className="topbar__badge">{reminderCount > 9 ? '9+' : reminderCount}</span>}
          </button>
          {reminderOpen && <div className="topbar__popover"><strong>提醒</strong><span>{reminderCount > 0 ? `有 ${reminderCount} 项问题或任务需要关注` : '暂无即将过期的任务或未处理问题'}</span></div>}
        </div>
        {onSearchChange && <button className={`icon-btn topbar__tool${searchOpen || searchQuery ? ' topbar__tool--active' : ''}`} onClick={() => setSearchOpen((value) => !value)} title="搜索" aria-label="打开搜索"><Icon name="search" size={16} /></button>}
        <button className="icon-btn" onClick={onBackToHome || onLogout} title={onBackToHome ? '返回工作空间' : '退出登录'}><Icon name={onBackToHome ? 'arrowLeft' : 'logout'} size={15} /></button>
      </div>
    </header>
  )
}
