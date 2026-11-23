import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Text'
import { FileInput } from '@astryxdesign/core/FileInput'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import WorkspaceDialog, { WorkspaceOverlay } from './WorkspaceDialog'
import { Text } from '@astryxdesign/core/Text'
import { HStack } from '@astryxdesign/core/Layout'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { type Competitor, type RequirementAttachment, uid } from '../lib/store'
import { deleteLocalFile, uploadLocalFile } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'

interface Props { spaceId: string; competitors: Competitor[]; onAdd: (c: Competitor) => void; onUpdate: (id: string, patch: Partial<Competitor>) => void; onDelete: (id: string) => void; openSignal: number; searchQuery?: string }

export default function CompAnalysis({ spaceId, competitors, onAdd, onUpdate, onDelete, openSignal, searchQuery = '' }: Props) {
  const [draft, setDraft] = useState<Competitor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Competitor | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const consumedSignal = useRef(openSignal)
  useEffect(() => { if (openSignal !== consumedSignal.current) { consumedSignal.current = openSignal; if (openSignal > 0) openEditor() } }, [openSignal])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  const query = searchQuery.trim().toLocaleLowerCase()
  const list = competitors.filter((c) => c.spaceId === spaceId).filter((c) => !query || [c.name, c.url, c.description].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)).sort((a, b) => b.createdAt - a.createdAt)

  function openEditor(item?: Competitor) { setDraft(item ? { ...item } : { id: uid(), spaceId, name: '', url: '', createdAt: Date.now() }); setSelectedImage(null); setError(''); setPreviewUrl('') }
  function closeEditor() { setDraft(null); setSelectedImage(null); setError(''); setPreviewUrl('') }
  function chooseImage(file?: File) { if (!file) return; if (!file.type.startsWith('image/')) { setError('请选择图片文件'); return }; setSelectedImage(file); setError(''); setPreviewUrl(URL.createObjectURL(file)) }
  async function submit() {
    const item = draft
    if (!item || !item.name.trim() || saving) return
    setSaving(true); setError('')
    try {
      let image: RequirementAttachment | undefined = item.image
      if (selectedImage) { const uploaded = await uploadLocalFile(selectedImage, { spaceId, entityType: 'competitor', entityId: item.id, pathSegments: ['竞品分析', item.name.trim(), '竞品图片'] }); if (item.image?.fileId) await deleteLocalFile(item.image.fileId); image = uploaded as RequirementAttachment }
      const saved = { ...item, name: item.name.trim(), url: item.url.trim(), image }
      if (competitors.some((competitor) => competitor.id === item.id)) onUpdate(item.id, saved)
      else onAdd(saved)
      closeEditor()
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : '图片保存失败，请重试') } finally { setSaving(false) }
  }

  return <div className="req-pool-page competitor-page">
    <div className="req-pool-toolbar competitor-toolbar"><div className="req-pool-toolbar__title">竞品分析</div><Button label="新增竞品" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={() => openEditor()} /></div>
    {list.length === 0 ? <div className="empty competitor-empty"><div style={{ fontSize: 12.5 }}>{query ? '没有匹配结果' : '暂无竞品，点击右上角新增竞品'}</div></div> : <div className="comp-grid">{list.map((item) => <ClickableCard label={`编辑竞品 ${item.name}`} padding={0} key={item.id} className="comp-card" onClick={() => openEditor(item)}><div className="comp-card__image">{item.image?.url ? <img src={item.image.url} alt={`${item.name} 图片`} /> : <><Icon name="image" size={24} /><span>暂无图片</span></>}</div><div className="comp-card__body"><div className="comp-card__name">{item.name}</div>{item.url ? <a className="comp-card__url" href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{item.url}</a> : <div className="comp-card__url">未填写链接</div>}{item.image && <div onClick={(event) => event.stopPropagation()}><FileAttachmentList files={[item.image]} compact /></div>}</div><div className="comp-card__actions" onClick={(event) => event.stopPropagation()}><IconButton label="编辑竞品" variant="ghost" size="sm" icon={<Icon name="edit" size={13} />} type="button" onClick={() => openEditor(item)} /><IconButton label="删除竞品" variant="ghost" size="sm" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteTarget(item)} /></div></ClickableCard>)}</div>}
    {draft && <WorkspaceOverlay label={competitors.some((item) => item.id === draft.id) ? '编辑竞品' : '新增竞品'} onClose={closeEditor}><form className="modal modal--wide operations-modal competitor-modal" onSubmit={(event) => { event.preventDefault(); void submit() }}><div className="operations-modal__head"><Heading level={3} accessibilityLevel={2} className="modal__title">{competitors.some((item) => item.id === draft.id) ? '编辑竞品' : '新增竞品'}</Heading><IconButton label="关闭" variant="ghost" size="sm" icon={<Icon name="close" size={16} />} type="button" onClick={closeEditor} /></div><div className="field-label">竞品名称 <span className="field-required">*</span></div><TextInput label="竞品名称" value={draft.name} isLabelHidden width="100%" isRequired hasAutoFocus placeholder="填写竞品名称" onChange={(nextValue) => setDraft({ ...draft, name: nextValue })} /><div className="field-label competitor-modal__label">竞品链接</div><TextInput label="竞品链接" isLabelHidden width="100%" type="url" value={draft.url} placeholder="https://" onChange={(nextValue) => setDraft({ ...draft, url: nextValue })} /><div className="field-label competitor-modal__label">竞品图片</div><div className="competitor-image-picker">{(previewUrl || draft.image?.url) && <img src={previewUrl || draft.image?.url} className="competitor-image-picker__drop" alt="竞品预览" />}
      <FileInput label="竞品图片" isLabelHidden accept="image/*" width="100%" placeholder="选择竞品图片" value={selectedImage} isDisabled={saving}
        onChange={(file) => {
          if (file && !Array.isArray(file)) chooseImage(file)
          else { setSelectedImage(null); setPreviewUrl('') }
        }} /></div>{error && <Banner status="error" title={<>{error}</>} />}<div className="modal__actions"><Button label="取消" variant="ghost" type="button" onClick={closeEditor} /><Button label={'保存竞品'} variant="primary" type="submit" isDisabled={saving || !draft.name.trim()} isLoading={saving} /></div></form></WorkspaceOverlay>}
    {deleteTarget && <WorkspaceDialog title="删除竞品？" purpose="info" onClose={() => setDeleteTarget(null)}>
      <div className="app-dialog-form">
        <Text>确认删除「{deleteTarget.name}」？</Text>
        <HStack gap={2} hAlign="end">
          <Button label="取消" variant="secondary" onClick={() => setDeleteTarget(null)} />
          <Button label="确认删除" variant="destructive" onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null) }} />
        </HStack>
      </div>
    </WorkspaceDialog>}
  </div>
}
