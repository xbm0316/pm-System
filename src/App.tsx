import { Spinner } from '@astryxdesign/core/Spinner'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { lazy, Suspense, useState, useEffect } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import { uid, type Space, type TypeName } from './lib/store'
import { fetchSpaces, insertSpace, updateSpaceName, deleteSpaceRow } from './lib/api'
import { deleteLocalFilesForSpace, registerLocalFileServiceWorker, setLocalFileAccount } from './lib/localFiles'
import { supabase } from './lib/supabase'
import { verifiedAccountPhone } from './lib/account'

const Workspace = lazy(() => import('./pages/Workspace'))
const loadingView = <div className="app-loading"><Spinner label="加载中…" aria-label="加载中" /></div>

export default function App() {
  const [account, setAccount] = useState<{ id: string; phone: string } | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [spacesState, setSpacesState] = useState<{ accountId: string; rows: Space[]; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [localFilesReady, setLocalFilesReady] = useState(false)
  const phone = account?.phone
  const accountId = account?.id
  const spaces = spacesState?.accountId === accountId ? spacesState?.rows ?? [] : []

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const phone = verifiedAccountPhone(session?.user)
      setLocalFileAccount(phone)
      setAccount(phone && session ? { id: session.user.id, phone } : null)
      setAuthReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void registerLocalFileServiceWorker().finally(() => setLocalFilesReady(true))
  }, [])

  useEffect(() => {
    setActiveSpaceId(null)
    setSpacesState(null)
    if (!phone || !accountId) return
    let cancelled = false
    void fetchSpaces().then(
      (rows) => { if (!cancelled) setSpacesState({ accountId, rows }) },
      () => { if (!cancelled) setSpacesState({ accountId, rows: [], error: '无法读取工作空间，请重试' }) },
    )
    return () => { cancelled = true }
  }, [accountId, phone, retry])

  function handleLogout() {
    void supabase.auth.signOut({ scope: 'local' })
  }

  function updateSpaces(updater: (rows: Space[]) => Space[]) {
    setSpacesState((current) => current && current.accountId === accountId ? { ...current, rows: updater(current.rows) } : current)
  }

  async function createSpace(name: string, types: TypeName[]) {
    const s: Space = { id: uid(), name, types, createdAt: Date.now() }
    if (!phone) return
    await insertSpace(s, phone)
    updateSpaces((rows) => [...rows, s])
  }

  async function renameSpace(id: string, name: string) {
    if (!phone) return
    await updateSpaceName(id, name)
    updateSpaces((rows) => rows.map((space) => space.id === id ? { ...space, name } : space))
  }

  async function deleteSpace(id: string) {
    await deleteLocalFilesForSpace(id)
    if (phone) {
      await deleteSpaceRow(id)
      for (const prefix of ['jawcat.project-manager.v4.', 'jawcat.operations.v4.', 'jawcat.workspace-todos.v1.']) {
        localStorage.removeItem(prefix + phone + '.' + id)
      }
      if (phone === '13610392041') localStorage.removeItem('jawcat.project-manager.v4.' + id)
    }
    updateSpaces((rows) => rows.filter((space) => space.id !== id))
  }

  if (!authReady || !localFilesReady || (phone && spacesState?.accountId !== accountId)) return loadingView

  if (!phone) {
    return <Login />
  }

  if (spacesState?.error) return <div className="app-login"><div>
    <Banner status="error" title={spacesState.error} />
    <Button label="重试" variant="primary" onClick={() => setRetry((value) => value + 1)} />
    <Button label="退出登录" variant="ghost" onClick={handleLogout} />
  </div></div>

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  if (activeSpace) {
    return (
      <Suspense fallback={loadingView}>
        <Workspace
          key={`${accountId}:${activeSpace.id}`}
          space={activeSpace}
          ownerPhone={phone}
          onBackToHome={() => setActiveSpaceId(null)}
        />
      </Suspense>
    )
  }

  return (
    <Home
      spaces={spaces}
      onOpen={(s) => setActiveSpaceId(s.id)}
      onCreate={createSpace}
      onRename={renameSpace}
      onDelete={deleteSpace}
      onLogout={handleLogout}
    />
  )
}
