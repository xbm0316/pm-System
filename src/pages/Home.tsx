import { Banner } from '@astryxdesign/core/Banner'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, Layout, LayoutContent, LayoutHeader, VStack } from '@astryxdesign/core/Layout'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Selector } from '@astryxdesign/core/Selector'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { useState, type FormEvent } from 'react'
import ConfirmDataDeletion from '../components/ConfirmDataDeletion'
import TopBar from '../components/TopBar'
import WorkspaceDialog, { WorkspaceDialogActions } from '../components/WorkspaceDialog'
import WorkspaceIcon from '../components/Icon'
import { ALL_TYPES, type Space, type TypeName } from '../lib/store'

interface Props {
  spaces: Space[]
  onOpen: (space: Space) => void
  onCreate: (name: string, types: TypeName[]) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onLogout: () => void
}

export default function Home({ spaces, onOpen, onCreate, onRename, onDelete, onLogout }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [draft, setDraft] = useState<{ name: string; type: TypeName; id?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Space | null>(null)
  const query = searchQuery.trim().toLocaleLowerCase()
  const visibleSpaces = spaces.filter((space) => !query || [space.name, ...space.types].join(' ').toLocaleLowerCase().includes(query))

  function startCreate() {
    setSaveError('')
    setDraft({ name: '', type: '项目经理' })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    setSaveError('')
    try {
      if (draft.id) await onRename(draft.id, draft.name.trim())
      else await onCreate(draft.name.trim(), [draft.type])
      setDraft(null)
    } catch {
      setSaveError('无法保存空间，请重试')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <TopBar title="工作空间" hideTitle onLogout={onLogout} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
    <main className="app-home">
      <div className="app-home__surface">
        <Layout
          header={<LayoutHeader hasDivider padding={4}>
            <Toolbar label="工作空间操作" gap={2}
              startContent={<><Heading level={3} accessibilityLevel={1}>我的空间</Heading><Badge label={visibleSpaces.length} variant="neutral" /></>}
              endContent={<Button label="新建空间" variant="primary" icon={<WorkspaceIcon name="plus" size={16} />} onClick={startCreate} />}
            />
          </LayoutHeader>}
          content={<LayoutContent padding={4}>
            {visibleSpaces.length ? <div className="app-home__grid">
              {visibleSpaces.map((space) => (
                <ClickableCard key={space.id} padding={4} label={space.name} onClick={() => onOpen(space)}>
                    <VStack gap={2}>
                      <HStack hAlign="between" gap={2} vAlign="start">
                        <Heading level={4} accessibilityLevel={2}>{space.name}</Heading>
                        <MoreMenu size="sm" label={`${space.name}操作`} items={[
                          { label: '改名', onClick: () => { setSaveError(''); setDraft({ id: space.id, name: space.name, type: space.types[0] ?? '项目经理' }) } },
                          { label: '删除', onClick: () => setDeleteTarget(space) },
                        ]} />
                      </HStack>
                      <HStack gap={1} wrap="wrap">{space.types.map((type) => <Badge key={type} label={type} variant="neutral" />)}</HStack>
                    </VStack>
                </ClickableCard>
              ))}
            </div> : <div className="app-home__empty">
              <EmptyState title={query ? '没有匹配的空间' : '还没有空间'} icon={<Icon icon="viewColumns" size="lg" color="secondary" />} />
            </div>}
          </LayoutContent>}
        />
      </div>
    </main>
    {draft && <WorkspaceDialog title={draft.id ? '改名' : '新建空间'} onClose={() => !saving && setDraft(null)}>
      <form className="app-dialog-form" onSubmit={save}>
        <VStack gap={3}>
          <TextInput label="空间名称" isRequired hasAutoFocus value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
          {!draft.id && <Selector label="空间类型" options={[...ALL_TYPES]} value={draft.type} onChange={(value) => {
            const type = ALL_TYPES.find((option) => option === value)
            if (type) setDraft({ ...draft, type })
          }} />}
          {saveError && <Banner status="error" title={saveError} />}
        </VStack>
        <WorkspaceDialogActions>
          <Button label="取消" variant="secondary" onClick={() => setDraft(null)} isDisabled={saving} />
          <Button label={draft.id ? '保存' : '创建'} variant="primary" type="submit" isDisabled={!draft.name.trim()} isLoading={saving} />
        </WorkspaceDialogActions>
      </form>
    </WorkspaceDialog>}
    {deleteTarget && <ConfirmDataDeletion title={'删除空间「' + deleteTarget.name + '」？'} onClose={() => setDeleteTarget(null)} onDelete={() => onDelete(deleteTarget.id)} />}
  </>
}
