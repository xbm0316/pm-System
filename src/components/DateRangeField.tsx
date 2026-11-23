import { Button } from '@astryxdesign/core/Button'
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput'
import { useSyncExternalStore } from 'react'
import { toISODate } from './DatePicker'

const narrowViewport = window.matchMedia('(max-width: 600px)')

function subscribeToViewport(onChange: () => void) {
  narrowViewport.addEventListener('change', onChange)
  return () => narrowViewport.removeEventListener('change', onChange)
}

interface Props {
  label: string
  startDate: string
  endDate: string
  required?: boolean
  onChange: (start: string, end: string) => void
}

export default function DateRangeField({ label, startDate, endDate, required, onChange }: Props) {
  const isNarrow = useSyncExternalStore(subscribeToViewport, () => narrowViewport.matches)
  const start = toISODate(startDate)
  const end = toISODate(endDate)
  const range = start && end ? { start, end } : null
  const partialDate = !range && (start || end)

  return (
    <div className="app-date-range-field">
      <DateRangeInput
        label={label}
        placeholder="选择开始和结束日期"
        isRequired={required}
        width="100%"
        numberOfMonths={isNarrow ? 1 : 2}
        weekStartsOn="mon"
        value={range}
        description={partialDate ? `已有${start ? '开始' : '结束'}日期：${partialDate}` : undefined}
        onChange={(value) => onChange(value?.start ?? '', value?.end ?? '')}
      />
      {partialDate && <Button label={`清空${label}`} size="sm" variant="ghost" type="button" onClick={() => onChange('', '')} />}
    </div>
  )
}
