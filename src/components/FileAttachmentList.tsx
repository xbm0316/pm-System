import { Banner } from '@astryxdesign/core/Banner'
import { Link } from '@astryxdesign/core/Link'
import { Heading } from '@astryxdesign/core/Text'
import { Table, TableBody, TableRow, TableCell } from '@astryxdesign/core/Table'
import { WorkspaceOverlay } from './WorkspaceDialog'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Button } from '@astryxdesign/core/Button'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { authorizeAttachmentDirectory, fetchLocalBuffer, getLocalFile, localFileUrl, openLocalFolder, readLocalAttachment, type LocalAttachment } from '../lib/localFiles'

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
  const [loading, setLoading] = useState(Boolean(file.fileId) || isText(file) || isDocx(file) || isSheet(file))
  const [text, setText] = useState('')
  const [html, setHtml] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [previewError, setPreviewError] = useState('')
  const [permissionNeeded, setPermissionNeeded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  useEffect(() => {
    if (!url) { setLoading(false); return }
    let cancelled = false
    async function load() {
      setLoading(true)
      setPermissionNeeded(false)
      setPreviewError('')
      try {
        const localFile = file.fileId ? await readLocalAttachment(file.fileId) : null
        if (!isText(file) && !isDocx(file) && !isSheet(file)) return
        const buffer = localFile ? await localFile.arrayBuffer() : await fetchLocalBuffer(url)
        if (isText(file) && !cancelled) setText(new TextDecoder().decode(new Uint8Array(buffer)))
        if (isDocx(file)) {
          const { default: mammoth } = await import('mammoth')
          const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer })
          if (!cancelled) setHtml(value)
        }
        if (isSheet(file)) {
          const XLSX = await import('xlsx')
          const workbook = XLSX.read(buffer, { type: 'array' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          if (!cancelled) setRows((XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]).map((row) => row.map((cell) => String(cell))))
        }
      } catch (error) {
        if (cancelled) return
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        setPermissionNeeded(denied)
        setPreviewError(denied ? '需要重新授权附件保存目录' : '无法读取附件，请确认文件仍在保存目录')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [file, url, retryCount])

  async function authorizePreview() {
    try {
      await authorizeAttachmentDirectory(file.fileId)
      setRetryCount((current) => current + 1)
    } catch {
      setPreviewError('未获得附件目录权限，请重试')
    }
  }

  async function revealFolder() {
    if (!file.relativePath) { setFolderMessage('该旧附件没有可用路径'); return }
    try {
      const result = await openLocalFolder(file.relativePath, file.storageScope, file.storageBackend, file.fileId)
      await navigator.clipboard?.writeText(result.path)
      setFolderMessage(result.native ? `已打开文件夹：${result.path}` : `已定位文件夹：${result.path}（路径已复制）`)
    } catch {
      if (file.relativePath) {
        await navigator.clipboard?.writeText(file.relativePath).catch(() => undefined)
        setFolderMessage('当前浏览器无法直接打开系统文件夹，已复制文件路径')
      } else setFolderMessage('该旧附件没有可用路径')
    }
  }
  return <WorkspaceOverlay label={file.name} onClose={onClose}>
    <div className="modal attachment-preview attachment-preview--unified">
      <div className="modal__title-row"><Heading level={3} accessibilityLevel={2} className="modal__title">{file.name}</Heading><IconButton label="关闭" variant="ghost" size="sm" icon={<Icon name="close" size={15} />} type="button" onClick={onClose} /></div>
      <div className="file-preview-meta"><span>{mime}</span><span>{formatSize(file.size)}</span></div>
      {loading ? <div className="knowledge-unsupported">正在解析文件预览…</div> : previewError ? <Banner status="error" title={<>{previewError}</>} /> : canEmbed && url ? (isImage(file) ? <img className="attachment-preview__image" src={url} alt={file.name} /> : <iframe className="attachment-preview__pdf" title={file.name} src={url} />) : isDocx(file) && html ? <div className="knowledge-docx-preview" dangerouslySetInnerHTML={{ __html: html }} /> : isText(file) ? <pre className="knowledge-text-preview">{text}</pre> : isSheet(file) ? <Table density="compact" className="knowledge-csv-table"><TableBody>{rows.map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table> : <div className="attachment-preview__file"><span className="attachment-preview__file-icon"><Icon name="doc" size={20} /></span><strong>暂不支持在当前页面直接渲染</strong><span>可以打开或下载后使用对应应用查看。</span></div>}
      {file.relativePath && <div className="file-preview-path"><span>路径</span><code>{file.relativePath}</code></div>}
      {folderMessage && <div className="file-preview-folder-message" role="status">{folderMessage}</div>}
      <div className="modal__actions">{permissionNeeded && <Button label="重新授权附件目录" type="button" variant="secondary" onClick={() => void authorizePreview()} />}<Button label="打开文件夹" variant="ghost" icon={<Icon name="folder" size={13} />} type="button" onClick={() => void revealFolder()} /><a className="btn-ghost attachment-preview__download" href={url || undefined} download={file.name} target={canEmbed ? undefined : '_blank'} rel="noreferrer">{canEmbed ? '下载附件' : '打开文件'}</a>{onDelete && <Button label="删除" variant="ghost" icon={<Icon name="trash" size={13} />} type="button" onClick={onDelete} className="btn-ghost--danger" />}<Button label="关闭" variant="primary" type="button" onClick={onClose} /></div>
    </div>
  </WorkspaceOverlay>
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
      const result = await openLocalFolder(file.relativePath, file.storageScope, file.storageBackend, file.fileId)
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
        return <ClickableCard padding={0} className="file-attachment-item" key={file.id} label={`查看附件 ${file.name}`} onClick={() => setPreview(file)}>
          <div className="file-attachment-item__main">
            {isImage(file) && url ? <img src={url} alt="" /> : <span className="file-attachment-item__icon"><Icon name="doc" size={16} /></span>}
            <span className="file-attachment-item__body"><strong>{file.name}</strong><small>{file.mimeType || file.type || '文件'} · {formatSize(file.size)}</small>{file.relativePath ? <Link type="supporting" color="secondary" onClick={() => void revealFolder(file)}>{file.relativePath}</Link> : <em>路径暂不可用（旧附件）</em>}</span>
          </div>
          <div className="file-attachment-item__actions"><IconButton label={`在线预览 ${file.name}`} variant="ghost" size="sm" icon={<Icon name="eye" size={13} />} type="button" onClick={() => setPreview(file)} /><IconButton label={`打开文件夹 ${file.name}`} variant="ghost" size="sm" icon={<Icon name="folder" size={13} />} type="button" onClick={() => void revealFolder(file)} />{onDelete && <IconButton label={`删除附件 ${file.name}`} variant="ghost" size="sm" icon={<Icon name="trash" size={13} />} type="button" onClick={() => onDelete(file)} className="icon-btn--danger" />}</div>
          {folderMessage[file.id] && <span className="file-attachment-item__message">{folderMessage[file.id]}</span>}
        </ClickableCard>
      })}
    </div>
    {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} onDelete={onDelete ? () => { onDelete(preview); setPreview(null) } : undefined} />}
  </>
}
