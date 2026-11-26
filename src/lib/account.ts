import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function accountPhone(value?: string | null) {
  const match = value?.trim().match(/^(?:\+?86)?(1\d{10})$/)
  return match?.[1] ?? null
}

export function verifiedAccountPhone(user?: User | null) {
  return user?.phone_confirmed_at ? accountPhone(user.phone) : null
}

export async function signIn(phone: string, password: string) {
  const number = accountPhone(phone)
  if (!number) throw new Error('请输入有效的中国大陆手机号')
  const { data, error } = await supabase.auth.signInWithPassword({ phone: `+86${number}`, password })
  if (error) throw new Error('登录失败，请检查手机号和密码')
  if (!verifiedAccountPhone(data.user)) {
    await supabase.auth.signOut({ scope: 'local' })
    throw new Error('此账号的手机号尚未验证')
  }
}
