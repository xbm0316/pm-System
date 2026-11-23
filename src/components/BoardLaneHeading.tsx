import { Badge } from '@astryxdesign/core/Badge'
import { HStack } from '@astryxdesign/core/Layout'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Heading } from '@astryxdesign/core/Text'
import type { ComponentProps } from 'react'

export default function BoardLaneHeading({ name, count, variant }: { name: string; count: number; variant: ComponentProps<typeof StatusDot>['variant'] }) {
  return <HStack hAlign="between" gap={2} vAlign="center" width="100%">
    <HStack gap={2} vAlign="center">
      <span aria-hidden="true"><StatusDot variant={variant} label={name} /></span>
      <Heading level={4} accessibilityLevel={2}>{name}</Heading>
    </HStack>
    <Badge label={count} variant="neutral" />
  </HStack>
}
