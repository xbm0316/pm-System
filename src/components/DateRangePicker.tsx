import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { Calendar, monthTitle, parseDate } from './DatePicker'

interface Props { startDate: string; endDate: string; onApply: (startDate: string, endDate: string) => void; label?: string }

export default function DateRangePicker({ startDate, endDate, onApply, label = '筛选时间' }: Props) {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(startDate)
  const [draftEnd, setDraftEnd] = useState(endDate)
  const [month, setMonth] = useState(() => parseDate(startDate || endDate))
  const [popoverPosition, setPopoverPosition] = useState({ top: 16, left: 16 })
  const [positionReady, setPositionReady] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setDraftStart(startDate); setDraftEnd(endDate); if (startDate || endDate) setMonth(parseDate(startDate || endDate)) }, [startDate, endDate])
  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (ref.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    setPositionReady(false)
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(360, window.innerWidth - 32)
      const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - width - 16))
      const popoverHeight = popoverRef.current?.getBoundingClientRect().height || 0
      const fitsBelow = rect.bottom + 8 + popoverHeight <= window.innerHeight - 16
      const top = fitsBelow || !popoverHeight ? rect.bottom + 8 : Math.max(16, rect.top - popoverHeight - 8)
      setPopoverPosition({ top, left })
      if (popoverHeight > 0) setPositionReady(true)
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => { window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true) }
  }, [open])
  const value = startDate && endDate ? `${startDate} 至 ${endDate}` : startDate ? `${startDate} 起` : endDate ? `截至 ${endDate}` : ''
  const monthValue = new Date(month.getFullYear(), month.getMonth(), 1)
  function choose(valueToSet: string) {
    if (!draftStart || (draftStart && draftEnd)) { setDraftStart(valueToSet); setDraftEnd(''); return }
    if (valueToSet < draftStart) { setDraftStart(valueToSet); setDraftEnd(''); return }
    setDraftEnd(valueToSet)
  }
  function apply() { if (!draftStart || (draftStart && draftEnd && draftEnd < draftStart)) return; onApply(draftStart, draftEnd); setOpen(false) }
  function clear() { setDraftStart(''); setDraftEnd(''); onApply('', ''); setOpen(false) }
  return <div className="date-range-picker" ref={ref}>
    <button ref={triggerRef} type="button" className={`date-range-picker__trigger${value ? ' date-range-picker__trigger--active' : ''}`} onClick={() => setOpen((current) => { const next = !current; setPositionReady(false); return next })} aria-expanded={open} aria-label={value || label}><Icon name="clock" size={14} /><span>{value || label}</span><Icon name="chevronDown" size={13} /></button>
    {open && createPortal(<div ref={popoverRef} className="date-range-picker__popover date-range-picker__popover--floating" style={{ ...popoverPosition, visibility: positionReady ? 'visible' : 'hidden' }}>
      <div className="date-range-picker__title">选择时间范围</div>
      <div className="date-range-picker__fields"><button type="button" className={`date-range-picker__field${draftStart ? ' date-range-picker__field--active' : ''}`} onClick={() => setDraftEnd('')}>{draftStart || '开始日期'}</button><span>至</span><button type="button" className={`date-range-picker__field${draftEnd ? ' date-range-picker__field--active' : ''}`}>{draftEnd || '结束日期'}</button></div>
      <div className="calendar-head"><button type="button" className="calendar-nav" onClick={() => setMonth(new Date(monthValue.getFullYear(), monthValue.getMonth() - 1, 1))} aria-label="上个月"><Icon name="chevronLeft" size={14} /></button><strong>{monthTitle(monthValue)}</strong><button type="button" className="calendar-nav" onClick={() => setMonth(new Date(monthValue.getFullYear(), monthValue.getMonth() + 1, 1))} aria-label="下个月"><Icon name="chevronRight" size={14} /></button></div>
      <Calendar month={monthValue} startDate={draftStart} endDate={draftEnd} onSelect={choose} />
      {draftStart && draftEnd && draftEnd < draftStart && <div className="form-error">结束日期不能早于开始日期</div>}
      <div className="date-range-picker__actions"><button type="button" className="btn-ghost" onClick={clear}>清空</button><button type="button" className="btn-primary" onClick={apply} disabled={Boolean(!draftStart || (draftStart && draftEnd && draftEnd < draftStart))}>应用</button></div>
    </div>, document.body)}
  </div>
}
