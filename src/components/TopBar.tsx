import { Badge } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useEffect, useRef, useState } from 'react'
import { formatTodoDueAt, type Todo } from '../lib/todos'
import Icon from './Icon'
import { richTextPlainText } from '../lib/richText'

type Reminder = { id: string; kind: 'task' | 'issue' | 'requirement'; title: string; dueDate: string; taskId?: string; reqId?: string }

interface Props {
  title: string
  workspaceTabs?: readonly { key: string; label: string; icon: string }[]
  activeWorkspaceTab?: string
  onWorkspaceTabChange?: (key: string) => void
  onBackToHome?: () => void
  onLogout?: () => void
  searchQuery?: string
  searchLabel?: string
  onSearchChange?: (value: string) => void
  reminderCount?: number
  reminderItems?: Reminder[]
  onReminderClick?: (item: Reminder) => void
  todoReminders?: Todo[]
  todoReminderError?: string
  onCompleteTodo?: (id: string) => void
  onOpenTodoDetails?: (id: string) => void
  todoDetailsOpen?: boolean
  onSummaryClick?: () => void
  hideTitle?: boolean
}

export default function TopBar({
  title, workspaceTabs, activeWorkspaceTab, onWorkspaceTabChange, onBackToHome, onLogout,
  searchQuery = '', searchLabel = '搜索工作空间', onSearchChange, reminderCount = 0, reminderItems = [],
  onReminderClick, todoReminders, todoReminderError, onCompleteTodo, onOpenTodoDetails, todoDetailsOpen = false,
  onSummaryClick, hideTitle = false,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery))
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderTab, setReminderTab] = useState('tasks')
  const searchWrap = useRef<HTMLDivElement>(null)
  const reminderWrap = useRef<HTMLDivElement>(null)
  const searchButton = useRef<HTMLButtonElement>(null)
  const detailTrigger = useRef<HTMLElement | null>(null)
  const totalReminders = reminderCount + (todoReminders?.length ?? 0)

  useEffect(() => {
    if (!searchOpen) return
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !searchWrap.current?.contains(event.target)) setSearchOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        searchButton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [searchOpen])

  useEffect(() => {
    const trigger = detailTrigger.current
    if (todoDetailsOpen || !trigger) return
    detailTrigger.current = null
    if (trigger.isConnected) trigger.focus()
    else reminderWrap.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
  }, [todoDetailsOpen])

  return (
    <header className={`app-topbar${workspaceTabs?.length ? ' app-topbar--workspace' : ''}`}>
      <div className="app-topbar__start">
        <IconButton label={onBackToHome ? '返回工作空间' : '退出登录'} icon={<Icon name={onBackToHome ? 'arrowLeft' : 'logout'} size={16} />} onClick={onBackToHome || onLogout} />
        {!hideTitle && !workspaceTabs?.length && <Heading level={4}>{title}</Heading>}
      </div>
      {workspaceTabs && activeWorkspaceTab && onWorkspaceTabChange && <div className="app-topbar__tabs">
        <TabList value={activeWorkspaceTab} onChange={onWorkspaceTabChange} size="sm">
          {workspaceTabs.map((tab) => <Tab key={tab.key} value={tab.key} label={tab.label} />)}
        </TabList>
      </div>}
      <div className="app-topbar__end">
        {(todoReminders || reminderItems.length > 0 || reminderCount > 0) && <div className="app-topbar__control">
          <IconButton label="打开提醒" icon={<Icon name="bell" size={16} />} aria-haspopup="dialog" aria-expanded={reminderOpen} onClick={() => { setSearchOpen(false); setReminderOpen(true) }} />
          {totalReminders > 0 && <span className="app-topbar__count"><Badge label={totalReminders > 9 ? '9+' : totalReminders} variant="neutral" /></span>}
          <Drawer label="提醒" side="end" width={400} isOpen={reminderOpen} onOpenChange={setReminderOpen}>
            <DrawerHeader title="提醒" onOpenChange={setReminderOpen} hasDivider />
            <div className="app-reminder-drawer" ref={reminderWrap}>
              {todoReminders && <TabList value={reminderTab} onChange={setReminderTab} role="tablist" size="sm" hasDivider>
                <Tab value="tasks" label="任务" panelId="task-reminder-panel" />
                <Tab value="todos" label="待办事项" panelId="todo-reminder-panel" />
              </TabList>}
              {todoReminders && reminderTab === 'todos' ? (
                <div role="tabpanel" aria-label="待办事项" id="todo-reminder-panel" className="app-topbar__reminder-list">
                  {todoReminderError && <Banner status="error" title={todoReminderError} />}
                  {todoReminders.length ? todoReminders.map((item) => (
                    <ClickableCard key={item.id} padding={2} label={`查看待办 ${item.title}`} onClick={(event) => {
                      detailTrigger.current = event.currentTarget.matches('button') ? event.currentTarget : event.currentTarget.querySelector('button')
                      onOpenTodoDetails?.(item.id)
                    }}>
                    <div className="app-topbar__reminder-row">
                      <div>
                        <Text>{item.title}</Text>
                        <Text type="supporting" color="secondary" display="block">截止 {formatTodoDueAt(item.dueAt)}</Text>
                        {item.content && <Text type="supporting" display="block" color="secondary">{richTextPlainText(item.content)}</Text>}
                      </div>
                      <Button size="sm" variant="secondary" label="完成" aria-label={`完成 ${item.title}`} onClick={() => onCompleteTodo?.(item.id)} />
                    </div>
                    </ClickableCard>
                  )) : <Text type="supporting" color="secondary">暂无一小时内到期的待办事项</Text>}
                </div>
              ) : (
                <div role={todoReminders ? 'tabpanel' : undefined} aria-label="任务" id="task-reminder-panel" className="app-topbar__reminder-list">
                  {reminderItems.length ? reminderItems.map((item) => (
                    <ClickableCard key={item.id} padding={2} label={`查看 ${item.title}`} onClick={() => { onReminderClick?.(item); setReminderOpen(false) }}>
                        <Text>{item.kind === 'task' ? '任务' : item.kind === 'issue' ? '问题' : '需求'} · {item.title}</Text>
                        <Text type="supporting" color="secondary" display="block">截止 {item.dueDate}</Text>
                    </ClickableCard>
                  )) : <Text type="supporting" color="secondary">暂无 24 小时内到期的内容</Text>}
                </div>
              )}
            </div>
          </Drawer>
        </div>}
        {onSearchChange && <div className="app-topbar__control" ref={searchWrap}>
          <IconButton ref={searchButton} label="打开搜索" icon={<Icon name="search" size={16} />} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)} />
          {searchOpen && <div className="app-topbar__floating app-topbar__search">
            <Card padding={2} elevation="med">
              <TextInput label={searchLabel} placeholder={`${searchLabel}…`} type="search" isLabelHidden hasAutoFocus hasClear width="100%" value={searchQuery} onChange={onSearchChange} />
            </Card>
          </div>}
        </div>}
        {onSummaryClick && <IconButton label="打开总结" icon={<Icon name="summary" size={16} />} onClick={() => { setSearchOpen(false); onSummaryClick() }} />}
      </div>
    </header>
  )
}
