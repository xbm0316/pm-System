import { Badge } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { DateTimeInput, type ISODateTimeString } from '@astryxdesign/core/DateTimeInput'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, Layout, LayoutContent, LayoutHeader, VStack } from '@astryxdesign/core/Layout'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { useRef, useState, type FormEvent } from 'react'
import { formatTodoDueAt, type Todo, type TodoFields } from '../lib/todos'
import { dateKey } from './DatePicker'
import Icon from './Icon'
import RichTextField from './RichTextField'
import { richTextPlainText } from '../lib/richText'
import WorkspaceDialog, { WorkspaceDialogActions } from './WorkspaceDialog'

interface Props {
  todos: Todo[]
  searchQuery: string
  error: string
  onOpenDetails: (id: string) => void
  onSave: (fields: TodoFields, id?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onComplete: (id: string) => Promise<boolean>
}

interface Draft {
  id?: string
  title: string
  content: string
  dueAt: ISODateTimeString | undefined
}

function newDraft(): Draft {
  return { title: '', content: '', dueAt: `${dateKey(new Date())}T23:59` as ISODateTimeString }
}

export function TodoDetailDialog({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  return <WorkspaceDialog title="待办详情" onClose={onClose} purpose="info" className="todo-dialog">
    <dl className="todo-details">
      <div><dt>标题</dt><dd>{todo.title}</dd></div>
      <div><dt>完成时间</dt><dd><time dateTime={new Date(todo.dueAt).toISOString()}>{formatTodoDueAt(todo.dueAt)}</time></dd></div>
      <div><dt>内容</dt><dd>{todo.content || '未填写内容'}</dd></div>
    </dl>
  </WorkspaceDialog>
}

export default function TodoWorkspace({ todos, searchQuery, error, onOpenDetails, onSave, onDelete, onComplete }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Todo | null>(null)
  const [saving, setSaving] = useState(false)
  const [dateInvalid, setDateInvalid] = useState(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const canSave = Boolean(draft?.title.trim() && draft.dueAt && !dateInvalid)
  const query = searchQuery.trim().toLocaleLowerCase()
  // Older records have no timestamp, but storage preserves their insertion order.
  const visible = todos.filter((item) => !query || `${item.title} ${richTextPlainText(item.content)}`.toLocaleLowerCase().includes(query))
    .reverse().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const now = Date.now()
  const groups = [
    { title: '未完成', items: visible.filter((item) => item.completedAt === undefined && new Date(item.dueAt).getTime() >= now), done: false, variant: 'neutral' as const },
    { title: '已完成', items: visible.filter((item) => item.completedAt !== undefined), done: true, variant: 'success' as const },
    { title: '已超时', items: visible.filter((item) => item.completedAt === undefined && new Date(item.dueAt).getTime() < now), done: false, variant: 'error' as const },
  ]

  function openDraft(value: Draft) {
    setDateInvalid(false)
    setDraft(value)
  }

  function editTodo(todo: Todo) {
    const due = new Date(todo.dueAt)
    const time = [due.getHours(), due.getMinutes()].map((part) => String(part).padStart(2, '0')).join(':')
    openDraft({ id: todo.id, title: todo.title, content: todo.content, dueAt: `${dateKey(due)}T${time}` as ISODateTimeString })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft?.dueAt || !canSave || saving || event.currentTarget.querySelector('[aria-invalid="true"]')) return
    const dueAt = new Date(draft.dueAt).getTime()
    if (!Number.isFinite(dueAt)) return
    const keepOpen = !draft.id && (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'continue'
    setSaving(true)
    const saved = await onSave({ title: draft.title.trim(), content: draft.content.trim(), dueAt }, draft.id)
    setSaving(false)
    if (!saved) return
    if (keepOpen) {
      openDraft(newDraft())
      titleInput.current?.focus()
    } else setDraft(null)
  }

  return <div className="todo-workspace astryx-todos">
    <Layout
      header={<LayoutHeader hasDivider padding={4}>
        <Toolbar label="待办操作" gap={2}
          startContent={<><Heading level={3} accessibilityLevel={1}>待办事项</Heading><Badge label={visible.length} variant="neutral" /></>}
          endContent={<Button label="新增待办" variant="primary" icon={<Icon name="plus" size={16} />} onClick={() => openDraft(newDraft())} />}
        />
      </LayoutHeader>}
      content={<LayoutContent padding={4}>
        {error && !draft && !deleteTarget && <Banner status="error" title={error} />}
        <div className="astryx-todos__columns">
          {groups.map(({ title, items, done, variant }) => (
            <section className="astryx-todos__section" key={title} aria-label={title}>
              <HStack gap={2} vAlign="center">
                <span aria-hidden="true"><StatusDot label={title} variant={variant} /></span>
                <Heading level={4} accessibilityLevel={2}>{title}</Heading>
                <Badge label={items.length} variant={done ? 'green' : variant === 'error' ? 'error' : 'neutral'} />
              </HStack>
              {items.length ? <div className="todo-grid">
                {items.map((item) => <ClickableCard key={item.id} padding={3} className="astryx-todos__card" label={`查看详情 ${item.title}`} onClick={() => onOpenDetails(item.id)}>
                  <VStack gap={2}>
                    <Heading level={4} accessibilityLevel={3}>{item.title}</Heading>
                    <Text type="supporting" color="secondary"><time dateTime={new Date(item.dueAt).toISOString()}>{formatTodoDueAt(item.dueAt)}</time></Text>
                    {item.content && <Text type="supporting" color="secondary" maxLines={3}>{richTextPlainText(item.content)}</Text>}
                    <HStack gap={1} hAlign="end" wrap="wrap">
                      <IconButton label={`编辑 ${item.title}`} size="sm" variant="ghost" icon={<Icon name="edit" size={14} />} onClick={() => editTodo(item)} />
                      <IconButton label={`删除 ${item.title}`} size="sm" variant="ghost" icon={<Icon name="trash" size={14} />} onClick={() => setDeleteTarget(item)} />
                      {!done && <Button size="sm" variant="secondary" label="完成" aria-label={`完成 ${item.title}`} onClick={() => { void onComplete(item.id) }} />}
                    </HStack>
                  </VStack>
                </ClickableCard>)}
              </div> : <EmptyState isCompact title={query ? '暂无匹配的待办事项' : `暂无${title}的待办事项`} />}
            </section>
          ))}
        </div>
      </LayoutContent>}
    />
    {draft && <WorkspaceDialog title={draft.id ? '编辑待办' : '新增待办'} onClose={() => !saving && setDraft(null)} className="todo-dialog">
      <form className="app-dialog-form" onSubmit={save}>
        <VStack gap={3}>
          <TextInput ref={titleInput} label="标题" isRequired hasAutoFocus value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <DateTimeInput label="完成时间" isRequired hourFormat="24h" weekStartsOn="mon" width="100%" value={draft.dueAt}
            onChange={(dueAt) => setDraft({ ...draft, dueAt })} onEntryErrorChange={(entryError) => setDateInvalid(Boolean(entryError))} />
          <RichTextField label="内容" value={draft.content} placeholder="补充待办内容" onChange={(content) => setDraft({ ...draft, content })} />
          {error && <Banner status="error" title={error} />}
        </VStack>
        <WorkspaceDialogActions>
          <Button label="取消" variant="secondary" isDisabled={saving} onClick={() => setDraft(null)} />
          <Button label="保存" variant="primary" type="submit" isDisabled={!canSave || saving} />
          {!draft.id && <Button label="连续保存" variant="ghost" type="submit" value="continue" isDisabled={!canSave || saving} />}
        </WorkspaceDialogActions>
      </form>
    </WorkspaceDialog>}
    {deleteTarget && <WorkspaceDialog title="确认删除待办？" onClose={() => !saving && setDeleteTarget(null)} purpose="info">
      <div className="app-dialog-form">
        <Text>删除「{deleteTarget.title}」后无法恢复。</Text>
        {error && <Banner status="error" title={error} />}
        <WorkspaceDialogActions>
          <Button label="取消" variant="secondary" isDisabled={saving} onClick={() => setDeleteTarget(null)} />
          <Button label="确认删除" variant="destructive" isLoading={saving} onClick={() => {
            setSaving(true)
            void onDelete(deleteTarget.id).then((saved) => {
              setSaving(false)
              if (saved) setDeleteTarget(null)
            })
          }} />
        </WorkspaceDialogActions>
      </div>
    </WorkspaceDialog>}
  </div>
}
