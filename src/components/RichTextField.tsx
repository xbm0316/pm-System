import { useEffect, useRef } from 'react'
import { IconButton } from '@astryxdesign/core/IconButton'
import Icon from './Icon'

interface Props {
  label: string
  value: string
  placeholder?: string
  minHeight?: number
  onChange: (value: string) => void
}

export default function RichTextField({ label, value, placeholder, minHeight = 150, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value
  }, [value])
  function command(name: string, commandValue?: string) {
    editorRef.current?.focus()
    document.execCommand(name, false, commandValue)
    onChange(editorRef.current?.innerHTML || '')
  }
  function sync() { onChange(editorRef.current?.innerHTML || '') }
  return <div className="astryx-rich-text-field">
    <div className="astryx-rich-text-field__label">{label}</div>
    <div className="astryx-rich-text-field__surface">
      <div className="astryx-rich-text-field__toolbar" role="toolbar" aria-label={`${label}格式工具`}>
        <IconButton label="粗体" variant="ghost" size="sm" icon={<Icon name="bold" size={14} />} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('bold')} />
        <IconButton label="斜体" variant="ghost" size="sm" icon={<Icon name="italic" size={14} />} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('italic')} />
        <IconButton label="项目列表" variant="ghost" size="sm" icon={<Icon name="list" size={14} />} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('insertUnorderedList')} />
        <IconButton label="编号列表" variant="ghost" size="sm" icon={<Icon name="listOrdered" size={14} />} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('insertOrderedList')} />
        <IconButton label="插入链接" variant="ghost" size="sm" icon={<Icon name="link" size={14} />} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { const url = window.prompt('输入链接'); if (url) command('createLink', url) }} />
      </div>
      <div ref={editorRef} className="astryx-rich-text-field__editor" contentEditable role="textbox" aria-multiline="true" aria-label={label} data-placeholder={placeholder} style={{ minHeight }} onInput={sync} />
    </div>
  </div>
}
