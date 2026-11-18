import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
interface Props {
  title: string
  workspaceTabs?: readonly { key: string; label: string; icon: string }[]
  activeWorkspaceTab?: string
  onWorkspaceTabChange?: (key: string) => void
  onBackToHome?: () => void
  onLogout?: () => void
  searchQuery?: string
  onSearchChange?: (value: string) => void
  reminderCount?: number
  reminderItems?: { id: string; kind: 'task' | 'issue' | 'requirement'; title: string; dueDate: string; taskId?: string; reqId?: string }[]
  onReminderClick?: (item: { id: string; kind: 'task' | 'issue' | 'requirement'; title: string; dueDate: string; taskId?: string; reqId?: string }) => void
  onSummaryClick?: () => void
  hideReminder?: boolean
  hideTitle?: boolean
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export default function TopBar({ title, workspaceTabs, activeWorkspaceTab, onWorkspaceTabChange, onBackToHome, onLogout, searchQuery = '', onSearchChange, reminderCount = 0, reminderItems = [], onReminderClick, onSummaryClick, hideReminder = false, hideTitle = false, sidebarCollapsed, onToggleSidebar }: Props) {
  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery))
  const [reminderOpen, setReminderOpen] = useState(false)
  const reminderWrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLLabelElement>(null)

  useEffect(() => {
    function closeFloating(event: MouseEvent) {
      const target = event.target as Node
      if (reminderWrapRef.current && !reminderWrapRef.current.contains(target)) setReminderOpen(false)
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', closeFloating)
    return () => document.removeEventListener('mousedown', closeFloating)
  }, [])

  return (
    <header className={`topbar${workspaceTabs?.length ? ' topbar--workspace' : ''}`}>
      <div className="topbar__left">
        {onToggleSidebar && sidebarCollapsed && <button className="icon-btn" onClick={onToggleSidebar} title="展开菜单"><Icon name="panelRight" size={15} /></button>}
        <button className="icon-btn topbar__exit" onClick={onBackToHome || onLogout} title={onBackToHome ? '返回工作空间' : '退出登录'} aria-label={onBackToHome ? '返回工作空间' : '退出登录'}><Icon name={onBackToHome ? 'arrowLeft' : 'logout'} size={15} /></button>
        {!hideTitle && !workspaceTabs?.length && <div className="topbar__title">{title}</div>}
      </div>

      <div className="topbar__center">
        {workspaceTabs?.map((tab) => <button key={tab.key} className={`tab${tab.key === activeWorkspaceTab ? ' tab--active' : ''}`} onClick={() => onWorkspaceTabChange?.(tab.key)}>{tab.label}</button>)}
        {onSearchChange && searchOpen && <label ref={searchRef} className="topbar__search topbar__search--floating">
          <Icon name="search" size={15} />
          <input autoFocus value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索需求、竞品、任务…" aria-label="全局搜索" />
          {searchQuery && <button type="button" className="topbar__search-clear" onClick={() => onSearchChange('')} aria-label="清空搜索">×</button>}
        </label>}
      </div>

      <div className="topbar__right">
        {!hideReminder && <div className="topbar__tool-wrap" ref={reminderWrapRef}>
          <button className={`icon-btn topbar__tool${reminderCount > 0 ? ' topbar__tool--has-reminders' : ''}`} onClick={() => { setReminderOpen((value) => !value); setSearchOpen(false) }} title="打开提醒" aria-label="打开提醒">
            <Icon name="bell" size={16} />
            {reminderCount > 0 && <span className="topbar__badge">{reminderCount > 9 ? '9+' : reminderCount}</span>}
          </button>
          {reminderOpen && <div className="topbar__popover"><strong>提醒</strong>{reminderItems.length ? <div className="topbar__reminder-list">{reminderItems.map((item) => <button type="button" key={item.id} className="topbar__reminder-item" onClick={() => { onReminderClick?.(item); setReminderOpen(false) }}><span>{item.kind === 'task' ? '任务' : item.kind === 'issue' ? '问题' : '需求'} · {item.title}</span><small>截止 {item.dueDate}</small></button>)}</div> : <span>暂无 24 小时内到期的内容</span>}</div>}
        </div>}
        {onSearchChange && <button className={`icon-btn topbar__tool${searchOpen || searchQuery ? ' topbar__tool--active' : ''}`} onClick={() => { setSearchOpen((value) => !value); setReminderOpen(false) }} title="搜索" aria-label="打开搜索"><Icon name="search" size={16} /></button>}
        {onSummaryClick && <button className="icon-btn topbar__tool" onClick={() => { setSearchOpen(false); setReminderOpen(false); onSummaryClick() }} title="查看总结" aria-label="打开总结"><Icon name="summary" size={16} /></button>}
      </div>
    </header>
  )
}
