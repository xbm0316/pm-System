import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { InfoTip } from '@astryxdesign/core/InfoTip'
import { HStack, Layout, LayoutContent, LayoutHeader, VStack } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Selector } from '@astryxdesign/core/Selector'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { uid } from '../lib/store'
import WorkspaceIcon from './Icon'
import WorkspaceDialog from './WorkspaceDialog'

type ResourceType = '账号' | '教程'

export interface TutorialType {
  id: string
  title: string
  description: string
  color: string
}

export interface TutorialCard {
  id: string
  typeId: string
  title: string
  description: string
  url: string
  source: string
  resourceType?: ResourceType
  account?: string
  password?: string
  goal: string
  steps: string
  outputs: string
  status: '未开始' | '学习中' | '已完成' | '待复习'
  notes: string
  attachments: string[]
  nextAction: string
  reviewDate: string
  createdAt?: number
  updatedAt: number
}

interface KnowledgeData {
  knowledgeTypes: TutorialType[]
  tutorialCards: TutorialCard[]
}

interface Props extends KnowledgeData {
  searchQuery: string
  onChange: (update: (data: KnowledgeData) => KnowledgeData) => void
}

const columnColors = [
  { value: 'neutral', label: '中性灰' },
  { value: 'accent', label: '强调色' },
  { value: 'warning', label: '黄色' },
  { value: 'success', label: '绿色' },
  { value: 'error', label: '红色' },
] as const

const dragThreshold = 5

function columnColor(value: string, index: number) {
  const legacyColors = ['#0951c3', '#0e9b83', '#e39a26', '#df6d5c', '#bd5bb4']
  const legacyIndex = legacyColors.indexOf(value.toLowerCase())
  return columnColors.find((color) => color.value === value)?.value ?? columnColors[legacyIndex < 0 ? index % columnColors.length : legacyIndex].value
}

