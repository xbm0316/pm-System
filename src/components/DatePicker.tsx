import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

interface Props { value: string; onChange: (value: string) => void; label?: string; required?: boolean }

export const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDate(value: string) {
  if (!value) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1)
}

export function monthTitle(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date)
}

interface CalendarProps { month: Date; value?: string; startDate?: string; endDate?: string; onSelect: (value: string) => void }

export function Calendar({ month, value, startDate = '', endDate = '', onSelect }: CalendarProps) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (firstDay.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1
    return day > 0 && day <= days ? new Date(month.getFullYear(), month.getMonth(), day) : null
  })
  return <div className="calendar-grid">
    {WEEK_LABELS.map((label) => <span className="calendar-weekday" key={label}>{label}</span>)}
    {cells.map((day, index) => {
      if (!day) return <span className="calendar-day calendar-day--empty" key={`empty-${index}`} />
      const key = dateKey(day)
      const selected = key === value || key === startDate || key === endDate
      const inRange = Boolean(startDate && endDate && key > startDate && key < endDate)
      return <button type="button" className={`calendar-day${selected ? ' calendar-day--selected' : ''}${inRange ? ' calendar-day--range' : ''}`} key={key} onClick={() => onSelect(key)}>{day.getDate()}</button>
    })}
  </div>
}

export default function DatePicker({ value, onChange, label = '选择日期', required = false }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [month, setMonth] = useState(() => parseDate(value))
  const [popoverPosition, setPopoverPosition] = useState({ top: 16, left: 16 })
  const [positionReady, setPositionReady] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setDraft(value); if (value) setMonth(parseDate(value)) }, [value])
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
      const width = 230
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
  const monthValue = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month])
  function moveMonth(delta: number) { setMonth(new Date(monthValue.getFullYear(), monthValue.getMonth() + delta, 1)) }
  return <div className="date-picker" ref={ref}>
    <button ref={triggerRef} type="button" className={`date-picker__trigger${value ? ' date-picker__trigger--active' : ''}`} onClick={() => setOpen((current) => { const next = !current; setPositionReady(false); return next })} aria-expanded={open} aria-label={value || label}><Icon name="clock" size={14} /><span>{value || label}</span><Icon name="chevronDown" size={13} /></button>
    {required && !value && <span className="date-picker__required">必填</span>}
    {open && createPortal(<div ref={popoverRef} className="date-picker__popover date-picker__popover--floating" style={{ ...popoverPosition, visibility: positionReady ? 'visible' : 'hidden' }}>
      <div className="calendar-head"><button type="button" className="calendar-nav" onClick={() => moveMonth(-1)} aria-label="上个月"><Icon name="chevronLeft" size={14} /></button><strong>{monthTitle(monthValue)}</strong><button type="button" className="calendar-nav" onClick={() => moveMonth(1)} aria-label="下个月"><Icon name="chevronRight" size={14} /></button></div>
      <Calendar month={monthValue} value={draft} onSelect={setDraft} />
      <div className="date-picker__actions"><button type="button" className="btn-ghost" onClick={() => { setDraft(''); onChange(''); setOpen(false) }}>清空</button><button type="button" className="btn-primary" onClick={() => { onChange(draft); setOpen(false) }} disabled={!draft}>确认</button></div>
    </div>, document.body)}
  </div>
}
