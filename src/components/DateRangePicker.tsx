import { DateRangeInput, type DateRange } from '@astryxdesign/core/DateRangeInput'
import { toISODate } from './DatePicker'

interface Props { startDate: string; endDate: string; onApply: (startDate: string, endDate: string) => void; label?: string }

export default function DateRangePicker({ startDate, endDate, onApply, label = '筛选时间' }: Props) {
  const start = toISODate(startDate)
  const end = toISODate(endDate)
  const range: DateRange | null = start && end ? { start, end } : null

  return <DateRangeInput
    label={label}
    isLabelHidden
    value={range}
    onChange={(next) => onApply(next?.start ?? '', next?.end ?? '')}
    hasClear
    placeholder={label}
    numberOfMonths={2}
    weekStartsOn="mon"
    width="auto"
  />
}
