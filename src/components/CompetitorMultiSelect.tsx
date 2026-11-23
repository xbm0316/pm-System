import { MultiSelector } from '@astryxdesign/core/MultiSelector'
import type { Competitor } from '../lib/store'

interface Props {
  options: Competitor[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
}

export default function CompetitorMultiSelect({ options, value, onChange, label = '选择关联竞品' }: Props) {
  return <MultiSelector
    label={label}
    isLabelHidden
    placeholder={label}
    width="100%"
    emptyText="暂无竞品，请先在竞品分析中添加"
    triggerDisplay="labels"
    formatValue={(items) => items.map((item) => item.label).join('、')}
    options={options.map(({ id, name }) => ({ value: id, label: name }))}
    value={value}
    onChange={onChange}
  />
}
