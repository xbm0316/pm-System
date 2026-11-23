import type { ISODateString } from '@astryxdesign/core/Calendar'
import { DateInput } from '@astryxdesign/core/DateInput'

interface Props {
  value: string
  onChange: (value: string) => void
  label?: string
  required?: boolean
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function toISODate(value: string): ISODateString | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value as ISODateString : undefined
}

export default function DatePicker({ value, onChange, label = '选择日期', required = false }: Props) {
  return <DateInput
    label={label}
    isLabelHidden
    isRequired={required}
    hasClear={!required}
    placeholder={label}
    value={toISODate(value)}
    onChange={(date) => onChange(date ?? '')}
    weekStartsOn="mon"
    width="100%"
  />
}
