import { Button } from '@astryxdesign/core/Button'
import { DateInput } from '@astryxdesign/core/DateInput'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Popover } from '@astryxdesign/core/Popover'
import { useState } from 'react'
import Icon from './Icon'
import { toISODate } from './DatePicker'

interface Props { startDate: string; endDate: string; onApply: (startDate: string, endDate: string) => void; label?: string }

export default function DateRangePicker({ startDate, endDate, onApply, label = '筛选时间' }: Props) {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(startDate)
  const [draftEnd, setDraftEnd] = useState(endDate)
  const invalidRange = Boolean(draftStart && draftEnd && draftEnd < draftStart)
  const selected = startDate && endDate ? `${startDate} 至 ${endDate}` : startDate ? `${startDate} 起` : endDate ? `截至 ${endDate}` : ''

  function changeOpen(next: boolean) {
    if (next) {
      setDraftStart(startDate)
      setDraftEnd(endDate)
    }
    setOpen(next)
  }

  function apply(from: string, to: string) {
    onApply(from, to)
    setOpen(false)
  }

  return <Popover label="选择时间范围" isOpen={open} onOpenChange={changeOpen} width={320} alignment="end" content={
    <VStack gap={3}>
      <DateInput label="开始日期" value={toISODate(draftStart)} max={toISODate(draftEnd)} onChange={(value) => setDraftStart(value ?? '')} placeholder="选择开始日期" width="100%" hasClear weekStartsOn="mon" />
      <DateInput label="结束日期" value={toISODate(draftEnd)} min={toISODate(draftStart)} onChange={(value) => setDraftEnd(value ?? '')} placeholder="选择结束日期" width="100%" hasClear weekStartsOn="mon" />
      <HStack gap={2} hAlign="end">
        <Button label="清空" variant="ghost" onClick={() => apply('', '')} />
        <Button label="应用" variant="primary" isDisabled={(!draftStart && !draftEnd) || invalidRange} onClick={() => apply(draftStart, draftEnd)} />
      </HStack>
    </VStack>
  }>
    <Button label={selected || label} variant="secondary" size="sm" icon={<Icon name="clock" size={14} />} />
  </Popover>
}
