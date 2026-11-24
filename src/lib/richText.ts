import { editorStateJSONToMarkdown, markdownToEditorStateJSON } from '@astryxdesign/richtext/markdown'

function stripHtml(value: string) {
  if (typeof DOMParser === 'undefined') return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const document = new DOMParser().parseFromString(value, 'text/html')
  return document.body.textContent?.replace(/\s+/g, ' ').trim() || ''
}

export function isRichTextState(value: string) {
  if (!value.trim()) return false
  try {
    const parsed = JSON.parse(value) as { root?: { type?: string; children?: unknown[] } }
    return parsed.root?.type === 'root' && Array.isArray(parsed.root.children)
  } catch {
    return false
  }
}

/** Converts old plain text/contentEditable HTML into the serialized state expected by Astryx RichTextEditor. */
export function normalizeRichTextValue(value: string) {
  if (!value.trim()) return ''
  if (isRichTextState(value)) return value
  return markdownToEditorStateJSON(stripHtml(value))
}

/** Returns a searchable/card-safe text representation for serialized rich text. */
export function richTextPlainText(value: string) {
  if (!value.trim()) return ''
  if (!isRichTextState(value)) return stripHtml(value)
  try {
    return editorStateJSONToMarkdown(value).replace(/[`*_>#\[\]()]/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}
