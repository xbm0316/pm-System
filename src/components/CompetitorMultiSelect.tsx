import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import type { Competitor } from '../lib/store'

interface Props {
  options: Competitor[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
}

export default function CompetitorMultiSelect({ options, value, onChange, label = '选择关联竞品' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.filter((option) => value.includes(option.id))

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])
  }

  return <div className="competitor-multi-select" ref={ref}>
    <button type="button" className={`competitor-multi-select__trigger${open ? ' is-open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className={selected.length ? 'has-value' : ''}>{selected.length ? selected.map((item) => item.name).join('、') : label}</span>
      <Icon name="chevronDown" size={14} />
    </button>
    {open && <div className="competitor-multi-select__menu" role="listbox" aria-multiselectable="true">
      {options.length === 0 ? <div className="competitor-multi-select__empty">暂无竞品，请先在竞品分析中添加</div> : options.map((option) => {
        const checked = value.includes(option.id)
        return <button type="button" role="option" aria-selected={checked} className={`competitor-multi-select__option${checked ? ' is-selected' : ''}`} key={option.id} onClick={() => toggle(option.id)}><span className="competitor-multi-select__check">{checked && <Icon name="check" size={12} />}</span><span>{option.name}</span></button>
      })}
    </div>}
  </div>
}
