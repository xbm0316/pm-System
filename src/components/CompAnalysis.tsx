import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { type Competitor, type RequirementAttachment, uid } from '../lib/store'
import { deleteLocalFile, uploadLocalFile } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'

interface Props { spaceId: string; competitors: Competitor[]; onAdd: (c: Competitor) => void; onUpdate: (id: string, patch: Partial<Competitor>) => void; onDelete: (id: string) => void; openSignal: number; searchQuery?: string }

export default function CompAnalysis({ spaceId, competitors, onAdd, onUpdate, onDelete, openSignal, searchQuery = '' }: Props) {
  const [draft, setDraft] = useState<Competitor | null>(null)
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
  function remove(item: Competitor) { if (window.confirm(`确定删除竞品“${item.name}”吗？`)) onDelete(item.id) }

  return <div className="req-pool-page competitor-page">
    <div className="req-pool-toolbar competitor-toolbar"><div className="req-pool-toolbar__title">竞品分析</div><button className="btn-primary" type="button" onClick={() => openEditor()}><Icon name="plus" size={14} /> 新增竞品</button></div>
    {list.length === 0 ? <div className="empty competitor-empty"><div style={{ fontSize: 12.5 }}>{query ? '没有匹配结果' : '暂无竞品，点击右上角新增竞品'}</div></div> : <div className="comp-grid">{list.map((item) => <article key={item.id} className="comp-card" onClick={() => openEditor(item)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(item) } }}><div className="comp-card__image">{item.image?.url ? <img src={item.image.url} alt={`${item.name} 图片`} /> : <><Icon name="image" size={24} /><span>暂无图片</span></>}</div><div className="comp-card__body"><div className="comp-card__name">{item.name}</div>{item.url ? <a className="comp-card__url" href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{item.url}</a> : <div className="comp-card__url">未填写链接</div>}{item.image && <div onClick={(event) => event.stopPropagation()}><FileAttachmentList files={[item.image]} compact /></div>}</div><div className="comp-card__actions" onClick={(event) => event.stopPropagation()}><button type="button" className="card__act" onClick={() => openEditor(item)} title="编辑竞品" aria-label="编辑竞品"><Icon name="edit" size={13} /></button><button type="button" className="card__act card__act--close" onClick={() => remove(item)} title="删除竞品" aria-label="删除竞品"><Icon name="trash" size={13} /></button></div></article>)}</div>}
    {draft && <div className="overlay" onClick={closeEditor}><form className="modal modal--wide operations-modal competitor-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void submit() }}><div className="operations-modal__head"><div className="modal__title">{competitors.some((item) => item.id === draft.id) ? '编辑竞品' : '新增竞品'}</div><button className="icon-btn" type="button" onClick={closeEditor} aria-label="关闭"><Icon name="close" size={16} /></button></div><div className="field-label">竞品名称 <span className="field-required">*</span></div><input className="text-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="填写竞品名称" autoFocus required /><div className="field-label competitor-modal__label">竞品链接</div><input className="text-input" type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://" /><div className="field-label competitor-modal__label">竞品图片</div><div className="competitor-image-picker"><input id="competitor-image" type="file" accept="image/*" hidden onChange={(event) => { chooseImage(event.target.files?.[0]); event.currentTarget.value = '' }} /><label htmlFor="competitor-image" className="competitor-image-picker__drop">{previewUrl || draft.image?.url ? <img src={previewUrl || draft.image?.url} alt="竞品预览" /> : <><Icon name="image" size={26} /><span>点击上传竞品图片</span><small>支持 JPG、PNG、WEBP</small></>}</label>{(previewUrl || draft.image?.url) && <button type="button" className="btn-ghost competitor-image-picker__replace" onClick={() => document.getElementById('competitor-image')?.click()}>更换图片</button>}</div>{error && <div className="form-error">{error}</div>}<div className="modal__actions"><button className="btn-ghost" type="button" onClick={closeEditor}>取消</button><button className="btn-primary" type="submit" disabled={saving || !draft.name.trim()}>{saving ? '保存中…' : '保存竞品'}</button></div></form></div>}
  </div>
}
