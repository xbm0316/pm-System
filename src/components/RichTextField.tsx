import { RichTextEditor, RichTextEditorToolbar, RichTextView } from '@astryxdesign/richtext'
import { useMemo } from 'react'
import { normalizeRichTextValue } from '../lib/richText'

interface Props {
  label: string
  value: string
  placeholder?: string
  minHeight?: number
  editable?: boolean
  isRequired?: boolean
  onChange: (value: string) => void
}

export default function RichTextField({ label, value, placeholder, minHeight = 150, editable = true, isRequired = false, onChange }: Props) {
  const defaultValue = useMemo(() => normalizeRichTextValue(value), [value])
  if (!editable) return <RichTextView value={defaultValue} className="astryx-rich-text-field__view" errorFallback={<div className="astryx-rich-text-field__view-empty">暂无内容</div>} />
  return <RichTextEditor
    label={label}
    isRequired={isRequired}
    width="100%"
    defaultValue={defaultValue || undefined}
    placeholder={placeholder}
    minHeight={minHeight}
    toolbar={<RichTextEditorToolbar />}
    onChange={(editorState) => onChange(JSON.stringify(editorState.toJSON()))}
  />
}

export function RichTextContent({ value, className }: { value: string; className?: string }) {
  const normalized = useMemo(() => normalizeRichTextValue(value), [value])
  if (!normalized) return null
  return <RichTextView value={normalized} className={className} errorFallback={<div className={className}>暂无内容</div>} />
}
