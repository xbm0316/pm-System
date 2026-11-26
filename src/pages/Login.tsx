import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useState, type FormEvent } from 'react'
import { signIn } from '../lib/account'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!phone.trim() || !password || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await signIn(phone, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法登录，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-login">
      <div>
        <Card padding={6}>
          <form onSubmit={submit}>
            <VStack gap={4}>
              <Heading level={2} accessibilityLevel={1}>登录工作空间</Heading>
              <TextInput label="手机号" type="tel" autoComplete="username" hasAutoFocus width="100%" value={phone} onChange={(value) => { setPhone(value); setError('') }} />
              <TextInput label="密码" type="password" autoComplete="current-password" width="100%" value={password} onChange={(value) => { setPassword(value); setError('') }} />
              {error && <Banner status="error" title={error} />}
              <Button label="登录" type="submit" variant="primary" width="100%" isLoading={submitting} isDisabled={!phone.trim() || !password} />
            </VStack>
          </form>
        </Card>
      </div>
    </main>
  )
}
