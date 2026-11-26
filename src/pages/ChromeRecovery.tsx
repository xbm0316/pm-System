import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { VStack } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Heading, Text } from '@astryxdesign/core/Text'
import { useEffect, useRef, useState } from 'react'
import { restoreChromeWorkspace } from '../lib/chromeRecovery'
import type { Space } from '../lib/store'

export default function ChromeRecovery({ ticket, phone, spaces, onClose }: {
  ticket: string
  phone: string
  spaces: Space[]
  onClose: () => void
}) {
  const [state, setState] = useState<'running' | 'complete' | 'error'>('running')
  const [error, setError] = useState('')
  const started = useRef(false)

  function start() {
    setState('running')
    void restoreChromeWorkspace(ticket, phone, spaces).then(() => setState('complete'), (failure: unknown) => {
      setError(failure instanceof Error ? failure.message : '暂时无法恢复资料，请重试。')
      setState('error')
    })
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    start()
  }, [])

  return <main className="app-login"><div><Card padding={6}><VStack gap={4}>
    <Heading level={2} accessibilityLevel={1}>恢复账号资料</Heading>
    {state === 'running' && <Spinner label="正在将旧资料存入你的账号…" />}
    {state === 'complete' && <Text>资料已恢复。以后用同一个账号登录，会直接显示云端的数据。</Text>}
    {state === 'error' && <>
      <Banner status="error" title={error} />
      <Button label="重试" variant="primary" onClick={start} />
    </>}
    {state !== 'running' && <Button label="进入工作空间" variant={state === 'complete' ? 'primary' : 'ghost'} onClick={onClose} />}
  </VStack></Card></div></main>
}
