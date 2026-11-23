import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useState, type FormEvent } from 'react'
import { ALLOWED_PHONES } from '../lib/store'

export default function Login({ onLogin }: { onLogin: (phone: string) => void }) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = phone.trim()
    if (!value) return
    if (ALLOWED_PHONES.includes(value)) onLogin(value)
    else setError('该账号无权限')
  }

  return (
    <main className="app-login">
      <div>
        <Card padding={6}>
          <form onSubmit={submit}>
            <VStack gap={4}>
              <Heading level={2} accessibilityLevel={1}>登录工作空间</Heading>
              <TextInput label="手机号" type="tel" autoComplete="tel" hasAutoFocus width="100%" value={phone} onChange={(value) => { setPhone(value); setError('') }} />
              {error && <Banner status="error" title={error} />}
              <Button label="登录" type="submit" variant="primary" width="100%" isDisabled={!phone.trim()} />
            </VStack>
          </form>
        </Card>
      </div>
    </main>
  )
}
