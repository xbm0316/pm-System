import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { fetchLocalBuffer, getLocalFile, localFileUrl, openLocalFolder, type LocalAttachment } from '../lib/localFiles'

export type AttachmentLike = {
  id: string
  fileId?: string
  name: string
  fileName?: string
  type?: string
  mimeType?: string
  size?: number
  kind?: 'image' | 'file'
  url?: string
  relativePath?: string
  storageScope?: string
  storageBackend?: 'helper' | 'browser'
}

function extension(name: string) { return name.split('.').pop()?.toLowerCase() || '' }
function isImage(file: AttachmentLike) { return file.kind === 'image' || (file.mimeType || file.type || '').startsWith('image/') }
function isPdf(file: AttachmentLike) { return extension(file.name || file.fileName || '') === 'pdf' || (file.mimeType || file.type) === 'application/pdf' }
function isText(file: AttachmentLike) { return ['txt', 'md', 'markdown', 'csv'].includes(extension(file.name || file.fileName || '')) || (file.mimeType || file.type || '').startsWith('text/') }
function isDocx(file: AttachmentLike) { return ['doc', 'docx'].includes(extension(file.name || file.fileName || '')) || (file.mimeType || file.type || '').includes('word') }
function isSheet(file: AttachmentLike) { return ['xls', 'xlsx'].includes(extension(file.name || file.fileName || '')) || (file.mimeType || file.type || '').includes('spreadsheet') || (file.mimeType || file.type || '').includes('excel') }
function formatSize(size?: number) {
  if (!size) return '大小未知'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function previewUrl(file: AttachmentLike) {
  return file.fileId ? localFileUrl(file.fileId) : file.url || ''
}

export function FilePreviewModal({ file, onClose, onDelete }: { file: AttachmentLike; onClose: () => void; onDelete?: () => void }) {
  const [folderMessage, setFolderMessage] = useState('')
  const url = previewUrl(file)
  const mime = file.mimeType || file.type || 'application/octet-stream'
  const canEmbed = isImage(file) || isPdf(file)
  const [loading, setLoading] = useState(isText(file) || isDocx(file) || isSheet(file))
  const [text, setText] = useState('')
  const [html, setHtml] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  useEffect(() => {
    if (!url || (!isText(file) && !isDocx(file) && !isSheet(file))) { setLoading(false); return }
    let cancelled = false
    void fetchLocalBuffer(url).then(async (buffer) => {
      if (isText(file)) setText(new TextDecoder().decode(new Uint8Array(buffer)))
      if (isDocx(file)) setHtml((await mammoth.convertToHtml({ arrayBuffer: buffer })).value)
      if (isSheet(file)) {
        const workbook = XLSX.read(buffer, { type: 'array' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]
        setRows((XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]).map((row) => row.map((cell) => String(cell))))
      }
    }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [file, url])
  async function revealFolder() {
    if (!file.relativePath) { setFolderMessage('该旧附件没有可用路径'); return }
    try {
      const result = await openLocalFolder(file.relativePath, file.storageScope, file.storageBackend)
      await navigator.clipboard?.writeText(result.path)
      setFolderMessage(result.native ? `已打开文件夹：${result.path}` : `已定位文件夹：${result.path}（路径已复制）`)
    } catch {
      if (file.relativePath) {
        await navigator.clipboard?.writeText(file.relativePath).catch(() => undefined)
        setFolderMessage('当前浏览器无法直接打开系统文件夹，已复制文件路径')
      } else setFolderMessage('该旧附件没有可用路径')
    }
  }
  return <div className="overlay" onClick={onClose}>
    <div className="modal attachment-preview attachment-preview--unified" onClick={(event) => event.stopPropagation()}>
      <div className="modal__title-row"><div className="modal__title">{file.name}</div><button className="icon-btn" type="button" onClick={onClose} aria-label="关闭"><Icon name="close" size={15} /></button></div>
      <div className="file-preview-meta"><span>{mime}</span><span>{formatSize(file.size)}</span></div>
      {loading ? <div className="knowledge-unsupported">正在解析文件预览…</div> : canEmbed && url ? (isImage(file) ? <img className="attachment-preview__image" src={url} alt={file.name} /> : <iframe className="attachment-preview__pdf" title={file.name} src={url} />) : isDocx(file) && html ? <div className="knowledge-docx-preview" dangerouslySetInnerHTML={{ __html: html }} /> : isText(file) ? <pre className="knowledge-text-preview">{text}</pre> : isSheet(file) ? <table className="knowledge-csv-table"><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table> : <div className="attachment-preview__file"><span className="attachment-preview__file-icon"><Icon name="doc" size={20} /></span><strong>暂不支持在当前页面直接渲染</strong><span>可以打开或下载后使用对应应用查看。</span></div>}
      {file.relativePath && <div className="file-preview-path"><span>路径</span><code>{file.relativePath}</code></div>}
      {folderMessage && <div className="file-preview-folder-message" role="status">{folderMessage}</div>}
      <div className="modal__actions"><button type="button" className="btn-ghost" onClick={() => void revealFolder()}><Icon name="folder" size={13} /> 打开文件夹</button><a className="btn-ghost attachment-preview__download" href={url || undefined} download={file.name} target={canEmbed ? undefined : '_blank'} rel="noreferrer">{canEmbed ? '下载附件' : '打开文件'}</a>{onDelete && <button type="button" className="btn-ghost btn-ghost--danger" onClick={onDelete}><Icon name="trash" size={13} /> 删除</button>}<button type="button" className="btn-primary" onClick={onClose}>关闭</button></div>
    </div>
  </div>
}

export default function FileAttachmentList({ files, onDelete, compact = false }: { files: AttachmentLike[]; onDelete?: (file: AttachmentLike) => void; compact?: boolean }) {
  const [hydrated, setHydrated] = useState<AttachmentLike[]>(files)
  const [preview, setPreview] = useState<AttachmentLike | null>(null)
  const [folderMessage, setFolderMessage] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    void Promise.all(files.map(async (file) => {
      if (file.relativePath && file.url) return file
      const metadata = await getLocalFile(file.fileId || file.id).catch(() => null)
      return metadata ? { ...file, ...metadata, id: file.id } : file
    })).then((next) => { if (!cancelled) setHydrated(next) })
    return () => { cancelled = true }
  }, [files])
  const visibleFiles = useMemo(() => hydrated, [hydrated])
  async function revealFolder(file: AttachmentLike) {
    if (!file.relativePath) { setFolderMessage((current) => ({ ...current, [file.id]: '路径暂不可用（旧附件）' })); return }
    try {
      const result = await openLocalFolder(file.relativePath, file.storageScope, file.storageBackend)
      await navigator.clipboard?.writeText(result.path)
      setFolderMessage((current) => ({ ...current, [file.id]: result.native ? `已打开文件夹：${result.path}` : `已定位：${result.path}` }))
    } catch {
      if (file.relativePath) {
        await navigator.clipboard?.writeText(file.relativePath).catch(() => undefined)
        setFolderMessage((current) => ({ ...current, [file.id]: '浏览器无法直接打开系统文件夹，已复制路径' }))
      } else setFolderMessage((current) => ({ ...current, [file.id]: '路径暂不可用' }))
    }
  }
  if (!visibleFiles.length) return <div className="file-attachment-empty">暂无附件</div>
  return <>
    <div className={`file-attachment-list${compact ? ' file-attachment-list--compact' : ''}`}>
      {visibleFiles.map((file) => {
        const url = previewUrl(file)
        return <div className="file-attachment-item" key={file.id}>
          <div className="file-attachment-item__main" role="button" tabIndex={0} onClick={() => setPreview(file)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPreview(file) } }}>
            {isImage(file) && url ? <img src={url} alt="" /> : <span className="file-attachment-item__icon"><Icon name="doc" size={16} /></span>}
            <span className="file-attachment-item__body"><strong>{file.name}</strong><small>{file.mimeType || file.type || '文件'} · {formatSize(file.size)}</small>{file.relativePath ? <button type="button" className="file-attachment-item__path" onClick={(event) => { event.stopPropagation(); void revealFolder(file) }}>{file.relativePath}</button> : <em>路径暂不可用（旧附件）</em>}</span>
          </div>
          <div className="file-attachment-item__actions"><button type="button" className="icon-btn" title="在线预览" aria-label={`在线预览 ${file.name}`} onClick={() => setPreview(file)}><Icon name="eye" size={13} /></button><button type="button" className="icon-btn" title="打开文件夹" aria-label={`打开文件夹 ${file.name}`} onClick={() => void revealFolder(file)}><Icon name="folder" size={13} /></button>{onDelete && <button type="button" className="icon-btn icon-btn--danger" title="删除附件" aria-label={`删除附件 ${file.name}`} onClick={() => onDelete(file)}><Icon name="trash" size={13} /></button>}</div>
          {folderMessage[file.id] && <span className="file-attachment-item__message">{folderMessage[file.id]}</span>}
        </div>
      })}
    </div>
    {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} onDelete={onDelete ? () => { onDelete(preview); setPreview(null) } : undefined} />}
  </>
}