export default function OperationsKnowledgeBoard({ knowledgeTypes, tutorialCards, searchQuery, onChange }: Props) {
  const [cardDraft, setCardDraft] = useState<TutorialCard | null>(null)
  const [typeDraft, setTypeDraft] = useState<TutorialType | null>(null)
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null)
  const [showDraftPassword, setShowDraftPassword] = useState(false)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [dropColumn, setDropColumn] = useState<string | null>(null)
  const [deletion, setDeletion] = useState<{ kind: 'type' | 'card'; id: string; name: string } | null>(null)
  const dragStart = useRef<{ card: TutorialCard; x: number; y: number; moved: boolean } | null>(null)
  const draggedClick = useRef(false)

  const query = searchQuery.trim().toLocaleLowerCase()
  const cardsByType = useMemo(() => {
    const groups = new Map<string, TutorialCard[]>()
    const cards = tutorialCards
      .filter((card) => !query || `${card.title} ${card.description} ${card.notes} ${card.status}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => (b.createdAt ?? b.updatedAt) - (a.createdAt ?? a.updatedAt))
    for (const card of cards) {
      const group = groups.get(card.typeId)
      if (group) group.push(card)
      else groups.set(card.typeId, [card])
    }
    return groups
  }, [query, tutorialCards])
  const visibleCount = knowledgeTypes.reduce((count, type) => count + (cardsByType.get(type.id)?.length ?? 0), 0)

  function openCard(card: TutorialCard) {
    setShowDraftPassword(false)
    setVisiblePasswordId(null)
    setCardDraft(card)
  }

  function addCard(typeId: string) {
    openCard({ id: uid(), typeId, title: '', description: '', url: '', source: '', resourceType: '教程', account: '', password: '', goal: '', steps: '', outputs: '', status: '未开始', notes: '', attachments: [], nextAction: '', reviewDate: '', updatedAt: Date.now() })
  }

  function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cardDraft?.title.trim() || (cardDraft.resourceType === '账号' && (!cardDraft.account?.trim() || !cardDraft.password))) return
    const draft = cardDraft
    const now = Date.now()
    onChange((data) => {
      const existing = data.tutorialCards.find((card) => card.id === draft.id)
      const saved = {
        ...draft,
        title: draft.title.trim(),
        account: draft.resourceType === '账号' ? draft.account?.trim() : '',
        password: draft.resourceType === '账号' ? draft.password : '',
        url: draft.url.trim(),
        createdAt: existing?.createdAt ?? existing?.updatedAt ?? now,
        updatedAt: now,
      }
      return {
        ...data,
        tutorialCards: existing
          ? data.tutorialCards.map((card) => card.id === saved.id ? saved : card)
          : [...data.tutorialCards, saved],
      }
    })
    setCardDraft(null)
  }

  function saveType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!typeDraft?.title.trim()) return
    const saved = { ...typeDraft, title: typeDraft.title.trim() }
    onChange((data) => ({
      ...data,
      knowledgeTypes: data.knowledgeTypes.some((type) => type.id === saved.id)
        ? data.knowledgeTypes.map((type) => type.id === saved.id ? saved : type)
        : [...data.knowledgeTypes, saved],
    }))
    setTypeDraft(null)
  }

  function moveCard(cardId: string, typeId: string) {
    const now = Date.now()
    setVisiblePasswordId(null)
    onChange((data) => ({
      ...data,
      tutorialCards: data.tutorialCards.map((card) => card.id === cardId && card.typeId !== typeId
        ? { ...card, typeId, createdAt: card.createdAt ?? card.updatedAt, updatedAt: now }
        : card),
    }))
  }

  function dropTarget(event: PointerEvent<HTMLElement>, card: TutorialCard) {
    const lane = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.knowledge-kanban__lane')
    return lane?.dataset.typeId && lane.dataset.typeId !== card.typeId ? lane.dataset.typeId : null
  }

  function startDrag(event: PointerEvent<HTMLElement>, card: TutorialCard) {
    draggedClick.current = false
    if (event.pointerType === 'touch' || event.button !== 0 || !(event.target instanceof Element) || event.target.closest('button, a')) return
    dragStart.current = { card, x: event.clientX, y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function updateDrag(event: PointerEvent<HTMLElement>) {
    const start = dragStart.current
    if (!start) return
    if (!start.moved) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < dragThreshold) return
      start.moved = true
      setDraggedCardId(start.card.id)
    }
    setDropColumn(dropTarget(event, start.card))
  }

  function finishDrag(event: PointerEvent<HTMLElement>) {
    const start = dragStart.current
    if (start?.moved) {
      draggedClick.current = true
      if (event.type === 'pointerup') {
        const target = dropTarget(event, start.card)
        if (target) moveCard(start.card.id, target)
      }
    }
    dragStart.current = null
    setDraggedCardId(null)
    setDropColumn(null)
  }

  function confirmDeletion() {
    if (!deletion) return
    onChange((data) => {
      if (deletion.kind === 'card') return { ...data, tutorialCards: data.tutorialCards.filter((card) => card.id !== deletion.id) }
      if (data.knowledgeTypes.length <= 1) return data
      return {
        knowledgeTypes: data.knowledgeTypes.filter((type) => type.id !== deletion.id),
        tutorialCards: data.tutorialCards.filter((card) => card.typeId !== deletion.id),
      }
    })
    setDeletion(null)
  }

  return <>
    <div className="knowledge-kanban">
      <Layout
        height="fill"
        header={<LayoutHeader hasDivider padding={4}>
          <Toolbar label="资料库操作" gap={2}
            startContent={<><Heading level={3} accessibilityLevel={1}>资料库</Heading><Badge label={visibleCount} variant="neutral" /></>}
            endContent={<HStack gap={2} wrap="wrap">
              <Button label="新增类型" variant="secondary" onClick={() => setTypeDraft({ id: uid(), title: '', description: '', color: columnColor('', knowledgeTypes.length) })} />
              <Button label="新增资料" variant="primary" icon={<WorkspaceIcon name="plus" size={16} />} onClick={() => addCard(knowledgeTypes[0].id)} />
            </HStack>}
          />
        </LayoutHeader>}
        content={<LayoutContent padding={0}>
          <div className="knowledge-kanban__lanes" aria-label="资料分类看板">
            {knowledgeTypes.map((type, index) => {
              const cards = cardsByType.get(type.id) ?? []
              const isDropTarget = dropColumn === type.id
              return <section key={type.id} className="knowledge-kanban__lane" aria-label={type.title} data-type-id={type.id} data-drop-target={isDropTarget || undefined}>
                <Card variant="muted" padding={0} className="knowledge-kanban__lane-surface">
                  <Layout height="fill"
                    header={<LayoutHeader hasDivider padding={3}>
                      <div className="knowledge-kanban__lane-heading">
                        <span aria-hidden="true"><StatusDot variant={columnColor(type.color, index)} label="类型颜色" /></span>
                        <Heading level={4} accessibilityLevel={2}>{type.title}</Heading>
                        {type.description && <InfoTip label={`关于${type.title}`} content={type.description} />}
                        <Text type="supporting" color="secondary" hasTabularNumbers>{cards.length}</Text>
                        <IconButton size="sm" variant="ghost" label={`在${type.title}中新增资料`} icon={<WorkspaceIcon name="plus" size={15} />} onClick={() => addCard(type.id)} />
                        <MoreMenu label={`${type.title}操作`} size="sm" items={[
                          { label: '编辑类型', onClick: () => setTypeDraft({ ...type, color: columnColor(type.color, index) }) },
                          { label: '删除类型', isDisabled: knowledgeTypes.length <= 1, onClick: () => setDeletion({ kind: 'type', id: type.id, name: type.title }) },
                        ]} />
                      </div>
                    </LayoutHeader>}
                    content={<LayoutContent padding={2}>
                      <VStack gap={2}>
                        {cards.length === 0 && <div className="knowledge-kanban__empty">
                          <EmptyState isCompact icon={<Icon icon="viewColumns" size="lg" color="secondary" />} title={query ? '暂无匹配资料' : '暂无资料'} />
                        </div>}
                        {cards.map((card) => {
                          const account = card.resourceType === '账号'
                          const passwordVisible = visiblePasswordId === card.id
                          return <ClickableCard key={card.id} padding={3} label={card.title} className="knowledge-kanban__card" data-dragged={draggedCardId === card.id || undefined}
                            onClick={() => { if (!draggedClick.current) openCard(card) }}
                            onKeyDown={() => { draggedClick.current = false }}
                            onPointerDown={(event) => startDrag(event, card)}
                            onPointerMove={updateDrag}
                            onPointerUp={finishDrag}
                            onPointerCancel={finishDrag}
                            onLostPointerCapture={finishDrag}>
                              <VStack gap={2}>
                                <HStack hAlign="between" vAlign="start">
                                  <Badge label={account ? '账号' : '教程'} variant={account ? 'teal' : 'neutral'} />
                                  <MoreMenu label={`${card.title}操作`} size="sm" items={[
                                    { label: '编辑资料', onClick: () => openCard(card) },
                                    ...knowledgeTypes.filter((target) => target.id !== type.id).map((target) => ({ label: `移到${target.title}`, onClick: () => moveCard(card.id, target.id) })),
                                    { type: 'divider' },
                                    { label: '删除资料', onClick: () => setDeletion({ kind: 'card', id: card.id, name: card.title }) },
                                  ]} />
                                </HStack>
                                <VStack gap={1}>
                                  <Heading level={4} accessibilityLevel={3}>{card.title}</Heading>
                                  {card.description && <Text type="supporting" color="secondary" maxLines={2}>{card.description}</Text>}
                                </VStack>
                                {account && (card.account || card.password) && <VStack gap={1}>
                                  {card.account && <Text type="supporting" color="secondary">账号：{card.account}</Text>}
                                  {card.password && <div className="knowledge-kanban__password">
                                    <Text type="supporting" color="secondary">密码：{passwordVisible ? card.password : '••••••••'}</Text>
                                    <Button size="sm" variant="ghost" label={passwordVisible ? '隐藏密码' : '查看密码'} onClick={() => setVisiblePasswordId(passwordVisible ? null : card.id)} />
                                  </div>}
                                </VStack>}
                                {card.url
                                  ? <Link href={card.url} isExternalLink newTabLabel="（在新标签页打开）" type="supporting">打开资料</Link>
                                  : <Text type="supporting" color="secondary">未添加资料链接</Text>}
                              </VStack>
                          </ClickableCard>
                        })}
                      </VStack>
                    </LayoutContent>}
                  />
                </Card>
              </section>
            })}
          </div>
        </LayoutContent>}
      />
    </div>

    {cardDraft && <WorkspaceDialog title={tutorialCards.some((card) => card.id === cardDraft.id) ? '编辑资料' : '新增资料'} onClose={() => setCardDraft(null)}>
      <form className="knowledge-kanban__form" onSubmit={saveCard}>
        <VStack gap={3}>
          <TextInput label="资料名称" isRequired value={cardDraft.title} onChange={(title) => setCardDraft({ ...cardDraft, title })} />
          <Selector label="所属分类" value={cardDraft.typeId} options={knowledgeTypes.map(({ id, title }) => ({ value: id, label: title }))} onChange={(typeId) => setCardDraft({ ...cardDraft, typeId })} />
          <Selector label="资料类型" value={cardDraft.resourceType ?? '教程'} options={['教程', '账号']} onChange={(value) => {
            setShowDraftPassword(false)
            setCardDraft({ ...cardDraft, resourceType: value === '账号' ? '账号' : '教程' })
          }} />
          {cardDraft.resourceType === '账号' && <>
            <TextInput label="账号" isRequired value={cardDraft.account ?? ''} onChange={(account) => setCardDraft({ ...cardDraft, account })} />
            <HStack gap={2} vAlign="end">
              <TextInput label="密码" isRequired type={showDraftPassword ? 'text' : 'password'} autoComplete="off" width="100%" value={cardDraft.password ?? ''} onChange={(password) => setCardDraft({ ...cardDraft, password })} />
              <IconButton label={showDraftPassword ? '隐藏密码' : '显示密码'} icon={<WorkspaceIcon name="eye" size={16} />} onClick={() => setShowDraftPassword((visible) => !visible)} />
            </HStack>
          </>}
          <TextInput label="链接" type="url" value={cardDraft.url} onChange={(url) => setCardDraft({ ...cardDraft, url })} placeholder="https://" />
        </VStack>
        <HStack gap={2} hAlign="end">
          <Button label="取消" variant="secondary" onClick={() => setCardDraft(null)} />
          <Button label="保存资料" variant="primary" type="submit" isDisabled={!cardDraft.title.trim() || (cardDraft.resourceType === '账号' && (!cardDraft.account?.trim() || !cardDraft.password))} />
        </HStack>
      </form>
    </WorkspaceDialog>}

    {typeDraft && <WorkspaceDialog title={knowledgeTypes.some((type) => type.id === typeDraft.id) ? '编辑资料类型' : '新增资料类型'} onClose={() => setTypeDraft(null)}>
      <form className="knowledge-kanban__form" onSubmit={saveType}>
        <VStack gap={3}>
          <TextInput label="类型名称" isRequired value={typeDraft.title} onChange={(title) => setTypeDraft({ ...typeDraft, title })} />
          <Selector label="类型颜色" value={typeDraft.color} options={columnColors.map(({ value, label }) => ({ value, label, icon: <span aria-hidden="true"><StatusDot variant={value} label={label} /></span> }))}
            onChange={(color) => setTypeDraft({ ...typeDraft, color })} />
          <TextArea label="类型说明" value={typeDraft.description} onChange={(description) => setTypeDraft({ ...typeDraft, description })} />
        </VStack>
        <HStack gap={2} hAlign="end">
          <Button label="取消" variant="secondary" onClick={() => setTypeDraft(null)} />
          <Button label="保存类型" variant="primary" type="submit" isDisabled={!typeDraft.title.trim()} />
        </HStack>
      </form>
    </WorkspaceDialog>}

    {deletion && <WorkspaceDialog title={deletion.kind === 'type' ? '删除资料类型？' : '删除资料？'} onClose={() => setDeletion(null)}>
      <div className="knowledge-kanban__form">
        <Text type="body">{deletion.kind === 'type' ? `删除「${deletion.name}」后，该类型下的资料也会被删除。` : `删除「${deletion.name}」后无法恢复。`}</Text>
        <HStack gap={2} hAlign="end">
          <Button label="取消" variant="secondary" onClick={() => setDeletion(null)} />
          <Button label="确认删除" variant="destructive" onClick={confirmDeletion} />
        </HStack>
      </div>
    </WorkspaceDialog>}
  </>
}
