import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { useEffect, useState, type ClipboardEvent } from 'react'
import { chooseAttachmentDestination, getAttachmentDestinationName, isAttachmentToMove, pickAttachmentSource, pickFilesToMove, supportsAttachmentMoves, supportsDirectFileSelection } from '../lib/localFiles'
import Icon from './Icon'
import WorkspaceDialog from './WorkspaceDialog'

interface Props {
  label: string
  onFiles: (files: File[]) => void
  files?: readonly File[]
  onRemove?: (index: number) => void
  accept?: string
  description?: string
  isDisabled?: boolean
  isLoading?: boolean
  single?: boolean
}

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()
  return accept.toLowerCase().split(',').some((entry) => {
    const type = entry.trim()
    if (type.startsWith('.')) return name.endsWith(type)
    if (type.endsWith('/*')) return mime.startsWith(type.slice(0, -1))
    return mime === type
  })
}

export default function AttachmentPicker({ label, onFiles, files, onRemove, accept, description, isDisabled, isLoading, single = false }: Props) {
  const [source, setSource] = useState<Awaited<ReturnType<typeof pickAttachmentSource>> | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [choosing, setChoosing] = useState(false)
  const [message, setMessage] = useState('')
  const [destination, setDestination] = useState('')
  const canSelect = supportsAttachmentMoves()

  useEffect(() => {
    let active = true
    const refresh = () => { void getAttachmentDestinationName().then((name) => { if (active) setDestination(name) }).catch(() => undefined) }
    refresh()
    window.addEventListener('attachment-destination-change', refresh)
    return () => { active = false; window.removeEventListener('attachment-destination-change', refresh) }
  }, [])
  const disabled = isDisabled || isLoading || choosing

  function add(incoming: File[]) {
    const valid = incoming.filter((file) => matchesAccept(file, accept))
    if (!valid.length || valid.length !== incoming.length || (single && valid.length > 1)) {
      setMessage(single && valid.length > 1 ? '此处一次只能添加一个文件' : '部分文件格式不受支持')
      return false
    }
    setMessage('')
    onFiles(valid)
    return true
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    if (disabled || source) return
    event.preventDefault()
    event.stopPropagation()
    const transfer = event.clipboardData
    const incoming = Array.from(transfer.files)
    if (!incoming.length) {
      for (const item of transfer.items) {
        const file = item.kind === 'file' ? item.getAsFile() : null
        if (file) incoming.push(file)
      }
    }
    if (incoming.length) add(incoming)
    else setMessage('剪贴板里没有可用文件，请复制文件或图片后重试')
  }

  async function chooseSource() {
    setChoosing(true)
    setMessage('')
    try {
      if (supportsDirectFileSelection()) add(await pickFilesToMove(!single))
      else {
        setSource(await pickAttachmentSource())
        setSelected([])
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('无法读取所选文件，请重新选择浏览器允许访问的位置')
    } finally {
      setChoosing(false)
    }
  }

  async function chooseDestination() {
    setChoosing(true)
    setMessage('')
    try {
      setDestination(await chooseAttachmentDestination())
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('无法授权存放位置，请重新选择文件夹')
    } finally {
      setChoosing(false)
    }
  }

  async function queueSelected() {
    if (!source || !selected.length || choosing) return
    setChoosing(true)
    try {
      const incoming = await Promise.all(source.entries.filter((entry) => selected.includes(entry.name)).map((entry) => entry.read()))
      if (add(incoming)) setSource(null)
    } catch {
      setMessage('读取来源文件失败，请重新选择')
    } finally {
      setChoosing(false)
    }
  }

  const messageBanner = message && <Banner status="error" title={<>{message}</>} />
  return <div className="attachment-picker" role="group" aria-label={label} tabIndex={0} onPaste={paste}>
    <Button label={label} type="button" variant="secondary" width="100%" className="attachment-picker__trigger"
      icon={<Icon name="doc" size={15} />} isDisabled={disabled || !canSelect} isLoading={isLoading} onClick={() => void chooseSource()} />
    <div className="attachment-picker__hint">
      <Text>{[description, canSelect ? '选择的本地文件将在保存时移动。' : '请选择桌面 Chrome 或 Edge 移动文件。', '可在此粘贴文件或图片（⌘V / Ctrl+V）。'].filter(Boolean).join(' ')}</Text>
    </div>
    {canSelect && <div className="attachment-picker__destination">
      <Button label="选择存放位置" type="button" size="sm" variant="secondary" isDisabled={disabled} onClick={() => void chooseDestination()} />
      <span role="status">{destination || '未选择文件夹'}</span>
    </div>}
    {!!files?.length && <ul className="attachment-picker__queue" aria-label="待保存附件">
      {files.map((file, index) => <li key={index} className="knowledge-upload-item">
        <span>{file.name}{isAttachmentToMove(file) ? ' · 保存时移动' : ''}</span>
        {onRemove && <IconButton label={'移除 ' + file.name} type="button" variant="ghost" size="sm" isDisabled={disabled} icon={<Icon name="close" size={13} />} onClick={() => onRemove(index)} />}
      </li>)}
    </ul>}
    {!source && messageBanner}
    {source && <WorkspaceDialog title="选择要移动的文件" onClose={() => { if (!choosing) { setSource(null); setMessage('') } }}>
      <div className="app-dialog-form">
        <Text>{source.name} · 保存后，选中的文件将从原位置移入附件目录。</Text>
        <div className="attachment-picker__source-list">
          {source.entries.length ? source.entries.map(({ name }) => <CheckboxInput key={name} label={name} value={selected.includes(name)} isDisabled={choosing} onChange={(checked) => setSelected((current) => checked ? single ? [name] : [...current, name] : current.filter((value) => value !== name))} />)
            : <Text>此文件夹没有可选文件</Text>}
        </div>
        {messageBanner}
        <HStack gap={2} hAlign="end">
          <Button label="取消" type="button" variant="ghost" isDisabled={choosing} onClick={() => { setSource(null); setMessage('') }} />
          <Button label="加入待移动附件" type="button" variant="primary" isDisabled={!selected.length || choosing} onClick={() => void queueSelected()} />
        </HStack>
      </div>
    </WorkspaceDialog>}
  </div>
}
