import { Badge } from '@astryxdesign/core/Badge'
import type { Priority } from '../lib/store'

const variants: Record<Priority, 'error' | 'warning' | 'blue' | 'neutral'> = {
  P0: 'error',
  P1: 'warning',
  P2: 'blue',
  P3: 'neutral',
}

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge label={priority} variant={variants[priority]} />
}
